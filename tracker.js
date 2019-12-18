const p2p_peer_address = require('./config/p2p.json')
const defaultConfig = require('./config/tracker.json')
const config = {
    ...defaultConfig, ...{
        chain_parameter: {
            // "hard-replay": true,
            // "genesis-json": "./genesis.json",
            // "delete-all-blocks": true
            //"snapshot":"./data/snapshots/snapshot-0450fe4433833847fe30a32e709ea3eb5291bd909fda910a2e5f33a06e86869e.bin"
        },
        tracker: {
            replay: true,
            replayStatrBn: 0,
            "DBconnString": "sqlite:./db/tracker.db"
        }
    }
}
// fibos node
const fibos = require('fibos');
fibos.config_dir = config.config_dir;
fibos.data_dir = config.data_dir;

console.notice("config_dir:", fibos.config_dir);
console.notice("data_dir:", fibos.data_dir);

fibos.load("http", {
    "http-server-address": `0.0.0.0:${config.http_port}`
});

fibos.load("net", {
    "p2p-listen-endpoint": `0.0.0.0:${config.p2p_port}`,
    "p2p-peer-address": p2p_peer_address
});
fibos.load("producer_api");

fibos.load("chain", config.chain_parameter);
fibos.load("chain_api");
fibos.enableJSContract = true;

fibos.load("ethash");

// tracker
const fs = require("fs");
["", "\-shm", "\-wal"].forEach(function (k) {
    if (fs.exists("./fibos_chain.db" + k)) fs.unlink("./fibos_chain.db" + k);
});
const Tracker = require("fibos-tracker");
Tracker.Config.replay = config.tracker.replay;
Tracker.Config.replayStatrBn = config.tracker.replayStatrBn;
if (config.tracker.DBconnString) {
    Tracker.Config.DBconnString = config.tracker.DBconnString;
}

const tracker = new Tracker();
tracker.use(require("fibos-accounts"));
tracker.use(require("./addons/explorer"));
// tracker.use(require("fibos-tokens"));
tracker.emitter();

fibos.start();