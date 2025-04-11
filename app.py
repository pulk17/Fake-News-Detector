# app.py (Flask Backend with Integrated Inference and CORS)
import os
import json
import time
import requests
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, g 
from flask_cors import CORS
import lime
import lime.lime_text
from werkzeug.exceptions import BadRequest, Unauthorized, Conflict, NotFound 
from werkzeug.security import generate_password_hash, check_password_hash 
from dotenv import load_dotenv
import torch
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification
from pymongo import MongoClient 
from pydantic import BaseModel, Field, EmailStr, ValidationError
from datetime import datetime, timedelta, timezone 
import jwt 
from bson import ObjectId 

load_dotenv() 

# --- Configuration ---
SAVED_MODEL_PATH = './saved_model'
LABEL_MAP_FILE = os.path.join(SAVED_MODEL_PATH, 'label_map.json')
FACT_CHECK_API_KEY = os.getenv("FACT_CHECK_API_KEY")
GOOGLE_FACT_CHECK_API_URL = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
EXPECTED_LABELS = ["FAKE", "REAL"]
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "FakeNewsDetectorDB") # Default DB name if not in URI/env
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not MONGO_URI:
    raise RuntimeError("MONGO_URI environment variable not set.")
if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable not set.")

app = Flask(__name__)
CORS(app, supports_credentials=True)


# --- Database Setup ---
mongo_client = None
db = None

def get_db():
    """Opens a new database connection if there is none yet for the current application context."""
    global mongo_client, db
    if 'db' not in g:
        try:
            if mongo_client is None:
                 app.logger.info(f"Attempting to connect to MongoDB: {MONGO_URI[:MONGO_URI.find('@')] if '@' in MONGO_URI else MONGO_URI}...") # Log URI safely
                 # Increase timeout, adjust pool size as needed
                 mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000, maxPoolSize=50, minPoolSize=5)
                 # The ismaster command is cheap and does not require auth.
                 mongo_client.admin.command('hello')
                 app.logger.info("MongoDB connection successful.")
            g.db = mongo_client[MONGO_DB_NAME] # Select database
        except Exception as e:
            app.logger.error(f"Could not connect to MongoDB: {e}", exc_info=True)
            raise RuntimeError(f"Could not connect to MongoDB: {e}")
    return g.db

@app.teardown_appcontext
def teardown_db(exception):
    """Closes the database again at the end of the request."""  
    pass


# --- Pydantic Validation Models ---
class UserBase(BaseModel):
    email: EmailStr # Use EmailStr for automatic email validation

class UserCreate(UserBase):
    password: str = Field(..., min_length=8) # Ensure password has min length

class UserLogin(UserBase):
    password: str

class FeedbackCreate(BaseModel):
    text: str
    prediction: str
    confidence: float
    was_correct: bool
    correct_label: str | None = None # Use | None for optional field
    user_id: str | None = None # Optional: Link feedback to user


# --- JWT Utilities & Decorator ---
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=30) # Default expiry
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm="HS256")
    return encoded_jwt

def token_required(f):
    """Decorator to protect routes requiring authentication."""
    import functools
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Check for token in Authorization header (Bearer scheme)
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token_type, token = auth_header.split(" ")
                if token_type.lower() != "bearer":
                    raise ValueError("Invalid token type")
            except ValueError:
                app.logger.warning(f"Invalid Authorization header format: {auth_header}")
                return jsonify({"message": "Invalid Authorization header format"}), 401

        if not token:
            app.logger.info("Token is missing!")
            return jsonify({"message": "Token is missing!"}), 401

        try:
            # Decode the token using the secret key
            data = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            # Find user based on decoded data (e.g., email or user_id)
            db_conn = get_db()
            current_user_id = data.get('user_id')
            try:
                # Attempt to convert user_id from token to ObjectId
                user_object_id = ObjectId(current_user_id)
            except Exception: # Catches errors if current_user_id is not a valid ObjectId string
                app.logger.error(f"Invalid user ID format in token: {current_user_id}")
                return jsonify({"message": "Token contains invalid user identifier!"}), 401

            current_user = db_conn.users.find_one({"_id": user_object_id})
            if current_user is None:
                app.logger.warning(f"User ID {current_user_id} from token not found in DB.") # Log before returning
                return jsonify({"message": "User not found!"}), 401
            g.current_user = current_user # Store user in Flask's g for access in route

            # Pass validated string ID to g.current_user_id if needed elsewhere
            g.current_user_id = str(current_user['_id']) # Use str() to ensure it's a string

        except jwt.ExpiredSignatureError:
            app.logger.info("Token has expired.")
            return jsonify({"message": "Token has expired!"}), 401
        except jwt.InvalidTokenError as e:
            app.logger.error(f"Invalid token: {e}")
            return jsonify({"message": "Token is invalid!"}), 401
        except Exception as e:
            app.logger.error(f"Token processing error: {e}", exc_info=True)
            return jsonify({"message": "Token processing error"}), 500

        # Call the actual route function, passing the decoded data if needed
        return f(*args, **kwargs)
    return decorated

