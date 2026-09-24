document.addEventListener('DOMContentLoaded', () => {
    const unlockOverlay = document.getElementById('unlock-overlay');
    const unlockBtn = document.getElementById('unlock-btn');
    const displayContainer = document.getElementById('display-container');
    
    const idleState = document.getElementById('idle-state');
    const notFoundState = document.getElementById('not-found-state');
    const hymnState = document.getElementById('hymn-state');
    
    const hymnNumber = document.getElementById('hymn-number');
    const hymnTitle = document.getElementById('hymn-title');
    const hymnLyrics = document.getElementById('hymn-lyrics');
    const btnPrevVerse = document.getElementById('btn-prev-verse');
    const btnNextVerse = document.getElementById('btn-next-verse');

    let currentVerses = [];
    let currentVerseIndex = 0;

    function renderCurrentVerse() {
        if (!currentVerses || currentVerses.length === 0) return;
        const v = currentVerses[currentVerseIndex];
        hymnLyrics.innerHTML = `
            <div class="verse-block" style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
                <div class="verse-number text-muted" style="font-size: 0.5em; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px;">
                    Verse ${v.verseNumber}
                </div>
                <div style="text-align: center;">
                    ${v.text.split('\n').map(l => l.trim()).join('<br>')}
                </div>
            </div>`;
    }

    function updateButtons() {
        // Buttons are hidden on projection screen as per requirements
        btnPrevVerse.style.display = 'none';
        btnNextVerse.style.display = 'none';
    }

    // Automatically initiate display screen without waiting for button click
    unlockOverlay.style.display = 'none';
    displayContainer.style.display = 'flex';
    
    // Attempt fullscreen, though browsers usually block this without user interaction
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(e => console.log('Fullscreen requires interaction.'));
    }

    // Keep unlockBtn around just in case user needs to click for fullscreen manually
    unlockBtn.addEventListener('click', () => {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(e => console.log('Fullscreen error:', e));
        }
    });

    // Socket.IO setup
    const socket = io();

    socket.on('hymn_match', (data) => {
        // Hide all states
        idleState.classList.remove('active');
        notFoundState.classList.remove('active');
        hymnState.classList.remove('active');

        if (data.status === 'Matched') {
            const hymn = data.hymn;
            
            hymnNumber.textContent = hymn.HymnNumber;
            hymnTitle.textContent = hymn.Title;
            
            // Format lyrics
            if (hymn.stanzas && hymn.stanzas.length > 0) {
                // We use hymn.stanzas from the new schema
                currentVerses = hymn.stanzas.map(s => ({
                    verseNumber: s.stanza_number,
                    text: s.content,
                    isChorus: s.is_chorus
                }));
                
                // If a specific stanza was requested, jump to it
                currentVerseIndex = 0;
                if (hymn.targetStanza) {
                    if (hymn.targetStanza === 'chorus') {
                        const chorusIndex = currentVerses.findIndex(v => v.isChorus);
                        if (chorusIndex !== -1) currentVerseIndex = chorusIndex;
                    } else {
                        const sIndex = currentVerses.findIndex(v => v.verseNumber === hymn.targetStanza);
                        if (sIndex !== -1) currentVerseIndex = sIndex;
                    }
                }
                
                renderCurrentVerse();
                
                renderCurrentVerse();
                updateButtons();
            } else if (hymn.VersesJSON) {
                currentVerses = typeof hymn.VersesJSON === 'string' ? JSON.parse(hymn.VersesJSON) : hymn.VersesJSON;
                currentVerseIndex = 0;
                
                renderCurrentVerse();
                updateButtons();
            } else if (hymn.Lyrics) {
                // Fallback for old lyrics column
                btnPrevVerse.style.display = 'none';
                btnNextVerse.style.display = 'none';
                hymnLyrics.innerHTML = hymn.Lyrics.replace(/\n/g, '<br>');
            } else {
                hymnLyrics.innerHTML = "No lyrics available.";
            }
            
            hymnState.classList.add('active');
            
            // Audible confirmation (Text-to-Speech)
            if ('speechSynthesis' in window) {
                // Cancel any ongoing speech
                window.speechSynthesis.cancel();
                const msg = new SpeechSynthesisUtterance(`Displaying hymn ${hymn.hymn_number}, ${hymn.title}`);
                // Optional: set properties
                msg.rate = 0.9;
                window.speechSynthesis.speak(msg);
            }
            
        } else {
            notFoundState.classList.add('active');
            
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const msg = new SpeechSynthesisUtterance(`Hymn not found.`);
                msg.rate = 0.9;
                window.speechSynthesis.speak(msg);
            }
        }
    });
    
    socket.on('change_verse', (data) => {
        if (typeof data.index === 'number' && currentVerses && currentVerses.length > 0) {
            if (data.index >= 0 && data.index < currentVerses.length) {
                currentVerseIndex = data.index;
                renderCurrentVerse();
            }
        }
    });
});
