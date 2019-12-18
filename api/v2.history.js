'use strict';

const SQL = require('sql-template-strings');
const fibos_graphql = require('../lib/fibos_graphql')

module.exports = (app, db) => {

	/**
	 * @swagger
	 *
	 * /v1/history/get_actions:
	 *   post:
	 *     description: get_actions
	 *     requestBody:
 	 *       content:
 	 *         application/json:
 	 *           schema:
 	 *             type: object
 	 *             properties:
 	 *               pos:
 	 *                 type: number
 	 *                 default: -1
 	 *               offset:
 	 *                 type: number
 	 *                 default: 10
 	 *               account_name:
 	 *                 type: string
 	 *                 default: cryptolions1
 	 *               action_name:
 	 *                 type: string
 	 *                 default: all
	 */
    app.post('/v1/history/get_actions', getActionsPOST);

    /**
	 * @swagger
	 *
	 * /v1/history/get_symbol_actions:
	 *   post:
	 *     description: get_symbol_actions
	 *     requestBody:
 	 *       content:
 	 *         application/json:
 	 *           schema:
 	 *             type: object
 	 *             properties:
 	 *               limit:
 	 *                 type: number
 	 *                 default: 50
 	 *               skip:
 	 *                 type: number
 	 *                 default: 0
 	 *               account:
 	 *                 type: string
	 */
    app.post('/v1/history/get_symbol_actions', getSymbolActionsPOST);

	/**
	 * @swagger
	 *
	 * /v1/history/get_transaction:
	 *   post:
	 *     description: get_transaction
	 *     requestBody:
 	 *       content:
 	 *         application/json:
 	 *           schema:
 	 *             type: object
 	 *             properties:
 	 *               id:
 	 *                 type: string
	 */
    app.post('/v1/history/get_transaction', getTransactionPOST);

	/**
	 * @swagger
	 *
	 * /v1/history/get_transaction/${id}:
	 *   get:
	 *     description: Get Transaction by id
	 *     produces:
	 *       - application/json
	 */
    app.get('/v1/history/get_transaction/:id', getTransactionGET);

	/**
	 * @swagger
	 *
	 * /v1/history/get_key_accounts:
	 *   post:
	 *     description: get_key_accounts
	 *     requestBody:
 	 *       content:
 	 *         application/json:
 	 *           schema:
 	 *             type: object
 	 *             properties:
 	 *               public_key:
 	 *                 type: string
	 */
    app.post('/v1/history/get_key_accounts', getKeyAccountsPOST);

    function getSymbolActionsPOST(req, res) {
        let { account, limit, skip } = req.body

        if (!account) {
            return res.status(401).send("Wrong account!");
        }

        if (!limit) {
            limit = 50
        }

        if (!skip) {
            skip = 0
        }

        fibos_graphql.getSymbolTxs(account, limit, skip).then(txs => {
            res.json(txs);
        }).catch(err => {
            console.error(err);
            res.status(500).send({ error: err.message });
        })
    }

    function getActionsPOST(req, res) {
        // // default values
        // let skip = 0;
        // let limit = 10;
        // let sort = -1;
        // let accountName = String(req.body.account_name);
        // let action = String(req.body.action_name);

        // let query = {
        //     $or: [
        // 		/* {"act.account": accountName}, 
        // 		{"act.data.receiver": accountName}, 
        // 		{"act.data.from": accountName}, 
        // 		{"act.data.to": accountName},
        // 		{"act.data.name": accountName},
        // 		{"act.data.voter": accountName},
        // 		{"act.authorization.actor": accountName} */
        //         { "receipt.receiver": accountName }
        //     ]
        // };
        // if (action !== "undefined") {
        //     query["act.name"] = action;
        // }

        // let pos = Number(req.body.pos);
        // let offset = Number(req.body.offset);
        // if (!isNaN(pos) && !isNaN(offset)) {
        //     if (pos < 0) {
        //         sort = -1;
        //         skip = 0;
        //         limit = offset < 0 ? -1 * offset + 1 : 0;
        //     } else {
        //         sort = 1;
        //         skip = pos + (offset < 0 ? offset : 0);
        //         skip = skip < 0 ? 0 : skip;
        //         limit = Math.abs((offset + pos) < 0 ? pos : offset) + 1;
        //     }
        // }

        // if (limit > MAX_ELEMENTS) {
        //     return res.status(401).send(`Max elements ${MAX_ELEMENTS}!`);
        // }
        // if (skip < 0 || limit < 0) {
        //     return res.status(401).send(`Skip (${skip}) || (${limit}) limit < 0`);
        // }
        // if (sort !== -1 && sort !== 1) {
        //     return res.status(401).send(`Sort param must be 1 or -1`);
        // }

        // async.parallel({
        //     lib: (callback) => {
        //         DB.collection("blocks").find({ "irreversible": true }).sort({ "block_num": -1 }).limit(1).toArray(callback);
        //     },
        //     actions: (callback) => {
        //         if (limit == 0) {
        //             callback(null, []);
        //         } else {
        //             DB.collection("action_traces").find(query).sort({ "receipt.recv_sequence": sort }).skip(skip).limit(limit).toArray(callback);
        //         }
        //     }
        // }, (err, result) => {
        //     if (err) {
        //         console.error(err);
        //         return res.status(500).send({ error: er r });
        //     }
        //     let actions = [];
        //     result.actions.forEach(element => {
        //         delete element._id;
        //         delete element.createdAt;
        //         actions.push({
        //             "global_action_seq": element.receipt.global_sequence,
        //             "account_action_seq": element.receipt.recv_sequence - 1,
        //             "block_num": element.block_num,
        //             "block_time": element.block_time,
        //             "action_trace": element
        //         })
        //     });

        //     if (sort == -1) {	//like history format
        //         actions.sort((a, b) => {
        //             return a.account_action_seq - b.account_action_seq;
        //         })
        //     }
        //     result.actions = actions;
        //     result.last_irreversible_block = result.lib[0].block_num;
        //     delete result.lib;
        //     res.json(result)
        // });
    }

    function getTransactionPOST(req, res) {
        let id = String(req.body.id);
        if (id === "undefined") {
            return res.status(401).send("Wrong transactions ID!");
        }
        getTransaction(id).then(tx => {
            res.json(tx);
        }).catch(err => {
            console.error(err);
            res.status(500).send({ error: err.message });
        })
    }

    function getTransactionGET(req, res) {
        let id = String(req.params.id);
        if (id === "undefined") {
            return res.status(401).send("Wrong transactions ID!");
        }
        getTransaction(id).then(tx => {
            res.json(tx);
        }).catch(err => {
            console.error(err);
            res.status(500).send({ error: err.message });
        })
    }

    function getTransaction(id) {
        const txPromise = db.get(SQL`SELECT rawData FROM fibos_transactions WHERE trx_id = ${id}`);
        const libPromise = db.get(SQL`SELECT block_num FROM fibos_blocks WHERE status = 'noreversible' ORDER BY block_num desc LIMIT 1`);
        return Promise.all([libPromise, txPromise]).then(([lib, tx]) => {
            if (!tx) {
                throw new Error('transaction not found!')
            }
            const transaction = JSON.parse(tx.rawData)
            transaction.last_irreversible_block = lib.block_num
            return transaction
        })
    }

    function getKeyAccountsPOST(req, res) {
        let key = String(req.body.public_key);
        if (key === "undefined") {
            return res.status(401).send("Wrong public_key !");
        }
        getKeyAccounts(key).then(accounts => {
            res.json(accounts);
        }).catch(err => {
            console.error(err);
            res.status(500).send({ error: err.message });
        })

    }

    function getKeyAccounts(public_key) {
        return db.all(SQL`SELECT DISTINCT account_id FROM fibos_permissions WHERE pub_key = ${public_key}`).then(accounts => {
            const account_names = []
            for (const account of accounts) {
                account_names.push(account.account_id)
            }
            return { account_names }
        })
    }

}


