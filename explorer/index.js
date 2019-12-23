const path = require('path')
const sqlite = require('sqlite');
const dbPath = path.resolve('db/tracker.db')
const memory = require('./memory')

sqlite.open(dbPath).then(async db => {
    require('./voters')(memory, db)
    require('./resource')(memory, db)
    require('./cache')(memory, db)
    require('./contract')(memory, db)
})