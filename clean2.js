const mysql = require('mysql2/promise');
require('dotenv').config();

async function clean() {
    const pool = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'hymn_db'
    });
    
    await pool.query("DELETE FROM commandlog WHERE MatchedHymnID IN (SELECT HymnID FROM Hymn WHERE Category LIKE '%API%')");
    await pool.query("DELETE FROM Hymn WHERE Category LIKE '%API%'");
    console.log("All API fetched hymns deleted from DB. Ready for clean refetch.");
    pool.end();
}
clean();
