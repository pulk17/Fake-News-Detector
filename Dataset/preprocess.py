# preprocess_data.py
import pandas as pd
import numpy as np
import re
import nltk
from nltk.corpus import stopwords
import string # To remove punctuation more easily
import os # To check for file existence

# --- Configuration ---
# Adjust these paths if your files are located elsewhere
TRAIN_TSV_PATH = 'train.tsv'
TEST_TSV_PATH = 'test.tsv'
FAKE_CSV_PATH = 'Fake.csv' # Adjust filename if needed (e.g., fake.csv)
TRUE_CSV_PATH = 'True.csv' # Adjust filename if needed (e.g., true.csv)
OUTPUT_CSV_PATH = 'combined_preprocessed_news.csv'

print("--- Data Preprocessing Script Started ---")

# --- Check if input files exist ---
required_files = [TRAIN_TSV_PATH, TEST_TSV_PATH, FAKE_CSV_PATH, TRUE_CSV_PATH]
files_exist = True
for f_path in required_files:
    if not os.path.exists(f_path):
        print(f"Error: Required input file not found: {f_path}")
        files_exist = False

if not files_exist:
    print("\nPlease ensure all required input files are in the same directory as the script.")
    print("Script aborted.")
    exit() # Stop the script if files are missing
else:
    print("All required input files found.")

# Define column names for the TSV files based on the description
tsv_column_names = [
    'id', 'label', 'statement', 'subject', 'speaker', 'speaker_job_title',
    'state_info', 'party_affiliation', 'barely_true_counts', 'false_counts',
    'half_true_counts', 'mostly_true_counts', 'pants_on_fire_counts', 'context'
]

# Define the target columns for the final unified dataset
final_columns = [
    'text', 'label', 'subject', 'speaker', 'speaker_job_title',
    'state_info', 'party_affiliation', 'context', 'date', 'source',
    'processed_text', 'encoded_label'
    # Add credit history counts if desired
    # 'barely_true_counts', 'false_counts', 'half_true_counts',
    # 'mostly_true_counts', 'pants_on_fire_counts'
]


# --- Download NLTK data (if not already present) ---
try:
    nltk.data.find('corpora/stopwords')
    print("\nNLTK stopwords found.")
except nltk.downloader.DownloadError:
    print("\nNLTK stopwords not found. Downloading...")
    try:
        nltk.download('stopwords')
        print("NLTK stopwords downloaded.")
    except Exception as e:
        print(f"Error downloading NLTK stopwords: {e}")
        print("Please check your internet connection or firewall settings.")
        print("Script aborted.")
        exit() # Stop if download fails

stop_words = set(stopwords.words('english'))

# --- Text Preprocessing Function ---
def preprocess_text(text):
    """Cleans and preprocesses text data."""
    if not isinstance(text, str):
        return "" # Return empty string for non-string inputs (like NaN)

    # 1. Convert to lowercase
    text = text.lower()

    # 2. Remove URLs
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)

    # 3. Remove HTML tags (basic)
    text = re.sub(r'<.*?>', '', text)

    # 4. Remove text in square brackets (often metadata like [Reuters])
    text = re.sub(r'\[.*?\]', '', text)

    # 5. Remove punctuation more comprehensively
    text = text.translate(str.maketrans('', '', string.punctuation))

    # 6. Remove numbers (optional - consider if numbers are important)
    # text = re.sub(r'\d+', '', text)

    # 7. Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    # 8. Remove stopwords (optional - uncomment if desired)
    # tokens = text.split()
    # tokens = [word for word in tokens if word not in stop_words]
    # text = ' '.join(tokens)

    # 9. Lemmatization/Stemming (Optional - would require more NLTK setup)
    # ...

    return text

