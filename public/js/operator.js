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

        // Auto submit if we have a final transcript
        if (finalTranscript.trim()) {
            sendVoiceCommand(finalTranscript.trim(), currentConfidence || 1.0);
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

    let submitTimeout = null;
    submitBtn.addEventListener('click', () => {
        clearTimeout(submitTimeout);
        const text = transcriptDisplay.value.trim();
        if (text) {
            sendVoiceCommand(text, currentConfidence || 1.0);
        }
    });

    transcriptDisplay.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(submitTimeout);
            const text = transcriptDisplay.value.trim();
            if (text) {
                sendVoiceCommand(text, 1.0);
            }
        }
    });

    transcriptDisplay.addEventListener('input', () => {
        clearTimeout(submitTimeout);
        if (transcriptDisplay.value.trim()) {
            submitBtn.classList.add('ready');
            submitTimeout = setTimeout(() => {
                sendVoiceCommand(transcriptDisplay.value.trim(), 1.0);
            }, 800);
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
                feedbackDisplay.className = 'icds-feedback text-center mb-4 success';
                
                // Show inline display
                const inlineDisplay = document.getElementById('inline-hymn-display');
                if (inlineDisplay) {
                    const inlineTitle = document.getElementById('inline-hymn-title');
                    const inlineLyrics = document.getElementById('inline-hymn-lyrics');
                    let inlinePrev = document.getElementById('inline-btn-prev');
                    let inlineNext = document.getElementById('inline-btn-next');
                    
                    const inlineFullscreen = document.getElementById('inline-btn-fullscreen');
                    
                    inlineDisplay.style.display = 'block';
                    inlineFullscreen.style.display = 'block';
                    inlineTitle.textContent = `${result.hymn.HymnNumber}. ${result.hymn.Title}`;
                    
                    let currentVerses = [];
                    let currentVerseIndex = 0;
                    
                    const hymn = result.hymn;
                    if (hymn.stanzas && hymn.stanzas.length > 0) {
                        currentVerses = hymn.stanzas.map(s => ({
                            verseNumber: s.stanza_number,
                            text: s.content,
                            isChorus: s.is_chorus
                        }));
                    } else if (hymn.VersesJSON) {
                        currentVerses = typeof hymn.VersesJSON === 'string' ? JSON.parse(hymn.VersesJSON) : hymn.VersesJSON;
                    }
                    
                    const renderInlineVerse = () => {
                        if (!currentVerses || currentVerses.length === 0) return;
                        const v = currentVerses[currentVerseIndex];
                        inlineLyrics.innerHTML = `
                            <div style="font-size: 0.5em; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; color: var(--icds-primary);">
                                Verse ${v.verseNumber}
                            </div>
                            <div>
                                ${v.text.split('\\n').map(l => l.trim()).join('<br>')}
                            </div>
                        `;
                        inlinePrev.style.display = currentVerses.length > 1 ? 'block' : 'none';
                        inlineNext.style.display = currentVerses.length > 1 ? 'block' : 'none';
                        inlinePrev.disabled = currentVerseIndex === 0;
                        inlineNext.disabled = currentVerseIndex === currentVerses.length - 1;
                        inlinePrev.style.opacity = inlinePrev.disabled ? '0.5' : '1';
                        inlineNext.style.opacity = inlineNext.disabled ? '0.5' : '1';
                    };
                    
                    if (currentVerses.length > 0) {
                        renderInlineVerse();
                        
                        // Clean event listeners
                        const newPrev = inlinePrev.cloneNode(true);
                        const newNext = inlineNext.cloneNode(true);
                        inlinePrev.parentNode.replaceChild(newPrev, inlinePrev);
                        inlineNext.parentNode.replaceChild(newNext, inlineNext);
                        
                        newPrev.addEventListener('click', () => {
                            if (currentVerseIndex > 0) { 
                                currentVerseIndex--; 
                                renderInlineVerse(); 
                                fetch('/api/navigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prev', index: currentVerseIndex }) });
                            }
                        });
                        newNext.addEventListener('click', () => {
                            if (currentVerseIndex < currentVerses.length - 1) { 
                                currentVerseIndex++; 
                                renderInlineVerse(); 
                                fetch('/api/navigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'next', index: currentVerseIndex }) });
                            }
                        });
                    } else {
                        inlineLyrics.innerHTML = hymn.Lyrics ? hymn.Lyrics.replace(/\\n/g, '<br>') : "No lyrics available.";
                        inlinePrev.style.display = 'none';
                        inlineNext.style.display = 'none';
                    }
                    
                    // Fullscreen logic
                    const newFullscreen = inlineFullscreen.cloneNode(true);
                    inlineFullscreen.parentNode.replaceChild(newFullscreen, inlineFullscreen);
                    
                    newFullscreen.addEventListener('click', () => {
                        if (!document.fullscreenElement) {
                            inlineDisplay.requestFullscreen().catch(err => {
                                console.error(`Error attempting to enable fullscreen: ${err.message}`);
                            });
                        } else {
                            document.exitFullscreen();
                        }
                    });
                }
                
                // Optional: reset input
                currentTranscript = '';
                transcriptDisplay.value = '';
                transcriptDisplay.placeholder = 'Type or say a hymn number, title, or lyrics...';
                transcriptDisplay.classList.remove('has-text');
                submitBtn.classList.remove('ready');
                
            } else {
                feedbackDisplay.textContent = result.message || 'Hymn not found.';
                feedbackDisplay.className = 'icds-feedback text-center mb-4 error';
                const inlineDisplay = document.getElementById('inline-hymn-display');
                if (inlineDisplay) inlineDisplay.style.display = 'none';
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

    // HDMI / Projector Auto-Detection using Window Management API
    const btnDetectHdmi = document.getElementById('btn-detect-hdmi');
    let externalWindow = null;

    if (btnDetectHdmi) {
        if (!('getScreenDetails' in window)) {
            btnDetectHdmi.style.display = 'none';
        } else {
            btnDetectHdmi.addEventListener('click', async () => {
                try {
                    const screenDetails = await window.getScreenDetails();
                    btnDetectHdmi.innerHTML = '<i data-lucide="check-circle"></i> Monitoring HDMI...';
                    btnDetectHdmi.classList.replace('btn-outline-info', 'btn-success');
                    if (window.lucide) window.lucide.createIcons();
                    
                    const manageDisplayWindow = () => {
                        const externalScreens = screenDetails.screens.filter(s => s !== screenDetails.currentScreen);
                        if (externalScreens.length > 0) {
                            const extScreen = externalScreens[0];
                            if (!externalWindow || externalWindow.closed) {
                                const windowFeatures = `left=${extScreen.availLeft},top=${extScreen.availTop},width=${extScreen.availWidth},height=${extScreen.availHeight},fullscreen=yes,menubar=no,toolbar=no,location=no,status=no`;
                                externalWindow = window.open('/display', 'ProjectorDisplay', windowFeatures);
                            }
                        } else {
                            if (externalWindow && !externalWindow.closed) {
                                externalWindow.close();
                                externalWindow = null;
                            }
                        }
                    };
                    
                    manageDisplayWindow();
                    screenDetails.addEventListener('screenschange', manageDisplayWindow);
                    
                } catch (err) {
                    console.error('HDMI Detection Error:', err);
                    alert('Permission to manage screens was denied. Please allow Window Management permissions in your browser.');
                }
            });
        }
    }
});
