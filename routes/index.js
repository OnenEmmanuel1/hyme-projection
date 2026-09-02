const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/', (req, res) => {
    res.redirect('/operator');
});

router.get('/operator', async (req, res) => {
    let recentLogs = [];
    try {
        const [logs] = await pool.query(`
            SELECT h.HymnNumber, h.Title, l.RecognisedText 
            FROM CommandLog l 
            JOIN Hymn h ON l.MatchedHymnID = h.HymnID 
            WHERE l.Status = 'Matched' 
            ORDER BY l.Timestamp DESC 
            LIMIT 4
        `);
        recentLogs = logs;
    } catch (e) {
        console.error("Failed to fetch recent logs:", e);
    }
    
    // Determine user role (if session exists, Administrator, otherwise Operator)
    const userRole = (req.session && req.session.adminId) ? 'Administrator' : 'Operator';
    const userName = (req.session && req.session.adminId) ? 'Admin' : 'Operator User';

    res.render('operator', { 
        recentLogs, 
        userRole,
        userName,
        currentPath: '/operator'
    });
});

router.get('/display', (req, res) => {
    res.render('display');
});

module.exports = router;