# --- Load and Process LIAR Dataset (TSV files) ---
print("\nProcessing LIAR dataset (train.tsv, test.tsv)...")
try:
    df_train_tsv = pd.read_csv(TRAIN_TSV_PATH, sep='\t', header=None, names=tsv_column_names)
    df_test_tsv = pd.read_csv(TEST_TSV_PATH, sep='\t', header=None, names=tsv_column_names)
    df_liar = pd.concat([df_train_tsv, df_test_tsv], ignore_index=True)
    print(f"LIAR dataset loaded. Shape: {df_liar.shape}")

    # Map LIAR labels to binary 'REAL'/'FAKE'
    # Categories considered REAL: true, mostly-true, half-true
    # Categories considered FAKE: false, barely-true, pants-fire
    label_mapping_liar = {
        'true': 'REAL',
        'mostly-true': 'REAL',
        'half-true': 'REAL',
        'false': 'FAKE',
        'barely-true': 'FAKE',
        'pants-fire': 'FAKE'
    }
    df_liar['label'] = df_liar['label'].map(label_mapping_liar)

    # Rename 'statement' to 'text' for consistency
    df_liar.rename(columns={'statement': 'text'}, inplace=True)

    # Add source column
    df_liar['source'] = 'LIAR'

    # Select relevant columns (add credit counts here if needed)
    liar_cols_to_keep = [
        'text', 'label', 'subject', 'speaker', 'speaker_job_title',
        'state_info', 'party_affiliation', 'context', 'source'
        # Add credit counts here if needed
        # 'barely_true_counts', 'false_counts', 'half_true_counts',
        # 'mostly_true_counts', 'pants_on_fire_counts'
    ]
    # Ensure only existing columns are selected
    liar_cols_to_keep = [col for col in liar_cols_to_keep if col in df_liar.columns]
    df_liar = df_liar[liar_cols_to_keep]
    print(f"LIAR dataset processed. Shape: {df_liar.shape}")

except FileNotFoundError as e:
    print(f"Error loading TSV file: {e}. Please check file paths.")
    df_liar = pd.DataFrame() # Create empty df to avoid error later
except Exception as e:
    print(f"An error occurred processing TSV files: {e}")
    df_liar = pd.DataFrame()

# --- Load and Process Kaggle Fake/True News Dataset (CSV files) ---
print("\nProcessing Kaggle dataset (Fake.csv, True.csv)...")
dfs_kaggle = []
try:
    # Process Fake News
    df_fake_csv = pd.read_csv(FAKE_CSV_PATH)
    df_fake_csv['label'] = 'FAKE'
    df_fake_csv['source'] = 'KaggleFake'
    # Combine title and text, handling potential NaNs
    df_fake_csv['text'] = df_fake_csv['title'].fillna('') + " " + df_fake_csv['text'].fillna('')
    dfs_kaggle.append(df_fake_csv[['text', 'label', 'subject', 'date', 'source']])
    print(f"Loaded Fake.csv. Shape: {df_fake_csv.shape}")

    # Process True News
    df_true_csv = pd.read_csv(TRUE_CSV_PATH)
    df_true_csv['label'] = 'REAL'
    df_true_csv['source'] = 'KaggleTrue'
    # Combine title and text, handling potential NaNs
    df_true_csv['text'] = df_true_csv['title'].fillna('') + " " + df_true_csv['text'].fillna('')
    dfs_kaggle.append(df_true_csv[['text', 'label', 'subject', 'date', 'source']])
    print(f"Loaded True.csv. Shape: {df_true_csv.shape}")

    df_kaggle = pd.concat(dfs_kaggle, ignore_index=True)
    print(f"Kaggle dataset processed. Shape: {df_kaggle.shape}")

except FileNotFoundError as e:
    print(f"Error loading CSV file: {e}. Please check file paths.")
    df_kaggle = pd.DataFrame() # Create empty df
except Exception as e:
    print(f"An error occurred processing CSV files: {e}")
    df_kaggle = pd.DataFrame()

