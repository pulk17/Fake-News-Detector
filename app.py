# app.py (Flask Backend with Integrated Inference and CORS)
import os
import json
import time
import requests
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import lime
import lime.lime_text
from werkzeug.exceptions import BadRequest
from dotenv import load_dotenv
import torch
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification

load_dotenv() 

# --- Configuration ---
SAVED_MODEL_PATH = './saved_model'
LABEL_MAP_FILE = os.path.join(SAVED_MODEL_PATH, 'label_map.json')
FEEDBACK_FILE = 'feedback_data.csv'
FACT_CHECK_API_KEY = os.getenv("FACT_CHECK_API_KEY")
GOOGLE_FACT_CHECK_API_URL = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
EXPECTED_LABELS = ["FAKE", "REAL"]

app = Flask(__name__)

CORS(app)

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


# --- Feedback Handling (Unchanged, but ensure class_names is available) ---
def record_feedback(text, prediction, confidence, is_correct, correct_label=None):
    """Records feedback to a CSV file."""
    if not class_names:
        app.logger.error("Cannot record feedback: class_names not loaded.")
        return False, "Server configuration error: class names unavailable."

    if not isinstance(text, str) or not text:
        return False, "Invalid text provided for feedback."
    if prediction not in class_names:
         return False, f"Invalid prediction label '{prediction}' provided. Expected one of {class_names}."
    if not isinstance(confidence, (float, np.floating, int)) or not (0 <= confidence <= 1): 
         return False, "Invalid confidence value provided."
    if not isinstance(is_correct, bool):
        return False, "Invalid 'is_correct' flag provided."
    if not is_correct and correct_label not in class_names:
         return False, f"Invalid correct_label '{correct_label}' provided when prediction was incorrect. Expected one of {class_names}."

    feedback_entry = {
        'timestamp': pd.Timestamp.now(tz='UTC').isoformat(), # Use ISO format with TZ
        'text': text,
        'prediction': prediction,
        'confidence': float(confidence), 
        'was_correct': is_correct,
        'correct_label': correct_label if not is_correct else prediction
    }
    feedback_df = pd.DataFrame([feedback_entry])

    try:
        feedback_dir = os.path.dirname(FEEDBACK_FILE)
        if feedback_dir and not os.path.exists(feedback_dir):
            os.makedirs(feedback_dir)

        file_exists = os.path.exists(FEEDBACK_FILE)
        feedback_df.to_csv(FEEDBACK_FILE, mode='a', header=not file_exists, index=False, encoding='utf-8')
        app.logger.info(f"Feedback recorded for text starting with: '{text[:50]}...'")
        return True, "Feedback recorded successfully."
    except Exception as e:
        app.logger.error(f"Failed to record feedback to {FEEDBACK_FILE}: {e}", exc_info=True)
        return False, "Failed to write feedback to file."


# --- Flask Routes ---
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
                # Debug with a simple probe
                test_texts = [input_text, input_text]  # Try with a mini-batch
                test_preds = lime_predictor_wrapper(test_texts)
                app.logger.info(f"LIME test prediction shape: {test_preds.shape}")
                
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
def feedback_route():
    """Endpoint to submit feedback."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 415

    data = request.get_json()

    # Define required fields for feedback
    required_fields = ['text', 'prediction', 'confidence', 'was_correct']
    if not all(field in data for field in required_fields):

        missing = [field for field in required_fields if field not in data]
        app.logger.error(f"Feedback request missing fields: {missing}")
        raise BadRequest(f"Missing one or more required fields: {required_fields}")

    text = data.get('text')
    prediction = data.get('prediction')
    confidence = data.get('confidence')
    was_correct = data.get('was_correct')
    correct_label = data.get('correct_label', None)

    # Validate was_correct/correct_label combination
    if not isinstance(was_correct, bool):
         raise BadRequest("Field 'was_correct' must be a boolean (true/false).")
    if not was_correct and not correct_label:
         raise BadRequest("If 'was_correct' is false, 'correct_label' must be provided.")
    # Ensure correct_label is not provided unnecessarily
    if was_correct and correct_label is not None:
         app.logger.warning("Feedback received 'correct_label' even though 'was_correct' is true. Ignoring provided correct_label.")
         correct_label = None # Standardize: correct_label is None if prediction was correct

    # Call the function to record the feedback
    success, message = record_feedback(text, prediction, confidence, was_correct, correct_label)

    if success:
        return jsonify({"status": "success", "message": message}), 201
    else:
        status_code = 400 if "Invalid" in message else 500 
        return jsonify({"status": "error", "message": message}), status_code


@app.route('/config', methods=['GET'])
def config_route():
    """Endpoint to check loaded configuration."""
    return jsonify({
        "label_map": label_map,
        "class_names": class_names,
        "model_path": SAVED_MODEL_PATH,
        "feedback_file": FEEDBACK_FILE,
        "google_fact_check_api_configured": bool(FACT_CHECK_API_KEY),
        "lime_explainer_initialized": bool(explainer),
        "torch_device": str(device) if device else "Not initialized",
        "model_loaded": bool(model),
        "tokenizer_loaded": bool(tokenizer)
    }), 200

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