const SQL = require('sql-template-strings');
const axios = require('axios');
const config = require('../config/explorer.json');
const httpEndPoints = config.httpEndPoints;

function getEndPoint() {
    let random = Math.floor(Math.random() * httpEndPoints.length);
    return httpEndPoints[random];
}


module.exports = (memory, db) => {
    function cacheContracts() {
        db.all(SQL`SELECT DISTINCT account FROM fibos_contracts`).then(async contracts => {
            for (const contract of contracts) {
                const { account } = contract
                const httpEndPoint = getEndPoint();
                const abiRes = await axios.post(`${httpEndPoint}/v1/chain/get_abi`, {
                    "account_name": account
                })
                const abi = abiRes.data

                const hashRes = await axios.post(`${httpEndPoint}/v1/chain/get_code_hash`, {
                    "account_name": account
                })
                const hash = hashRes.data.code_hash;

                const countRes = await db.get(SQL`SELECT COUNT(DISTINCT trx_id)  as tx_count FROM fibos_actions WHERE contract=${account}`)
                const count = countRes.tx_count

                let actions = [];
                if (abi.abi) {
                    abi.abi.actions.forEach(action => {
                        actions.push(action.name);
                    });
                }
                let obj = {
                    contract: account,
                    count, actions, abi, hash,
                    is_token: (actions.indexOf("transfer") != -1)/* ,
                                    is_open: openContracts.includes(contract) */
                }
                console.log('contract', obj)
                memory.hset("contracts", obj.contract, obj);

            }
        }).catch(err => {
            console.error(err)
        })
    }

    cacheContracts();
    setInterval(cacheContracts, 10 * 60 * 1000);

}

