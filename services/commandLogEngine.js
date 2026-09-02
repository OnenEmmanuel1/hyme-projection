const pool = require('../config/database');

async function logCommand(recognisedText, matchedHymnID) {
    const status = matchedHymnID ? 'Matched' : 'Not Found';
    try {
        await pool.query(
            'INSERT INTO CommandLog (RecognisedText, MatchedHymnID, Status) VALUES (?, ?, ?)',
            [recognisedText, matchedHymnID || null, status]
        );
    } catch (error) {
        console.error('Failed to log command:', error);
    }
}

module.exports = {
    logCommand
};
