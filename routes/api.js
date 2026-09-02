const express = require('express');
const router = express.Router();
const { matchCommand } = require('../services/matchingEngine');
const { logCommand } = require('../services/commandLogEngine');

module.exports = function(io) {
    router.post('/voice-command', async (req, res) => {
        const { text, confidence } = req.body;
        
        // Confidence threshold check
        const threshold = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.5');
        if (confidence < threshold) {
            await logCommand(text || '[Low Confidence / Unrecognized]', null);
            io.emit('hymn_match', { status: 'Not Found', reason: 'Low confidence' });
            return res.json({ status: 'Not Found', message: 'Command unclear, rejected due to low confidence' });
        }

        const matchedHymn = await matchCommand(text);
        
        if (matchedHymn) {
            await logCommand(text, matchedHymn.HymnID);
            io.emit('hymn_match', { status: 'Matched', hymn: matchedHymn });
            res.json({ status: 'Matched', hymn: matchedHymn });
        } else {
            await logCommand(text, null);
            io.emit('hymn_match', { status: 'Not Found' });
            res.json({ status: 'Not Found' });
        }
    });

    return router;
};