label_map = None
class_names = None
explainer = None
model = None
tokenizer = None
device = None


def load_config_model_and_init():
    """Loads configuration, tokenizer, model, and initializes LIME."""
    global label_map, class_names, explainer, model, tokenizer, device

    # --- Determine Device ---
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    app.logger.info(f"Using device: {device}")
    if device.type == 'cuda':
        app.logger.info(f"GPU Name: {torch.cuda.get_device_name(0)}")

    # --- Load Label Map ---
    if not os.path.exists(LABEL_MAP_FILE):
        app.logger.error(f"Label map ('{LABEL_MAP_FILE}') not found. Cannot start.")
        raise RuntimeError(f"Label map file not found at {LABEL_MAP_FILE}")
    try:
        with open(LABEL_MAP_FILE, 'r') as f:
            label_map_str_keys = json.load(f)
            label_map = {int(k): v for k, v in label_map_str_keys.items()}
            app.logger.info(f"Label map loaded: {label_map}")

        class_names = [label_map[i] for i in sorted(label_map.keys())]
        app.logger.info(f"Class names derived: {class_names}")

        loaded_labels = sorted(label_map.values())
        if loaded_labels != sorted(EXPECTED_LABELS):
             app.logger.warning(f"Loaded label map values {loaded_labels} do not match expected {EXPECTED_LABELS}. "
                                f"Ensure label_map.json from training is correct.")
        else:
            app.logger.info("Label map validated successfully against expected labels.")

    except Exception as e:
        app.logger.error(f"Error loading label map: {e}", exc_info=True)
        raise RuntimeError(f"Label map loading failed: {e}")

    # --- Load Tokenizer and Model ---
    if not os.path.exists(SAVED_MODEL_PATH):
         app.logger.error(f"Saved model directory ('{SAVED_MODEL_PATH}') not found. Cannot load model.")
         raise RuntimeError(f"Model directory not found at {SAVED_MODEL_PATH}")

    try:
        app.logger.info(f"Loading tokenizer from: {SAVED_MODEL_PATH}")
        tokenizer = DistilBertTokenizerFast.from_pretrained(SAVED_MODEL_PATH)
        app.logger.info("Tokenizer loaded successfully.")

        app.logger.info(f"Loading model from: {SAVED_MODEL_PATH}")
        # Ensure num_labels matches the loaded map
        num_labels = len(class_names)
        model = DistilBertForSequenceClassification.from_pretrained(SAVED_MODEL_PATH, num_labels=num_labels)
        model.to(device) 
        model.eval()     
        app.logger.info("Model loaded successfully and moved to device.")

    except Exception as e:
        app.logger.error(f"Error loading tokenizer or model: {e}", exc_info=True)
        raise RuntimeError(f"Failed to load model/tokenizer: {e}")

    # --- Initialize LIME Explainer ---
    if class_names and model and tokenizer: 
        explainer = lime.lime_text.LimeTextExplainer(class_names=class_names)
        app.logger.info("LIME explainer initialized.")
    else:
        app.logger.error("Cannot initialize LIME explainer: class names, model, or tokenizer not loaded.")
        explainer = None

