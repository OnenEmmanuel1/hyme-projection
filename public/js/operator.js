document.addEventListener('DOMContentLoaded', () => {
    const listenBtn = document.getElementById('listen-btn');
    const submitBtn = document.getElementById('submit-btn');
    const transcriptDisplay = document.getElementById('transcript-display');
    const feedbackDisplay = document.getElementById('feedback-display');
    const advanceControls = document.createElement('div');
    advanceControls.className = 'd-flex gap-2 mt-2';
    advanceControls.innerHTML = '<button type="button" class="btn btn-outline-secondary btn-sm" data-advance="pause">Pause auto-advance</button><button type="button" class="btn btn-outline-secondary btn-sm" data-advance="resume">Resume / restart timer</button>';
    const inlineHost = document.getElementById('inline-hymn-display');
    if (inlineHost) inlineHost.appendChild(advanceControls);
    let controlInlineAdvance = () => {};
    const pauseAdvanceButton = advanceControls.querySelector('[data-advance="pause"]');
    const resumeAdvanceButton = advanceControls.querySelector('[data-advance="resume"]');
    advanceControls.addEventListener('click', e => {
        const action = e.target.dataset.advance;
        if (!action) return;
        controlInlineAdvance(action);
        fetch('/api/advance-control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    });
    
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

    const voiceSocket = io();
    let isListening = false, audioContext, mediaStream, processor, source, recognizerTimeout = null;
    let voiceSettings = { mode: 'Timer', silenceThresholdSeconds: 2.5 };
    function pcm16(floatSamples) {
        const buffer = new ArrayBuffer(floatSamples.length * 2), view = new DataView(buffer);
        for (let i = 0; i < floatSamples.length; i++) view.setInt16(i * 2, Math.max(-1, Math.min(1, floatSamples[i])) * 32767, true);
        return buffer;
    }
    async function stopListening() {
        isListening = false; clearTimeout(recognizerTimeout); voiceSocket.emit('voice_stop');
        if (processor) processor.disconnect(); if (source) source.disconnect();
        if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
        if (audioContext) await audioContext.close();
        listenBtn.classList.remove('active'); setStatus('idle', 'Idle');
    }
    listenBtn.addEventListener('click', async () => {
        if (isListening) { await stopListening(); return; }
        {
            transcriptDisplay.value = '';
            transcriptDisplay.placeholder = 'Starting offline recognizer...';
            transcriptDisplay.classList.remove('has-text');
            feedbackDisplay.style.display = 'none';
            submitBtn.classList.remove('ready');
            
            try {
                const response = await fetch('/api/voice-grammar');
                if (!response.ok) throw new Error('Could not load hymn vocabulary');
                mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioContext = new AudioContext();
                source = audioContext.createMediaStreamSource(mediaStream);
                processor = audioContext.createScriptProcessor(4096, 1, 1);
                processor.onaudioprocess = event => {
                    const samples = event.inputBuffer.getChannelData(0);
                    const ratio = audioContext.sampleRate / 16000;
                    const downsampled = new Float32Array(Math.floor(samples.length / ratio));
                    for (let i = 0; i < downsampled.length; i++) downsampled[i] = samples[Math.floor(i * ratio)];
                    voiceSocket.emit('voice_audio', pcm16(downsampled), voiceSettings);
                };
                source.connect(processor); processor.connect(audioContext.destination);
                voiceSocket.emit('voice_start');
                isListening = true; setStatus('listening', 'Listening offline...'); listenBtn.classList.add('active');
                transcriptDisplay.placeholder = 'Listening offline...';
                recognizerTimeout = setTimeout(async () => {
                    if (isListening) {
                        await stopListening();
                        const message = 'Offline recognition is unavailable. Check that Vosk and its local model are installed on the server.';
                        setStatus('error', message); transcriptDisplay.placeholder = message;
                    }
                }, 60000);
            } catch (e) {
                console.error(e); await stopListening();
                const message = `Offline voice unavailable: ${e.message}`;
                setStatus('error', message); transcriptDisplay.placeholder = message;
            }
        }
    });
    voiceSocket.on('voice_ready', () => { clearTimeout(recognizerTimeout); setStatus('listening', 'Vosk offline ready'); });
    voiceSocket.on('voice_error', async data => {
        const reason = data.message || 'Offline recognizer unavailable.';
        await stopListening(); setStatus('error', reason); transcriptDisplay.placeholder = reason;
    });
    voiceSocket.on('voice_transcript', data => {
        transcriptDisplay.value = data.text; currentTranscript = data.text; transcriptDisplay.classList.add('has-text'); submitBtn.classList.add('ready');
        if (data.final) sendVoiceCommand(data.text, 1);
    });
    voiceSocket.on('silence_advance', () => {
        const next = document.getElementById('inline-btn-next'); if (next && !next.disabled) next.click();
    });

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
                    let inlineAdvanceTimer = null;
                    let inlineAdvancePaused = false;
                    pauseAdvanceButton.textContent = 'Pause auto-advance';
                    resumeAdvanceButton.textContent = 'Resume / restart timer';
                    const autoSettings = result.hymn.autoAdvanceSettings || { mode: 'Timer', secondsPerVerse: 28 };
                    const resetInlineTimer = () => {
                        clearTimeout(inlineAdvanceTimer);
                        if (inlineAdvancePaused || !['Timer', 'Both'].includes(autoSettings.mode)) return;
                        inlineAdvanceTimer = setTimeout(() => {
                            if (currentVerseIndex < currentVerses.length - 1) {
                                currentVerseIndex++;
                                renderInlineVerse();
                                fetch('/api/navigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'next', index: currentVerseIndex }) });
                            }
                        }, Math.max(5, Number(autoSettings.secondsPerVerse) || 28) * 1000);
                    };
                    controlInlineAdvance = action => {
                        if (action === 'pause') {
                            inlineAdvancePaused = true; clearTimeout(inlineAdvanceTimer);
                            pauseAdvanceButton.textContent = 'Auto-advance paused';
                        }
                        if (action === 'resume' || action === 'restart') {
                            inlineAdvancePaused = false; resetInlineTimer();
                            pauseAdvanceButton.textContent = 'Pause auto-advance';
                            resumeAdvanceButton.textContent = 'Timer restarted';
                            setTimeout(() => { resumeAdvanceButton.textContent = 'Resume / restart timer'; }, 2000);
                        }
                    };
                    
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
                        resetInlineTimer();
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
                
            } else if (result.status === 'Command') {
                feedbackDisplay.textContent = `Executed Command: ${result.action.replace('_', ' ')}`;
                feedbackDisplay.className = 'icds-feedback text-center mb-4 success';
                
                // Sync the local inline display
                if (result.action === 'next_verse') {
                    const inlineNext = document.getElementById('inline-btn-next');
                    if (inlineNext && !inlineNext.disabled) inlineNext.click();
                } else if (result.action === 'prev_verse') {
                    const inlinePrev = document.getElementById('inline-btn-prev');
                    if (inlinePrev && !inlinePrev.disabled) inlinePrev.click();
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
