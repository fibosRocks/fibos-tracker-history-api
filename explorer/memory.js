const config = require('../config/explorer.json')
const redis = require("redis").createClient(config.redis);
module.exports = redis