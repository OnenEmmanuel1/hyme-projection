const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

router.get('/login', (req, res) => {
    if (req.session.adminId) return res.redirect('/admin/dashboard');
    res.render('admin/login', { error: null });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM Administrator WHERE Username = ?', [username]);
        if (rows.length > 0) {
            const admin = rows[0];
            const match = await bcrypt.compare(password, admin.PasswordHash);
            if (match) {
                req.session.adminId = admin.AdminID;
                return res.redirect('/admin/dashboard');
            }
        }
        res.render('admin/login', { error: 'Invalid credentials' });
    } catch (error) {
        console.error(error);
        res.render('admin/login', { error: 'Server error' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

// Protect all routes below this middleware
router.use(requireAdmin);

// Add view variables
router.use((req, res, next) => {
    res.locals.userRole = 'Administrator';
    res.locals.userName = 'Admin';
    res.locals.currentPath = req.baseUrl + req.path;
    next();
});

router.get('/dashboard', async (req, res) => {
    const [hymnStats] = await pool.query('SELECT COUNT(*) as count FROM hymns');
    const [logStats] = await pool.query('SELECT COUNT(*) as count FROM CommandLog');
    res.render('admin/dashboard', { 
        hymnCount: hymnStats[0].count,
        logCount: logStats[0].count
    });
});

// --- HYMNS CRUD ---
router.get('/hymns', async (req, res) => {
    const [hymns] = await pool.query('SELECT * FROM hymns ORDER BY hymn_number ASC');
    res.render('admin/hymns', { hymns });
});

router.post('/hymns/create', async (req, res) => {
    const { HymnNumber, Title, Lyrics, Category } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO hymns (hymn_number, title) VALUES (?, ?)',
            [HymnNumber, Title]
        );
        const hymnId = result.insertId;
        
        // Simple heuristic: split lyrics by double newline to separate stanzas
        const stanzas = Lyrics.split(/\n\n+/).filter(s => s.trim().length > 0);
        let stanza_number = 1;
        for (const stanza of stanzas) {
            let is_chorus = false;
            let content = stanza;
            if (stanza.toLowerCase().startsWith('chorus:')) {
                is_chorus = true;
                content = stanza.substring(7).trim();
            }
            await pool.query(
                'INSERT INTO hymn_stanzas (hymn_id, stanza_number, is_chorus, content) VALUES (?, ?, ?, ?)',
                [hymnId, stanza_number, is_chorus, content]
            );
            stanza_number++;
        }
    } catch (err) {
        console.error(err);
    }
    res.redirect('/admin/hymns');
});

router.post('/hymns/delete/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM hymns WHERE id = ?', [req.params.id]);
    } catch (err) {
        console.error(err);
    }
    res.redirect('/admin/hymns');
});

// --- LOGS ---
router.get('/logs', async (req, res) => {
    const [logs] = await pool.query(`
        SELECT l.*, h.title as Title, h.hymn_number as HymnNumber 
        FROM CommandLog l 
        LEFT JOIN hymns h ON l.MatchedHymnID = h.id 
        ORDER BY l.Timestamp DESC 
        LIMIT 100
    `);
    res.render('admin/logs', { logs });
});

// --- SETTINGS ---
router.get('/settings', (req, res) => {
    res.render('admin/settings', { error: null, success: null });
});

router.post('/settings/password', async (req, res) => {
    const { newPassword } = req.body;
    try {
        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE Administrator SET PasswordHash = ? WHERE AdminID = ?', [hash, req.session.adminId]);
        res.render('admin/settings', { error: null, success: 'Password updated successfully!' });
    } catch (err) {
        console.error(err);
        res.render('admin/settings', { error: 'Failed to update password', success: null });
    }
});

module.exports = router;