# --- Prediction Logic (Uses Local Model) ---
def get_prediction_probabilities(texts):
    """
    Tokenizes text and gets prediction probabilities from the local model.
    Handles single string or list of strings.
    Returns a numpy array of probabilities [prob_class_0, prob_class_1, ...].
    """
    global tokenizer, model, device
    if not tokenizer or not model:
        app.logger.error("Model or tokenizer not loaded. Cannot predict.")
        return None 

    try:
        # Handle single string input by wrapping it in a list
        is_single_input = isinstance(texts, str)
        input_texts = [texts] if is_single_input else texts

        # Tokenize the batch of texts
        inputs = tokenizer(input_texts,
                           padding=True,       
                           truncation=True,     
                           max_length=512,
                           return_tensors="pt") 

        # Move inputs to the same device as the model
        inputs = {k: v.to(device) for k, v in inputs.items()}

        # Perform inference without calculating gradients
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits

        # Apply softmax to convert logits to probabilities
        probabilities = torch.softmax(logits, dim=-1)

        # Move probabilities to CPU and convert to numpy array
        probabilities_np = probabilities.cpu().numpy()

        # If input was single string, return only the first row of probabilities
        return probabilities_np[0] if is_single_input else probabilities_np

    except Exception as e:
        app.logger.error(f"Error during prediction: {e}", exc_info=True)
        return None


# --- LIME Predictor Wrapper ---
def lime_predictor_wrapper(texts):
    """
    Wrapper function for LIME that calls the local model prediction function
    for a batch of texts.
    Input: list of strings
    Output: numpy array of probabilities (num_texts, num_classes)
    """
    try:
        # Get predictions from the model
        probs = get_prediction_probabilities(texts)
        
        if probs is None:
            app.logger.error("LIME: Prediction failed for batch. Using uniform probabilities.")
            # Return array of correct shape with dummy values to avoid crashing LIME
            return np.full((len(texts), len(class_names)), 1.0 / len(class_names))
        elif isinstance(probs, np.ndarray) and len(probs.shape) == 1:
            # If only one prediction (single text), reshape to 2D
            if len(texts) == 1:
                return probs.reshape(1, -1)
            else:
                app.logger.error(f"LIME: Prediction shape mismatch. Got 1D but expected 2D for {len(texts)} texts.")
                return np.full((len(texts), len(class_names)), 1.0 / len(class_names))
        elif probs.shape[0] != len(texts):
            app.logger.error(f"LIME: Mismatch in expected ({len(texts)}) vs returned ({probs.shape[0]}) predictions. Using uniform.")
            return np.full((len(texts), len(class_names)), 1.0 / len(class_names))
        else:
            return probs
    except Exception as e:
        app.logger.error(f"LIME predictor wrapper error: {e}", exc_info=True)
        return np.full((len(texts), len(class_names)), 1.0 / len(class_names))


# --- Google Fact Check API  ---
def call_google_fact_check(query):
    """Calls the Google Fact Check API."""
    if not FACT_CHECK_API_KEY:
        app.logger.warning("Google Fact Check API key not configured (FACT_CHECK_API_KEY env var missing). Skipping.")
        return {"status": "skipped", "reason": "API key not configured"}

    params = {
        'query': query,
        'key': FACT_CHECK_API_KEY,
        'languageCode': 'en' 
    }
    try:
        response = requests.get(GOOGLE_FACT_CHECK_API_URL, params=params, timeout=10)
        response.raise_for_status()
        results = response.json()
        app.logger.info(f"Google Fact Check API successful for query: '{query[:50]}...'")
        
        claims = results.get('claims', [])
        simplified_claims = []
        for claim in claims[:3]: # Return top 3 claims for brevity
            simplified_claims.append({
                "text": claim.get('text'),
                "claimant": claim.get('claimant'),
                "rating": claim.get('claimReview', [{}])[0].get('textualRating'),
                "url": claim.get('claimReview', [{}])[0].get('url')
            })
        return {"status": "success", "claims": simplified_claims}

    except requests.exceptions.Timeout:
        app.logger.error(f"Google Fact Check API timed out for query: '{query[:50]}...'")
        return {"status": "error", "message": "API call timed out"}
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Google Fact Check API error: {e}")
        if e.response is not None:
              if e.response.status_code == 400 or e.response.status_code == 403:
                   app.logger.error("Potential Google API Key issue (invalid key or API not enabled?)")
                   return {"status": "error", "message": f"API request failed (status {e.response.status_code}). Check API Key and permissions."}
              else:
                   return {"status": "error", "message": f"API request failed (status {e.response.status_code})"}
        else:
             return {"status": "error", "message": f"API request failed: {e}"}
    except Exception as e:
        app.logger.error(f"Unexpected error during Fact Check API call: {e}", exc_info=True)
        return {"status": "error", "message": "An unexpected error occurred during fact-checking."}
    
