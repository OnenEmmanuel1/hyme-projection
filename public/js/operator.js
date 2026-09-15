document.addEventListener('DOMContentLoaded', () => {
    const listenBtn = document.getElementById('listen-btn');
    const submitBtn = document.getElementById('submit-btn');
    const transcriptDisplay = document.getElementById('transcript-display');
    const feedbackDisplay = document.getElementById('feedback-display');
    
    // Global Topbar Status
    const statusDot = document.getElementById('global-status-dot');
    const statusText = document.getElementById('global-status-text');

    let currentTranscript = '';
    let currentConfidence = 0;

    function setStatus(state, msg) {
        statusDot.className = 'icds-status-dot';
        statusDot.classList.add(state);
        statusText.textContent = msg;
    }

    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        setStatus('error', 'API Not Supported');
        listenBtn.disabled = true;
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let isListening = false;

    listenBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
        } else {
            transcriptDisplay.value = '';
            transcriptDisplay.placeholder = 'Listening...';
            transcriptDisplay.classList.remove('has-text');
            feedbackDisplay.style.display = 'none';
            submitBtn.classList.remove('ready');
            
            try {
                recognition.start();
            } catch (e) {
                console.error(e);
            }
        }
    });

    recognition.onstart = () => {
        isListening = true;
        setStatus('listening', 'Listening...');
        listenBtn.classList.add('active');
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
                currentConfidence = event.results[i][0].confidence;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        const displayTxt = finalTranscript || interimTranscript;
        if (displayTxt) {
            transcriptDisplay.value = displayTxt;
            transcriptDisplay.classList.add('has-text');
            currentTranscript = displayTxt;
            submitBtn.classList.add('ready');
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setStatus('error', `Error: ${event.error}`);
        isListening = false;
        listenBtn.classList.remove('active');
        transcriptDisplay.value = '';
        transcriptDisplay.placeholder = 'Type or say a hymn number, title, or lyrics...';
        transcriptDisplay.classList.remove('has-text');
    };

    recognition.onend = () => {
        isListening = false;
        if (statusDot.classList.contains('listening')) {
            setStatus('idle', 'Idle');
        }
        listenBtn.classList.remove('active');
        
        // If we have text, keep it ready for submit
        if (!currentTranscript) {
            transcriptDisplay.value = '';
            transcriptDisplay.placeholder = 'Type or say a hymn number, title, or lyrics...';
            transcriptDisplay.classList.remove('has-text');
        }
    };

    submitBtn.addEventListener('click', () => {
        const text = transcriptDisplay.value.trim();
        if (text) {
            sendVoiceCommand(text, currentConfidence || 1.0);
        }
    });

    transcriptDisplay.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const text = transcriptDisplay.value.trim();
            if (text) {
                sendVoiceCommand(text, 1.0);
            }
        }
    });

    transcriptDisplay.addEventListener('input', () => {
        if (transcriptDisplay.value.trim()) {
            submitBtn.classList.add('ready');
        } else {
            submitBtn.classList.remove('ready');
        }
    });

    window.sendVoiceCommand = async function(text, confidence) {
        setStatus('processing', 'Processing...');
        feedbackDisplay.style.display = 'none';
        
        try {
            const response = await fetch('/api/voice-command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text, confidence })
            });
            
            const result = await response.json();
            
            feedbackDisplay.style.display = 'block';
            if (result.status === 'Matched') {
                feedbackDisplay.textContent = `Matched: Hymn ${result.hymn.HymnNumber} - ${result.hymn.Title}`;
                feedbackDisplay.className = 'icds-feedback text-center mb-5 success';
                
                // Optional: reset input
                currentTranscript = '';
                transcriptDisplay.value = '';
                transcriptDisplay.placeholder = 'Type or say a hymn number, title, or lyrics...';
                transcriptDisplay.classList.remove('has-text');
                submitBtn.classList.remove('ready');
                
            } else {
                feedbackDisplay.textContent = result.message || 'Hymn not found.';
                feedbackDisplay.className = 'icds-feedback text-center mb-5 error';
            }
        } catch (error) {
            console.error('Error sending command:', error);
            feedbackDisplay.style.display = 'block';
            feedbackDisplay.textContent = 'Server error. Could not process command.';
            feedbackDisplay.className = 'icds-feedback text-center mb-5 error';
        }
        
        setTimeout(() => {
            if (!isListening && !statusDot.classList.contains('error')) {
                setStatus('idle', 'Idle');
            }
        }, 2000);
    }
});
