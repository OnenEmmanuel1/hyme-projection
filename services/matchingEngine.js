const pool = require('../config/database');
const levenshtein = require('fast-levenshtein');
const { wordsToNumbers } = require('words-to-numbers');
const HymnApiService = require('./hymnApiService');

const FILLER_WORDS = ['please', 'play', 'show', 'hymn', 'number', 'project', 'display', 'me', 'sing'];

async function matchCommand(rawCommand) {
    if (!rawCommand) return null;

    // Convert word numbers to digits ("two four five" -> "245" or "two hundred forty five" -> "245")
    let processedCommand = wordsToNumbers(rawCommand, { impliedHundreds: true }) || rawCommand;
    // wordsToNumbers can return a number or string, force it to string for further processing
    processedCommand = processedCommand.toString();

    // Normalize
    let normalized = processedCommand.toLowerCase();
    
    // Remove punctuation
    normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

    const words = normalized.split(/\s+/);
    
    // Extract numbers (if any digits exist in the string now)
    // Combine consecutive digits to handle "two four five" -> "2 4 5" -> "245"
    let hymnNumberStr = '';
    let isExtractingNumber = false;
    for (let word of words) {
        if (!isNaN(parseInt(word))) {
            hymnNumberStr += word;
            isExtractingNumber = true;
        } else if (isExtractingNumber && !FILLER_WORDS.includes(word)) {
            // Stop extracting if we hit a non-filler, non-number word
            // But if it's just filler like "number", continue (though filler words are usually before)
            break;
        }
    }
    
    // Attempt exact number match first if a number is present
    if (hymnNumberStr.length > 0) {
        const hymnNumber = parseInt(hymnNumberStr, 10);
        const [rows] = await pool.query('SELECT * FROM Hymn WHERE HymnNumber = ?', [hymnNumber]);
        if (rows.length > 0) {
            return rows[0];
        }
    }
    
    // If no number match (or it wasn't found in DB), attempt title matching
    // Filter out filler words for better matching
    const searchWords = words.filter(word => !FILLER_WORDS.includes(word));
    if (searchWords.length === 0) return null;
    
    const searchString = searchWords.join(' ');
    
    const [allHymns] = await pool.query('SELECT * FROM Hymn');
    
    let bestMatch = null;
    let lowestDistance = Infinity;

    for (const hymn of allHymns) {
        const titleLower = hymn.Title.toLowerCase();
        
        // Simple substring check first
        if (titleLower.includes(searchString) || searchString.includes(titleLower)) {
            return hymn;
        }

        // Levenshtein distance on title
        const distance = levenshtein.get(searchString, titleLower);
        
        if (distance < lowestDistance) {
            lowestDistance = distance;
            bestMatch = hymn;
        }
    }

    // Threshold for fuzzy matching: if distance is reasonably small
    const threshold = Math.max(3, Math.floor(searchString.length * 0.5));
    if (lowestDistance <= threshold && bestMatch) {
        return bestMatch;
    }

    // --- EXTERNAL API FALLBACK ---
    // If not found locally, query the external API
    const externalHymn = await HymnApiService.fetchHymnFromAPI(searchString);
    
    if (externalHymn) {
        // Auto-assign a unique high number (e.g. 900 + random) to avoid conflicts
        const newHymnNumber = Math.floor(Math.random() * 10000) + 900;
        
        try {
            // Save to database
            const versesJsonString = JSON.stringify(externalHymn.VersesJSON);
            const [result] = await pool.query(
                'INSERT INTO Hymn (HymnNumber, Title, Lyrics, VersesJSON, Category) VALUES (?, ?, ?, ?, ?)',
                [newHymnNumber, externalHymn.Title, externalHymn.Lyrics, versesJsonString, externalHymn.Category]
            );
            
            // Return the newly created hymn object exactly as it would look from DB
            return {
                HymnID: result.insertId,
                HymnNumber: newHymnNumber,
                Title: externalHymn.Title,
                Lyrics: externalHymn.Lyrics,
                VersesJSON: externalHymn.VersesJSON,
                Category: externalHymn.Category
            };
        } catch (err) {
            console.error('[API] Failed to insert newly fetched hymn into database:', err);
        }
    }

    return null;
}

module.exports = {
    matchCommand
};
