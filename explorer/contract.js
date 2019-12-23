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
        db.all(SQL`select contract as account, count(id) as num from fibos_actions group by contract`).then(async contracts => {
            for (const contract of contracts) {
                const { account, num } = contract
                const httpEndPoint = getEndPoint();
                const abiRes = await axios.post(`${httpEndPoint}/v1/chain/get_abi`, {
                    "account_name": account
                })
                const abi = abiRes.data

                const hashRes = await axios.post(`${httpEndPoint}/v1/chain/get_code_hash`, {
                    "account_name": account
                })
                const hash = hashRes.data.code_hash;

                let actions = [];
                if (abi.abi) {
                    abi.abi.actions.forEach(action => {
                        actions.push(action.name);
                    });
                }
                let obj = {
                    contract: account,
                    count: num,
                    actions, abi, hash,
                    is_token: (actions.indexOf("transfer") != -1)/* ,
                                    is_open: openContracts.includes(contract) */
                }
                console.log('contract', obj)
                memory.hset("contracts", obj.contract, JSON.stringify(obj));

            }
        }).catch(err => {
            console.error(err)
        })
    }

    cacheContracts();
    setInterval(cacheContracts, 60 * 60 * 1000);

}