# --- Feedback Handling (MongoDB Version) ---
def record_feedback_mongodb(feedback_data: FeedbackCreate):
    """Records feedback to MongoDB."""
    # Validation already done by Pydantic in the route
    db_conn = get_db()
    feedback_collection = db_conn.feedback # Assuming 'feedback' collection

    feedback_entry = feedback_data.model_dump() # Convert Pydantic model to dict
    feedback_entry['timestamp'] = datetime.now(timezone.utc)

    # Ensure correct_label consistency
    if feedback_data.was_correct:
        feedback_entry['correct_label'] = feedback_entry['prediction']
    elif not feedback_data.correct_label:
         # Should be caught by validation logic in route if needed, but double-check
         return False, "correct_label must be provided if was_correct is false."

    try:
        result = feedback_collection.insert_one(feedback_entry)
        app.logger.info(f"Feedback recorded (MongoDB): ID {result.inserted_id} for text starting with '{feedback_data.text[:50]}...'")
        return True, "Feedback recorded successfully."
    except Exception as e:
        app.logger.error(f"Failed to record feedback to MongoDB: {e}", exc_info=True)
        return False, "Failed to write feedback to database."
    


# --- Flask Routes ---
# --- Authentication Routes ---
@app.route('/register', methods=['POST'])
def register_user():
    """Registers a new user."""
    try:
        user_data = UserCreate(**request.get_json())
    except ValidationError as e:
        app.logger.warning(f"Registration validation failed: {e.errors()}")
        return jsonify({"error": "Invalid input data", "details": e.errors()}), 400
    except BadRequest:
         return jsonify({"error": "Request must be JSON"}), 415

    db_conn = get_db()
    users_collection = db_conn.users # Assuming 'users' collection

    # Check if user already exists
    existing_user = users_collection.find_one({"email": user_data.email})
    if existing_user:
        app.logger.warning(f"Registration attempt for existing email: {user_data.email}")
        raise Conflict("User with this email already exists.") # 409 Conflict

    # Hash the password
    hashed_password = generate_password_hash(user_data.password)

    try:
        # Insert new user (convert Pydantic model to dict)
        user_dict = user_data.model_dump() # Use model_dump() for Pydantic v2+
        user_dict['password'] = hashed_password # Store hashed password
        user_dict['created_at'] = datetime.now(timezone.utc)

        result = users_collection.insert_one(user_dict)
        app.logger.info(f"User registered successfully: {user_data.email}, ID: {result.inserted_id}")
        return jsonify({
            "message": "User registered successfully",
            "user_id": str(result.inserted_id) # Return user ID as string
        }), 201
    except Exception as e:
        app.logger.error(f"Error inserting user into MongoDB: {e}", exc_info=True)
        return jsonify({"error": "Failed to register user due to database error"}), 500


@app.route('/login', methods=['POST'])
def login_user():
    """Logs in a user and returns a JWT."""
    try:
        login_data = UserLogin(**request.get_json())
    except ValidationError as e:
         app.logger.warning(f"Login validation failed: {e.errors()}")
         return jsonify({"error": "Invalid input data", "details": e.errors()}), 400
    except BadRequest:
         return jsonify({"error": "Request must be JSON"}), 415

    db_conn = get_db()
    users_collection = db_conn.users

    # Find user by email
    user = users_collection.find_one({"email": login_data.email})

    if not user:
        app.logger.warning(f"Login failed: User not found for email {login_data.email}")
        raise Unauthorized("Invalid credentials.") # Keep error generic

    # Check password
    if check_password_hash(user['password'], login_data.password):
        # Passwords match - create JWT
        token_payload = {
            'user_id': str(user['_id']), # Include user ID (convert ObjectId to str)
            'email': user['email']
            # Add other claims like roles if needed
        }
        access_token = create_access_token(data=token_payload, expires_delta=timedelta(hours=1)) # e.g., 1 hour expiry
        app.logger.info(f"User logged in successfully: {login_data.email}")
        return jsonify(access_token=access_token)
    else:
        app.logger.warning(f"Login failed: Invalid password for email {login_data.email}")
        raise Unauthorized("Invalid credentials.")


