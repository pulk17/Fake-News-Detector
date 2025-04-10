# Fake News Detection System

A full-stack application combining a DistilBERT-based classification model with fact-checking capabilities and explainable AI (XAI) features.

## Features

- 🧠 DistilBERT model for real/fake news classification
- 🔍 Integrated Google Fact Check API verification
- 📊 LIME (Local Interpretable Model-agnostic Explanations) for predictions
- 📈 Confidence metrics and probability distributions
- 💾 Feedback system for model improvement
- 🌓 Dark mode support
- 📚 Search history tracking

## Technologies

**Backend**:
- Python/Flask
- Transformers (DistilBERT)
- LIME
- Google Fact Check API

**Frontend**:
- React.js
- CSS3 (with CSS Variables)
- React Icons

## Installation

### Backend Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/pulk17/Fake-News-Detector
   cd Fake-News-Detector

2. **Install Python dependencies**

    ```bash
    pip install -r requirements.txt

3. **Environment Variables**

    Create .env file:

    ```env
    FACT_CHECK_API_KEY=your_google_api_key
    FLASK_APP=app.py

4. **Setting up Frontend**

    Make sure node is installed on your device.

    ```bash
    cd fake-news-detector
    npm install
    npm run dev

5. **Setting up backend**

    Make sure you have python installed and have installed the dependencies (Step 2).
    Open a new terminal.

    ```bash
    cd Fake-News-Detector
    flask run --host=0.0.0.0 --port=5000
    