#!/bin/bash
# Start the server with eventlet worker
python -m gunicorn --worker-class eventlet --bind 0.0.0.0:5000 --reuse-port --reload main:app
