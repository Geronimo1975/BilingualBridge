import os
import logging
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import openai

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)
app.secret_key = os.environ.get("SESSION_SECRET", "your-default-secret-key")

# Initialize Socket.IO with CORS support and Eventlet
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

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

# Keep the REST API endpoint for backward compatibility
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

        translation = perform_translation(text, source_language, target_language)
        return jsonify({"translation": translation})

    except Exception as e:
        logger.error(f"Translation error: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Function to perform translation
def perform_translation(text, source_language, target_language):
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
    
    return translation

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    logger.info("Client connected via Socket.IO")
    emit('connected', {'status': 'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info("Client disconnected from Socket.IO")

@socketio.on('translate_text')
def handle_translation_request(data):
    logger.debug(f"Received translation request via Socket.IO: {data}")
    conversation_id = data.get('conversation_id', None)
    
    try:
        text = data.get('text')
        source_language = data.get('source_language')
        target_language = data.get('target_language')
        
        if not text or not source_language or not target_language:
            emit('translation_error', {
                'error': 'Missing required parameters',
                'conversation_id': conversation_id
            })
            return
        
        # Emit event to show that translation is in progress
        emit('translation_in_progress', {
            'text': text,
            'source_language': source_language,
            'conversation_id': conversation_id
        })
        
        # Perform translation
        translation = perform_translation(text, source_language, target_language)
        
        # Emit result back to client
        emit('translation_result', {
            'original_text': text,
            'translation': translation,
            'source_language': source_language,
            'target_language': target_language,
            'conversation_id': conversation_id
        })
        logger.debug(f"Emitted translation result: {translation}")
        
    except Exception as e:
        logger.error(f"Socket.IO translation error: {str(e)}")
        emit('translation_error', {
            'error': str(e),
            'conversation_id': conversation_id
        })

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, use_reloader=True, log_output=True)
