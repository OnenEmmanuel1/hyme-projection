const fs = require('fs');
const path = require('path');
const pool = require('./config/database');

const hymnsDir = path.join(__dirname, 'hyme 1');

async function importHymns() {
    const files = fs.readdirSync(hymnsDir).filter(f => f.endsWith('.txt'));
    let count = 0;
    let unnumberedCounter = 0;
    for (const file of files) {
        const filePath = path.join(hymnsDir, file);
        const text = fs.readFileSync(filePath, 'utf-8');

        // Extract hymn number
        let hymnNumber = null;
        let title = '';

        const nameMatch = file.match(/^(\d+)\.\s*(.*)\.txt$/i);
        const hymmalMatch = file.match(/^hymmal\s*(\d+)\.txt$/i);
        
        if (nameMatch) {
            hymnNumber = parseInt(nameMatch[1], 10);
            title = nameMatch[2].trim();
        } else if (hymmalMatch) {
            hymnNumber = parseInt(hymmalMatch[1], 10);
        } else {
            const genericMatch = file.match(/^(\d+)(.*)\.txt$/i);
            if (genericMatch) {
                hymnNumber = parseInt(genericMatch[1], 10);
                title = genericMatch[2].replace(/^\.\s*/, '').trim();
            }
        }

        if (!hymnNumber) {
            unnumberedCounter++;
            hymnNumber = 10000 + unnumberedCounter;
            title = file.replace(/\.txt$/i, '').trim();
            console.log(`Assigning number ${hymnNumber} to unnumbered file: ${file}`);
        }

        // Parse stanzas
        const lines = text.split(/\r?\n/);
        const stanzas = [];
        let currentStanza = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length === 0) {
                if (currentStanza) {
                    stanzas.push(currentStanza);
                    currentStanza = null;
                }
                continue;
            }

            const verseMatch = line.match(/^(\d+)\s*[:\.]\s*(.*)$/);
            const chorusMatch = line.match(/^(?:Chorus|Refrain)\s*[:\.]\s*(.*)$/i);

            if (verseMatch) {
                if (currentStanza) stanzas.push(currentStanza);
                currentStanza = {
                    number: parseInt(verseMatch[1], 10),
                    isChorus: false,
                    content: verseMatch[2] ? verseMatch[2] + '\n' : ''
                };
            } else if (chorusMatch) {
                if (currentStanza) stanzas.push(currentStanza);
                currentStanza = {
                    number: null,
                    isChorus: true,
                    content: chorusMatch[1] ? chorusMatch[1] + '\n' : ''
                };
            } else {
                if (!currentStanza) {
                    // It's a block of text without a number.
                    // If it's the very first block, it might be verse 1 without a number
                    if (stanzas.length === 0 && !title && i === 0) {
                        // Sometimes the first line is the title
                        // We will set the title later if not found.
                    }
                    currentStanza = {
                        number: stanzas.filter(s => !s.isChorus).length + 1,
                        isChorus: stanzas.length > 0, // Assume chorus if not first block and no number
                        content: ''
                    };
                }
                currentStanza.content += line + '\n';
            }
        }
        if (currentStanza) stanzas.push(currentStanza);

        // Fix missing titles
        if (!title && stanzas.length > 0) {
            const firstLine = stanzas[0].content.split('\n')[0].trim();
            title = firstLine;
        }
        if (!title) title = `Hymn ${hymnNumber}`;

        title = title.substring(0, 100);

        try {
            // Delete existing hymn if any to avoid duplicates
            await pool.query('DELETE FROM hymns WHERE hymn_number = ?', [hymnNumber]);

            const [result] = await pool.query(
                'INSERT INTO hymns (hymn_number, title) VALUES (?, ?)',
                [hymnNumber, title]
            );
            const hymnId = result.insertId;

            let actualStanzaNumber = 1;
            for (const stanza of stanzas) {
                const sNumber = stanza.isChorus ? actualStanzaNumber : (stanza.number || actualStanzaNumber);
                await pool.query(
                    'INSERT INTO hymn_stanzas (hymn_id, stanza_number, is_chorus, content) VALUES (?, ?, ?, ?)',
                    [hymnId, sNumber, stanza.isChorus, stanza.content.trim()]
                );
                actualStanzaNumber++;
            }
            count++;
        } catch (e) {
            console.error(`Error importing ${file}:`, e);
        }
    }

    console.log(`Imported ${count} hymns successfully.`);
    process.exit(0);
}

importHymns();
