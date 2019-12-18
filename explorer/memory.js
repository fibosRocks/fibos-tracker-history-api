var memory = {}
module.exports = {
    set: function (key, value) {
        memory[key] = value
        // console.log(`memory:set ${key}=${value}`)
    },
    hset: function (type, key, value) {
        if (!memory[type]) {
            memory[type] = {}
        }
        memory[type][key] = value
        // console.log(`memory:hset [${type}] ${key}=${value}`)
    },
    get: function (key) {
        return memory[key]
    },
    hget: function (type, key) {
        return memory[type][key]
    },
}