@app.route('/predict', methods=['POST'])
def predict_route():
    """Endpoint to get prediction, confidence, explanation, and fact-check."""
    start_time = time.time()
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 415

    data = request.get_json()
    input_text = data.get('text')
    explain = data.get('explain', False) 

    if not input_text or not isinstance(input_text, str):
        raise BadRequest("Missing or invalid 'text' field in JSON payload.")

    # --- 1. Get prediction from LOCAL model ---
    probabilities = get_prediction_probabilities(input_text) 
    if probabilities is None:
         # Check if model/tokenizer failed loading vs. prediction error
         if not model or not tokenizer:
             app.logger.error("Prediction failed because model or tokenizer is not loaded.")
             return jsonify({"error": "Prediction failed: Model or Tokenizer not available."}), 503 # Service Unavailable (misconfigured)
         else:
            app.logger.error("Prediction failed during execution of get_prediction_probabilities.")
            return jsonify({"error": "Prediction failed due to an internal error."}), 500 # Internal Server Error

    predicted_class_id = np.argmax(probabilities)
    confidence = probabilities[predicted_class_id]

    # Ensure label_map is loaded
    if not label_map:
        app.logger.error("Label map not loaded, cannot determine prediction label.")
        return jsonify({"error": "Server configuration error: Label map unavailable."}), 500

    predicted_label = label_map.get(predicted_class_id, f"UNKNOWN_LABEL_{predicted_class_id}")

    # --- 2. Get LIME Explanation (if requested and possible) ---
    explanation_html = None
    explanation_status = "not_requested"
    if explain:
        if explainer and lime_predictor_wrapper: 
            app.logger.info("Generating LIME explanation...")
            explanation_status = "generating"
            try:
                # Create the LIME explanation
                explanation = explainer.explain_instance(
                    input_text,
                    lime_predictor_wrapper, 
                    num_features=15,
                    num_samples=500, 
                    top_labels=1,
                    labels=(predicted_class_id,) 
                )
                
                # Check if HTML is generated
                explanation_html = explanation.as_html()
                if not explanation_html or len(explanation_html) < 100:
                    app.logger.error(f"LIME generated HTML is empty or too short: {explanation_html[:100]}")
                    explanation_status = "error: empty explanation HTML"
                else:
                    app.logger.info(f"LIME explanation HTML length: {len(explanation_html)}")
                    explanation_status = "success"
                    app.logger.info("LIME explanation generated successfully.")
            except Exception as e:
                app.logger.error(f"Could not generate LIME explanation: {e}", exc_info=True)
                explanation_status = f"error: {str(e)}"


    # --- 3. Call Google Fact Check API ---
    app.logger.info("Calling Google Fact Check API...")
    fact_check_results = call_google_fact_check(input_text)

    end_time = time.time()
    processing_time = end_time - start_time

    # --- 4. Prepare Response ---
    if not class_names:
        app.logger.error("Class names not loaded, cannot create full probabilities dictionary.")
        prob_dict = {"error": "class names unavailable"}
    else:
         prob_dict = {name: float(prob) for name, prob in zip(class_names, probabilities)}

    response = {
        "prediction": {
            "label": predicted_label,
            "confidence": float(confidence),
            "probabilities": prob_dict
        },
        "explanation": {
            "status": explanation_status,
            "html": explanation_html
        },
        "fact_check": fact_check_results,
        "processing_time_seconds": round(processing_time, 3)
    }

    return jsonify(response), 200


