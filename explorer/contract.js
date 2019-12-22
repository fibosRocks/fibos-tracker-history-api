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
        db.all(SQL`SELECT DISTINCT account FROM fibos_contracts`).then(contracts => {
            contracts.forEach(contract => {
                const { account } = contract

                const httpEndPoint = getEndPoint();

                const abiPromise = axios.post(`${httpEndPoint}/v1/chain/get_abi`, {
                    "account_name": account
                }).then(res => {
                    const { data } = res;
                    return data;
                }).catch(err => {
                    console.error(err)
                })

                const hashPromise = axios.post(`${httpEndPoint}/v1/chain/get_code_hash`, {
                    "account_name": account
                }).then(res => {
                    const { data } = res;
                    return data.code_hash;
                }).catch(err => {
                    console.error(err)
                })

                const countPromise = db.get(SQL`SELECT COUNT(DISTINCT trx_id)  as tx_count FROM fibos_actions WHERE contract=${account}`).then(res => {
                    return res.tx_count
                })

                Promise.all([abiPromise, countPromise, hashPromise]).then(([abi, count, hash]) => {
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
                    memory.hset("contracts", obj.contract, obj);
                })
            })
        })
    }

    cacheContracts();
    setInterval(cacheContracts, 10 * 60 * 1000);

}

