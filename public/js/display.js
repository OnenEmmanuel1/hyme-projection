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
                    ${v.text.trim().replace(/\n/g, '<br>')}
                </div>
            </div>`;
    }

    function updateButtons() {
        btnPrevVerse.disabled = currentVerseIndex === 0;
        btnNextVerse.disabled = currentVerseIndex === currentVerses.length - 1;
        
        btnPrevVerse.style.opacity = btnPrevVerse.disabled ? '0.5' : '1';
        btnNextVerse.style.opacity = btnNextVerse.disabled ? '0.5' : '1';
    }

    btnPrevVerse.addEventListener('click', () => {
        if (currentVerseIndex > 0) {
            currentVerseIndex--;
            renderCurrentVerse();
            updateButtons();
        }
    });

    btnNextVerse.addEventListener('click', () => {
        if (currentVerseIndex < currentVerses.length - 1) {
            currentVerseIndex++;
            renderCurrentVerse();
            updateButtons();
        }
    });

    // Start Display (Requires click for Fullscreen API)
    unlockBtn.addEventListener('click', () => {
        unlockOverlay.style.display = 'none';
        displayContainer.style.display = 'flex';
        
        // Go full screen for the projection display
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
            if (hymn.VersesJSON) {
                // If it's a string (e.g. from a raw query), parse it. Otherwise use it directly.
                currentVerses = typeof hymn.VersesJSON === 'string' ? JSON.parse(hymn.VersesJSON) : hymn.VersesJSON;
                currentVerseIndex = 0;
                
                renderCurrentVerse();
                
                if (currentVerses.length > 1) {
                    btnPrevVerse.style.display = 'block';
                    btnNextVerse.style.display = 'block';
                    updateButtons();
                } else {
                    btnPrevVerse.style.display = 'none';
                    btnNextVerse.style.display = 'none';
                }
            } else {
                // Fallback for old lyrics column
                btnPrevVerse.style.display = 'none';
                btnNextVerse.style.display = 'none';
                hymnLyrics.innerHTML = hymn.Lyrics.replace(/\n/g, '<br>');
            }
            
            hymnState.classList.add('active');
            // Text-to-Speech has been removed per user request
            
        } else {
            notFoundState.classList.add('active');
        }
    });
});