@app.route('/feedback', methods=['POST'])
@token_required
def feedback_route():
    """Endpoint to submit feedback."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 415

    try:
        # Directly attempt to validate and create the Pydantic model
        feedback_data = FeedbackCreate(**request.get_json())

        # --- Specific Logic Validation (AFTER basic Pydantic validation) ---
        # Check was_correct / correct_label combination
        if not feedback_data.was_correct and not feedback_data.correct_label:
             # Use werkzeug's BadRequest or return a custom JSON response
             # raise BadRequest("If 'was_correct' is false, 'correct_label' must be provided.")
             app.logger.warning("Feedback validation failed: correct_label missing when was_correct is false.")
             return jsonify({"error": "Input validation failed", "details": {"correct_label": ["If 'was_correct' is false, 'correct_label' must be provided."]}}), 400

        # Standardize: Ensure correct_label is None if prediction was correct
        if feedback_data.was_correct and feedback_data.correct_label is not None:
            app.logger.warning("Feedback received 'correct_label' even though 'was_correct' is true. Ignoring provided correct_label.")
            feedback_data.correct_label = None

        # --- Add user_id from token ---
        if hasattr(g, 'current_user_id'):
             feedback_data.user_id = g.current_user_id
        else:
             app.logger.warning("Could not retrieve user_id from context (g) for feedback.")
             feedback_data.user_id = None # Explicitly set to None

        # --- Call the function to record the feedback ---
        success, message = record_feedback_mongodb(feedback_data)

        if success:
            return jsonify({"status": "success", "message": message}), 201
        else:
            # If record_feedback_mongodb returns specific error messages, use them
            status_code = 500 
            if "Invalid" in message: 
                status_code = 400
            return jsonify({"status": "error", "message": message}), status_code

    except ValidationError as e:
        # Pydantic validation failed (missing fields, wrong types)
        app.logger.warning(f"Feedback Pydantic validation failed: {e.errors()}")
        return jsonify({"error": "Invalid input data", "details": e.errors()}), 400

@app.route('/config', methods=['GET'])
def config_route():
    """Endpoint to check loaded configuration."""
    return jsonify({
        "label_map": label_map,
        "class_names": class_names,
        "model_path": SAVED_MODEL_PATH,
        "google_fact_check_api_configured": bool(FACT_CHECK_API_KEY),
        "lime_explainer_initialized": bool(explainer),
        "torch_device": str(device) if device else "Not initialized",
        "model_loaded": bool(model),
        "tokenizer_loaded": bool(tokenizer)
    }), 200

@app.route('/healthz')
def health_check():
     db_conn = get_db()
     try:
         db_conn.admin.command('ping') # Check DB connection
     except Exception:
         return jsonify(status='unhealthy: db connection failed'), 503
     return jsonify(status='ok'), 200

# --- Error Handling ---
@app.errorhandler(BadRequest)
def handle_bad_request(e):
    app.logger.warning(f"Bad Request: {e.description}")
    return jsonify(error=e.description), 400

@app.errorhandler(Unauthorized)
def handle_unauthorized(e):
    app.logger.warning(f"Unauthorized access attempt: {e.description}")
    return jsonify(error=e.description), 401

@app.errorhandler(Conflict)
def handle_conflict(e):
    app.logger.warning(f"Conflict Error: {e.description}")
    return jsonify(error=e.description), 409

@app.errorhandler(NotFound)
def handle_not_found(e):
    app.logger.warning(f"Not Found: {e.description}")
    return jsonify(error=e.description), 404

@app.errorhandler(ValidationError) # Handle Pydantic validation errors globally
def handle_pydantic_validation_error(e):
     app.logger.warning(f"Pydantic Validation Error: {e.errors()}")
     return jsonify({"error": "Input validation failed", "details": e.errors()}), 400

@app.errorhandler(Exception) # Generic error handler
def handle_generic_exception(e):
    # Avoid logging known HTTP exceptions again if already handled
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        # Pass through HTTP exceptions (already logged potentially)
        return e
    # Log unexpected errors
    app.logger.error(f"An unexpected error occurred: {e}", exc_info=True)
    return jsonify(error="An internal server error occurred."), 500

# --- Main Execution ---
if __name__ == '__main__':
    try:
        load_config_model_and_init()
        app.run(host='0.0.0.0', port=5000, debug=False)

    except RuntimeError as e:
        app.logger.critical(f"Application failed to start: {e}", exc_info=True)
        import sys
        sys.exit(1)
    except Exception as e:
        # Catch any other unexpected errors during startup
        app.logger.critical(f"An unexpected error occurred during startup: {e}", exc_info=True)
        import sys
        sys.exit(1)