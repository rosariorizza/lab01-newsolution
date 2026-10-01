'use strict';

const sqlite = require('sqlite3').verbose();
const path = require('path');

// Tests can point the application at an isolated database. Production keeps
// using the database shipped with the project when the variable is absent.
const DBSOURCE = process.env.FILM_MANAGER_DB_PATH ||
    path.join(__dirname, '../database/databaseV1.db');

const db = new sqlite.Database(DBSOURCE, (err) => {
    if (err) {
        // Cannot open database
        console.error(err.message);
        throw err;
    }

    db.exec('PRAGMA foreign_keys = ON;', function(error)  {
        if (error){
            console.error("Pragma statement didn't work.")
        }
    });
});

module.exports = db;
