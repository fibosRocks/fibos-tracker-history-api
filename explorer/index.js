module.exports = async (memory, db) => {
    require('./voters')(memory, db)
    require('./resource')(memory, db)
    require('./cache')(memory, db)
    require('./contract')(memory, db)
}