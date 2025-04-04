# Import eventlet first to patch all libraries
import eventlet
eventlet.monkey_patch()

from server import app, socketio

if __name__ == "__main__":
    # Use socketio.run instead of app.run
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, use_reloader=True, log_output=True)