# --- Combine Datasets ---
print("\nCombining LIAR and Kaggle datasets...")
if not df_liar.empty or not df_kaggle.empty:
    df_combined = pd.concat([df_liar, df_kaggle], ignore_index=True, sort=False)
    print(f"Initial combined shape: {df_combined.shape}")

    # Handle potential duplicate columns if credit counts were kept (unlikely here)
    # df_combined = df_combined.loc[:,~df_combined.columns.duplicated()]

    # Fill missing values created by combining different structures
    # Fill text NAs first (critical)
    initial_text_na = df_combined['text'].isna().sum()
    if initial_text_na > 0:
        print(f"Warning: Found {initial_text_na} missing values in 'text' column. Dropping these rows.")
        df_combined.dropna(subset=['text'], inplace=True)

    # Fill missing labels (less likely after processing, but check)
    initial_label_na = df_combined['label'].isna().sum()
    if initial_label_na > 0:
          print(f"Warning: Found {initial_label_na} missing values in 'label' column. Dropping these rows.")
          df_combined.dropna(subset=['label'], inplace=True)


    # Fill other missing metadata with 'Unknown' or appropriate placeholders
    fill_values = {
        'subject': 'Unknown',
        'speaker': 'Unknown',
        'speaker_job_title': 'Unknown',
        'state_info': 'Unknown',
        'party_affiliation': 'Unknown',
        'context': 'Unknown',
        'date': 'Unknown' # Or pd.NaT if you want a proper date null
        # Add fill values for credit counts if they were kept
    }
    # Apply fillna only for columns that actually exist in the combined df
    for col, value in fill_values.items():
        if col in df_combined.columns:
            df_combined[col].fillna(value, inplace=True)


    print(f"Shape after initial combining & handling critical NAs: {df_combined.shape}")
    # print(f"Combined dataset columns: {df_combined.columns.tolist()}") # Uncomment to debug columns if needed
    # print(f"\nMissing values per column after fill:\n{df_combined.isnull().sum()}") # Uncomment to debug NAs

    # --- Apply Text Preprocessing ---
    print("\nApplying text preprocessing to 'text' column...")
    # Ensure the text column is string type before applying
    df_combined['text'] = df_combined['text'].astype(str)
    df_combined['processed_text'] = df_combined['text'].apply(preprocess_text)
    print("Text preprocessing complete.")

    # --- Encode Labels ---
    print("Encoding labels ('FAKE': 0, 'REAL': 1)...") # IMPORTANT MAPPING
    label_encoding_map = {'FAKE': 0, 'REAL': 1}
    df_combined['encoded_label'] = df_combined['label'].map(label_encoding_map)

    # Verify encoding worked
    label_encoding_na = df_combined['encoded_label'].isna().sum()
    invalid_labels = df_combined[df_combined['encoded_label'].isna()]['label'].unique()
    if label_encoding_na > 0:
          print(f"Warning: {label_encoding_na} rows could not be label encoded.")
          print(f"Invalid or unexpected labels found: {invalid_labels}. Dropping these rows.")
          # Optionally drop these rows or investigate further
          df_combined.dropna(subset=['encoded_label'], inplace=True)
          df_combined['encoded_label'] = df_combined['encoded_label'].astype(int) # Ensure int type after dropna
    else:
      df_combined['encoded_label'] = df_combined['encoded_label'].astype(int)


    print("Label encoding complete.")
    print(f"\nValue counts for 'label':\n{df_combined['label'].value_counts()}")
    print(f"\nValue counts for 'encoded_label':\n{df_combined['encoded_label'].value_counts()}")


    # --- Final Touches ---
    # Drop rows where processed_text is empty after cleaning
    empty_processed = (df_combined['processed_text'] == '').sum()
    if empty_processed > 0:
        print(f"Dropping {empty_processed} rows where processed_text became empty after cleaning.")
        df_combined = df_combined[df_combined['processed_text'] != '']

    # Select and reorder columns for the final output
    # Ensure all desired final columns exist before selecting
    final_columns_present = [col for col in final_columns if col in df_combined.columns]
    df_final = df_combined[final_columns_present].copy()

    # Drop duplicates based on the processed text to avoid identical articles
    initial_rows = len(df_final)
    df_final.drop_duplicates(subset=['processed_text'], keep='first', inplace=True)
    rows_dropped = initial_rows - len(df_final)
    if rows_dropped > 0:
        print(f"Dropped {rows_dropped} duplicate rows based on 'processed_text'.")


    print(f"\nFinal dataset shape: {df_final.shape}")
    print(f"Final dataset columns: {df_final.columns.tolist()}")
    # print("\nFinal dataset info:") # Uncomment for more detail
    # df_final.info()
    # print("\nFinal dataset head:") # Uncomment for more detail
    # print(df_final.head())

    # --- Save the Preprocessed Data ---
    try:
        df_final.to_csv(OUTPUT_CSV_PATH, index=False)
        print(f"\nSuccessfully saved combined and preprocessed data to '{OUTPUT_CSV_PATH}'")
    except Exception as e:
        print(f"\nError saving the final CSV file: {e}")

else:
    print("\nCould not process input files. Combined dataset is empty. Nothing to save.")

print("\n--- Data Preprocessing Script Finished ---")