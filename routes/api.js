const express = require('express');
const router = express.Router();
const { matchCommand } = require('../services/matchingEngine');
const { logCommand } = require('../services/commandLogEngine');
const { processCommand } = require('../services/nlpEngine');

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

        // NLP Processing for Intent Classification
        const nlpResult = await processCommand(text);
        
        if (nlpResult.intent === 'intent.next_verse') {
            await logCommand(text, null);
            return res.json({ status: 'Command', action: 'next_verse' });
        }
        
        if (nlpResult.intent === 'intent.prev_verse') {
            await logCommand(text, null);
            return res.json({ status: 'Command', action: 'prev_verse' });
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

    router.post('/navigate', (req, res) => {
        const { action, index } = req.body;
        io.emit('change_verse', { action, index });
        res.json({ success: true });
    });

    return router;
};
