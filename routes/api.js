const express = require('express');
const router = express.Router();
const { matchCommand } = require('../services/matchingEngine');
const { logCommand } = require('../services/commandLogEngine');
const { processCommand } = require('../services/nlpEngine');
const pool = require('../config/database');

async function getAutoAdvanceSettings(hymnId) {
    try {
        const [rows] = await pool.query(`SELECT mode, secondsPerVerse, silenceThresholdSeconds FROM autoadvance_settings
          WHERE hymnId IS NULL OR hymnId = ? ORDER BY hymnId IS NOT NULL DESC LIMIT 1`, [hymnId]);
        return rows[0] || { mode: 'Timer', secondsPerVerse: 28, silenceThresholdSeconds: 2.5 };
    } catch { return { mode: 'Timer', secondsPerVerse: 28, silenceThresholdSeconds: 2.5 }; }
}

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

        // Handle navigation phrases directly so speech recognition does not
        // depend on the NLP model choosing the navigation intent.
        const commandText = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const nextVerseCommand = /^(?:please )?(?:(?:go|move) to )?(?:the )?next(?: verse| stanza)?(?: please)?$/.test(commandText);
        const previousVerseCommand = /^(?:please )?(?:go to |move to )?(?:the )?(?:previous|prior|last)(?: verse| stanza)?(?: please)?$/.test(commandText);

        if (nextVerseCommand) {
            await logCommand(text, null);
            io.emit('advance_verse', { action: 'next' });
            return res.json({ status: 'Command', action: 'next_verse' });
        }
        
        if (previousVerseCommand) {
            await logCommand(text, null);
            io.emit('advance_verse', { action: 'previous' });
            return res.json({ status: 'Command', action: 'prev_verse' });
        }

        // NLP Processing for other intent classification
        const nlpResult = await processCommand(text);

        if (nlpResult.intent === 'intent.next_verse') {
            await logCommand(text, null);
            io.emit('advance_verse', { action: 'next' });
            return res.json({ status: 'Command', action: 'next_verse' });
        }
        if (nlpResult.intent === 'intent.prev_verse') {
            await logCommand(text, null);
            io.emit('advance_verse', { action: 'previous' });
            return res.json({ status: 'Command', action: 'prev_verse' });
        }

        const matchedHymn = await matchCommand(text);
        
        if (matchedHymn) {
            matchedHymn.autoAdvanceSettings = await getAutoAdvanceSettings(matchedHymn.HymnID || matchedHymn.id);
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

    router.get('/voice-grammar', async (req, res) => {
        try {
            const [hymns] = await pool.query('SELECT hymn_number, title FROM hymns ORDER BY hymn_number');
            const numbers = hymns.flatMap(h => [String(h.hymn_number), String(h.hymn_number).split('').join(' ')]);
            res.json({ grammar: [...new Set([...numbers, ...hymns.map(h => h.title), 'play', 'hymn', 'number', 'stop', 'repeat', 'next verse', 'next', 'previous verse', 'previous', '[unk]'])] });
        } catch (e) { res.status(500).json({ error: 'Unable to load recognition vocabulary' }); }
    });

    router.post('/advance-control', (req, res) => {
        io.emit('advance_control', { action: req.body.action });
        res.json({ success: true });
    });

    return router;
};
