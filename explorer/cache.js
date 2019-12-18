const memory = require('./memory')
const SQL = require('sql-template-strings');
const sqlite = require('sqlite');
const path = require('path')
const dbPath = path.resolve('db/tracker.db');

//cache dashboard
function cacheDashboard() {
    sqlite.open(dbPath)
        .then(db => {
            //get summaries
            let promises = [
                db.get(SQL`SELECT count(*) as block_count FROM fibos_blocks`).then(res => {
                    return res.block_count
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
                    // const litePromises = blocks.map(async block => {
                    //     const block_time_s = block.block_time.split(" ")
                    //     let liteBlock = {};
                    //     liteBlock.block_num = block.block_num;
                    //     liteBlock.timestamp = `${block_time_s[0]}T${block_time_s[1]}`;
                    //     liteBlock.producer = block.producer;
                    //     try {
                    //         liteBlock.trxCount = (await db.get(SQL`SELECT COUNT(*) as trxCount FROM fibos_transactions WHERE block_id='${block.block_num}'`)).trxCount
                    //         return liteBlock
                    //     } catch (err) {
                    //         console.error(err)
                    //         throw (err)
                    //     }

                    // })
                    // Promise.all(litePromises).then(liteBlocks => {
                    //     resolve(liteBlocks);
                    // })
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
                db.all(SQL`SELECT * FROM fibos_transactions order by id desc limit 20`).then(transactions => {
                    let liteTrxs = [];
                    transactions.forEach(transaction => {
                        let trx = {};
                        trx.id = transaction.trx_id;
                        //trx.timestamp = transaction.timestamp;
                        // trx.accounts = transaction.accounts;
                        trx.contract_actions = transaction.contract_action;
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
                    memory.set("dashboard", dashboard);
                })
        }).catch(err => {
            console.error(err)
        })
}

cacheDashboard();
setInterval(cacheDashboard, 2000);
