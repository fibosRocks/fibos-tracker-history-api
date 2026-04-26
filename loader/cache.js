const SQL = require('sql-template-strings');
const axios = require('axios');
const { httpEndPoints } = require('../config/explorer.json')

module.exports = (memory, db) => {

    //cache dashboard
    function cacheDashboard() {

        //get summaries
        let promises = [
            axios.get(`${httpEndPoints[0]}/v1/chain/get_info`).then(res => {
                const { data } = res;
                return data.head_block_num;
            }).catch(err => {
                console.error(err)
            }),
            db.get(SQL`SELECT count(*) as tx_count FROM fibos_transactions`).then(res => {
                return res.tx_count
            }),
            db.get(SQL`SELECT count(*) as acc_count FROM fibos_accounts`).then(res => {
                return res.acc_count
            }),
            db.get(SQL`SELECT COUNT(DISTINCT account) as contract_count FROM fibos_contracts`).then(res => {
                return res.contract_count
            }),
        ]
        let summariesPromise = Promise.all(promises);
        //get 20 blocks
        let blocksPromise = new Promise((resolve, reject) => {
            db.all(SQL`SELECT * FROM fibos_blocks order by id desc limit 20`).then(blocks => {
                let liteBlocks = [];
                blocks.forEach(block => {
                    const block_time_s = block.block_time.split(" ")
                    let liteBlock = {};
                    liteBlock.block_num = block.block_num;
                    liteBlock.timestamp = `${block_time_s[0]}T${block_time_s[1]}`;
                    liteBlock.producer = block.producer;
                    // liteBlock.trxCount = block.transactions.length;
                    liteBlocks.push(liteBlock);
                });
                resolve(liteBlocks);
            }).catch(err => {
                reject(err)
            })
        });
        //get 20 trasactions
        let transactionsPromise = new Promise((resolve, reject) => {
            db.all(SQL`SELECT * FROM fibos_transactions where contract_action != "eosio.cross/pushblk" order by id desc limit 20`).then(transactions => {
                let liteTrxs = [];
                transactions.forEach(transaction => {
                    const trx = {};
                    const data = JSON.parse(transaction.rawData)
                    const accounts = new Set()
                    const contract_actions = []
                    for (const action of data.action_traces) {
                        const authorizations = action.act.authorization
                        for (const authorization of authorizations) {
                            accounts.add(authorization.actor)
                        }
                        contract_actions.push({
                            contract: action.act.account,
                            action: action.act.name
                        })
                    }

                    trx.id = transaction.trx_id;
                    trx.accounts = Array.from(accounts)
                    trx.contract_actions = contract_actions;
                    liteTrxs.push(trx);
                });
                resolve(liteTrxs);
            }).catch(err => {
                reject(err)
            })
        });
        Promise.all([summariesPromise, blocksPromise, transactionsPromise])
            .then(([summaries, blocks, transactions]) => {
                let dashboard = {};
                dashboard.summaries = summaries;
                dashboard.blocks = blocks;
                dashboard.transactions = transactions;
                // console.log({ dashboard })
                memory.set("dashboard", JSON.stringify(dashboard));
            })
    }

    cacheDashboard();
    setInterval(cacheDashboard, 2000);
}