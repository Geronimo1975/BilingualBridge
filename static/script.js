document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const clearBtn = document.getElementById('clearBtn');
    const germanText = document.getElementById('germanText');
    const englishText = document.getElementById('englishText');
    const errorContainer = document.getElementById('errorContainer');
    const germanIndicator = document.getElementById('germanIndicator');
    const englishIndicator = document.getElementById('englishIndicator');

    // Speech recognition variables
    let recognition = null;
    let isRecording = false;
    let currentLanguage = null;
    let conversationId = 0;
    let micPermissionGranted = false;
    
    // Socket.IO setup
    let socket = null;
    let isSocketConnected = false;
    
    // Initialize Socket.IO connection
    function initializeSocket() {
        // Connect to Socket.IO server
        socket = io();
        
        // Connection event
        socket.on('connect', function() {
            console.log('Connected to Socket.IO server');
            isSocketConnected = true;
            hideError();
        });
        
        // Disconnection event
        socket.on('disconnect', function() {
            console.log('Disconnected from Socket.IO server');
            isSocketConnected = false;
            showError('Connection to server lost. Please reload the page.');
        });
        
        // Translation in progress event
        socket.on('translation_in_progress', function(data) {
            console.log('Translation in progress:', data);
            // You could add a loading indicator here if needed
        });
        
        // Translation result event
        socket.on('translation_result', function(data) {
            console.log('Translation result received:', data);
            
            const sourceLanguage = data.source_language;
            const targetLanguage = data.target_language;
            
            // Add the translated text to the appropriate column
            addMessageEntry(
                targetLanguage === 'German' ? germanText : englishText, 
                data.translation, 
                'translated-text'
            );
        });
        
        // Translation error event
        socket.on('translation_error', function(data) {
            console.error('Translation error:', data.error);
            showError('Error during translation: ' + data.error);
        });
    }
    
    // Initialize Socket.IO when the page loads
    initializeSocket();

    // Check for browser compatibility
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showError('Your browser does not support Speech Recognition. Please use Chrome, Edge, or Safari.');
        startBtn.disabled = true;
        return;
    }

    // Attempt to get microphone permissions right away
    requestMicrophonePermission();

    // Initialize speech recognition
    function initSpeechRecognition() {
        // Use the correct Speech Recognition API based on browser
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        // Configure recognition
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        
        // Default to German recognition to improve German detection
        // We're setting this to German first since that was the problem area
        recognition.lang = 'de-DE';
        
        // Set up event handlers
        recognition.onstart = function() {
            console.log('Speech recognition started');
            isRecording = true;
            startBtn.disabled = true;
            stopBtn.disabled = false;
            hideError();
        };

        recognition.onend = function() {
            console.log('Speech recognition ended');
            if (isRecording) {
                // If we're still supposed to be recording, restart it
                // This is a workaround for the recognition service stopping automatically
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Error restarting recognition:', e);
                }
            }
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                // Don't show error for no-speech as it's common
                return;
            }
            
            let errorMessage = 'Error with speech recognition: ' + event.error;
            if (event.error === 'network') {
                errorMessage = 'Network error occurred. Please check your internet connection.';
            } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
                errorMessage = 'Microphone access denied. Please allow microphone permission and reload the page.';
                startBtn.disabled = true;
                // Try requesting permission again
                requestMicrophonePermission();
            }
            
            showError(errorMessage);
        };

        // Process speech results
        recognition.onresult = handleSpeechResult;
    }

    // Request microphone permission
    function requestMicrophonePermission() {
        hideError();
        
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(function(stream) {
                    // Permission granted, stop the tracks
                    stream.getTracks().forEach(track => track.stop());
                    console.log('Microphone permission granted');
                    micPermissionGranted = true;
                    startBtn.disabled = false;
                    hideError();
                })
                .catch(function(err) {
                    console.error('Microphone permission error:', err);
                    showError('Microphone access is required. Please click "Allow" when prompted for microphone access.');
                    startBtn.disabled = true;
                    micPermissionGranted = false;
                });
        } else {
            console.error('getUserMedia not supported');
            showError('Your browser does not support microphone access. Please use a modern browser like Chrome or Edge.');
            startBtn.disabled = true;
        }
    }

    // Process speech recognition results
    function handleSpeechResult(event) {
        const results = event.results;
        for (let i = event.resultIndex; i < results.length; i++) {
            // Check if this is a final result
            if (results[i].isFinal) {
                const transcript = results[i][0].transcript.trim();
                if (transcript) {
                    // Detect language and process text
                    detectLanguageAndProcess(transcript);
                    
                    // Toggle recognition language for better results next time
                    toggleRecognitionLanguage();
                }
            }
        }
    }

    // Toggle recognition language between German and English
    function toggleRecognitionLanguage() {
        if (recognition) {
            if (recognition.lang === 'de-DE') {
                recognition.lang = 'en-US';
                console.log('Switched recognition to English (en-US)');
            } else {
                recognition.lang = 'de-DE';
                console.log('Switched recognition to German (de-DE)');
            }
        }
    }

    // Detect language and process text accordingly
    function detectLanguageAndProcess(text) {
        // Enhanced German language detection with more comprehensive patterns
        const germanSpecialChars = /[äöüßÄÖÜ]/;
        const germanCommonWords = /\b(und|der|die|das|ich|bin|ist|wie|du|für|von|mit|in|zu|nicht|den|dem|ein|eine|habe|wir|sie|es|auf|aber|oder|wenn|dann|schon|auch|mein|dein|sein|ihr|unser|euer|was|wer|wo|warum|weil|dass|ja|nein|bitte|danke|gut|schlecht|heute|morgen|gestern|jetzt)\b/i;
        
        // Check for German special characters first
        const hasGermanChars = germanSpecialChars.test(text);
        
        // Count German common words
        const germanMatches = text.match(germanCommonWords);
        const germanWordCount = germanMatches ? germanMatches.length : 0;
        
        // Decide language based on special characters or word count
        const isGerman = hasGermanChars || germanWordCount > 0;
        
        console.log("Language detection:", text, 
                    isGerman ? "German" : "English", 
                    "German chars:", hasGermanChars, 
                    "German word count:", germanWordCount);
        
        const sourceLanguage = isGerman ? 'German' : 'English';
        const targetLanguage = isGerman ? 'English' : 'German';
        
        // Update the visual indicator
        updateLanguageIndicator(sourceLanguage);
        
        // Add the original text to the appropriate column
        addMessageEntry(
            isGerman ? germanText : englishText, 
            text, 
            'original-text'
        );

        // Translate the text using WebSockets if connected
        if (isSocketConnected) {
            // Use Socket.IO for real-time translation
            socket.emit('translate_text', {
                text: text,
                source_language: sourceLanguage,
                target_language: targetLanguage,
                conversation_id: conversationId
            });
        } else {
            // Fallback to REST API if Socket.IO is not connected
            translateTextREST(text, sourceLanguage, targetLanguage)
                .then(translation => {
                    // Add the translated text to the opposite column
                    addMessageEntry(
                        isGerman ? englishText : germanText, 
                        translation, 
                        'translated-text'
                    );
                })
                .catch(error => {
                    console.error('Translation error:', error);
                    showError('Error during translation: ' + error.message);
                });
        }
    }

    // Send text to server for translation using REST API (fallback)
    async function translateTextREST(text, sourceLanguage, targetLanguage) {
        try {
            const response = await fetch('/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    source_language: sourceLanguage,
                    target_language: targetLanguage
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Translation failed');
            }
            
            return data.translation;
        } catch (error) {
            console.error('Error translating text:', error);
            throw error;
        }
    }

    // Add a message entry to the conversation container
    function addMessageEntry(container, text, className) {
        const entry = document.createElement('div');
        entry.classList.add('message-entry', className);
        entry.textContent = text;
        
        // Add a timestamp
        const timestamp = document.createElement('small');
        timestamp.classList.add('text-muted', 'd-block', 'mt-1');
        timestamp.textContent = new Date().toLocaleTimeString();
        entry.appendChild(timestamp);
        
        container.appendChild(entry);
        
        // Scroll to the bottom
        container.scrollTop = container.scrollHeight;
    }

    // Update the language indicator
    function updateLanguageIndicator(language) {
        germanIndicator.classList.toggle('d-none', language !== 'German');
        englishIndicator.classList.toggle('d-none', language !== 'English');
        
        // After 2 seconds, hide the indicators
        setTimeout(() => {
            germanIndicator.classList.add('d-none');
            englishIndicator.classList.add('d-none');
        }, 2000);
    }

    // Display error message
    function showError(message) {
        errorContainer.textContent = message;
        errorContainer.classList.remove('d-none');
    }

    // Hide error message
    function hideError() {
        errorContainer.classList.add('d-none');
    }

    // Start conversation button
    startBtn.addEventListener('click', function() {
        if (!micPermissionGranted) {
            requestMicrophonePermission();
            return;
        }
        
        try {
            initSpeechRecognition();
            recognition.start();
            conversationId++;
        } catch (e) {
            console.error('Error starting recognition:', e);
            showError('Failed to start speech recognition: ' + e.message);
        }
    });

    // Stop conversation button
    stopBtn.addEventListener('click', function() {
        if (recognition) {
            recognition.stop();
        }
        isRecording = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        
        // Hide indicators
        germanIndicator.classList.add('d-none');
        englishIndicator.classList.add('d-none');
    });

    // Clear conversation button
    clearBtn.addEventListener('click', function() {
        germanText.innerHTML = '';
        englishText.innerHTML = '';
        hideError();
    });
});
