const pool = require('../config/database');
const levenshtein = require('fast-levenshtein');
const { wordsToNumbers } = require('words-to-numbers');
const HymnApiService = require('./hymnApiService');

const FILLER_WORDS = ['please', 'play', 'show', 'hymn', 'number', 'project', 'display', 'me', 'sing'];

async function matchCommand(rawCommand) {
    if (!rawCommand) return null;

    let processedCommand = wordsToNumbers(rawCommand, { impliedHundreds: true }) || rawCommand;
    processedCommand = processedCommand.toString();

    let normalized = processedCommand.toLowerCase();
    
    // Extract stanza if mentioned
    let targetStanza = null;
    let stanzaMatch = normalized.match(/(?:stanza|verse)\s+(\d+)/);
    if (stanzaMatch) {
        targetStanza = parseInt(stanzaMatch[1], 10);
    }
    // Also check for "chorus"
    if (normalized.includes("chorus")) {
        targetStanza = 'chorus';
    }

    normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    const words = normalized.split(/\s+/);
    
    let hymnNumberStr = '';
    let isExtractingNumber = false;
    for (let word of words) {
        // don't treat stanza number as hymn number if preceded by stanza/verse
        if (!isNaN(parseInt(word))) {
            hymnNumberStr += word;
            isExtractingNumber = true;
        } else if (isExtractingNumber && !FILLER_WORDS.includes(word)) {
            break;
        }
    }
    
    // If the hymnNumberStr matches the stanza number we extracted, it might have been consumed. 
    // Let's refine the number extraction to avoid stanza number.
    // simpler approach: just find the hymn number
    let hymnNumber = null;
    let hymnMatch = normalized.match(/(?:hymn|song|number)\s+(\d+)/);
    if (hymnMatch) {
        hymnNumber = parseInt(hymnMatch[1], 10);
    } else if (hymnNumberStr.length > 0) {
        // filter out the stanza number if it's the same
        if (targetStanza && parseInt(hymnNumberStr, 10) === targetStanza && hymnNumberStr.length < 3) {
            // probably not the hymn number
        } else {
            hymnNumber = parseInt(hymnNumberStr, 10);
        }
    }

    let foundHymn = null;

    if (hymnNumber) {
        const [rows] = await pool.query('SELECT * FROM hymns WHERE hymn_number = ?', [hymnNumber]);
        if (rows.length > 0) {
            foundHymn = rows[0];
        }
    }
    
    if (!foundHymn) {
        const searchWords = words.filter(word => !FILLER_WORDS.includes(word) && word !== 'stanza' && word !== 'verse' && word !== 'chorus' && isNaN(parseInt(word)));
        if (searchWords.length > 0) {
            const searchString = searchWords.join(' ');
            const [allHymns] = await pool.query('SELECT * FROM hymns');
            
            let bestMatch = null;
            let lowestDistance = Infinity;

            for (const hymn of allHymns) {
                const titleLower = hymn.title.toLowerCase();
                
                if (titleLower.includes(searchString) || searchString.includes(titleLower)) {
                    foundHymn = hymn;
                    break;
                }

                const distance = levenshtein.get(searchString, titleLower);
                if (distance < lowestDistance) {
                    lowestDistance = distance;
                    bestMatch = hymn;
                }
            }

            if (!foundHymn) {
                const threshold = Math.max(3, Math.floor(searchString.length * 0.5));
                if (lowestDistance <= threshold && bestMatch) {
                    foundHymn = bestMatch;
                }
            }
        }
    }

    if (foundHymn) {
        // Fetch stanzas
        const [stanzas] = await pool.query('SELECT * FROM hymn_stanzas WHERE hymn_id = ? ORDER BY stanza_number', [foundHymn.id]);
        foundHymn.stanzas = stanzas;
        foundHymn.targetStanza = targetStanza;
        
        // Map fields for backward compatibility with old code
        foundHymn.HymnID = foundHymn.id;
        foundHymn.HymnNumber = foundHymn.hymn_number;
        foundHymn.Title = foundHymn.title;
        
        return foundHymn;
    }

    return null;
}

module.exports = {
    matchCommand
};
