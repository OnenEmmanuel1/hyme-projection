const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedDatabase() {
    console.log('Starting database seeding...');

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true // Required to run init.sql
        });

        const sqlFilePath = path.join(__dirname, 'init.sql');
        let sql = fs.readFileSync(sqlFilePath, 'utf8');

        const dbName = process.env.DB_NAME || 'hymn_db';
        sql = `CREATE DATABASE IF NOT EXISTS \`${dbName}\`; USE \`${dbName}\`;\n` + sql;

        console.log('Executing init.sql...');
        await connection.query(sql);

        console.log('Database seeded successfully!');
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
