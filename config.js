require('dotenv').config();

const mysql = require('mysql2/promise');

async function initDB() {
    while (true) {
        try {
            const connection = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE,
                port: process.env.DB_PORT,
            });
            console.log('Database connection established successfully.');
            return connection; 
        } catch (error) {
            console.error('Database connection failed. Retrying...', error.message);
            await new Promise((resolve) => setTimeout(resolve, 5000)); 
        }
    }
}

module.exports = { initDB };
