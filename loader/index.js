const sqlite = require('sqlite');
const sqlite3 = require('sqlite3')
const config = require('../config/explorer.json')
const memory = require('./memory')

sqlite.open({
    filename: config.dbPath,
    driver: sqlite3.Database
}).then(async db => {
    require('./voters')(memory, db)
    require('./resource')(memory, db)
    require('./cache')(memory, db)
    require('./contract')(memory, db)
})