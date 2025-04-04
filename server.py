import os
import logging
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import openai

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)
app.secret_key = os.environ.get("SESSION_SECRET", "your-default-secret-key")

# Initialize OpenAI client
# The newest OpenAI model is "gpt-4o" which was released May 13, 2024.
# Do not change this unless explicitly requested by the user
openai_api_key = os.environ.get("OPENAI_API_KEY")
if not openai_api_key:
    logger.warning("OPENAI_API_KEY not found in environment variables")

client = openai.OpenAI(api_key=openai_api_key)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/translate', methods=['POST'])
def translate():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        text = data.get('text')
        source_language = data.get('source_language')
        target_language = data.get('target_language')

        if not text or not source_language or not target_language:
            return jsonify({"error": "Missing required parameters"}), 400

        logger.debug(f"Translating: {text} from {source_language} to {target_language}")

        # Construct prompt for OpenAI
        prompt = f"Translate the following {source_language} text to {target_language}. Only return the translation without explanations or additional text:\n\n{text}"

        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a professional translator between German and English."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500
        )

        # Extract translation
        translation = response.choices[0].message.content.strip()
        logger.debug(f"Translation result: {translation}")

        return jsonify({"translation": translation})

    except Exception as e:
        logger.error(f"Translation error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
