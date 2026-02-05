/**
 * 7-Eleven Shift Manager - Database Connection (sql.js)
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, 'shift_manager.db');

let db = null;

// Initialize database
async function initDatabase() {
    if (db) return db;

    const SQL = await initSqlJs();

    try {
        // Try to load existing database
        if (fs.existsSync(DB_PATH)) {
            const buffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(buffer);
        } else {
            // Create new database
            db = new SQL.Database();
            console.log('Created new database');
        }

        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');

        return db;
    } catch (error) {
        console.error('Failed to initialize database:', error.message);
        throw error;
    }
}

// Save database to file
function saveDatabase() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// Helper functions to match better-sqlite3 API
function prepare(sql) {
    return {
        run: (...params) => {
            db.run(sql, params);
            saveDatabase();
            return {
                lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] || 0,
                changes: db.getRowsModified()
            };
        },
        get: (...params) => {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                return row;
            }
            stmt.free();
            return null;
        },
        all: (...params) => {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            const rows = [];
            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            stmt.free();
            return rows;
        }
    };
}

function exec(sql) {
    db.run(sql);
    saveDatabase();
}

function pragma(sql) {
    db.run(`PRAGMA ${sql}`);
}

module.exports = {
    initDatabase,
    prepare: (sql) => prepare(sql),
    exec: (sql) => exec(sql),
    pragma: (sql) => pragma(sql),
    saveDatabase,
    getDb: () => db
};
