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

        let skip = 0;
        let limit = 30;
        let sort = -1;
        let orderBy = 'DESC'

        let { pos, offset, account_name } = req.body

        if (isNaN(pos)) {
            pos = -1, offset = -30
        } else if (isNaN(offset)) {
            offset = pos < 0 ? -30 : 30
        }

        if (pos < 0) {
            sort = -1;
            skip = 0;
            limit = offset < 0 ? -1 * offset + 1 : 0;
        } else {
            sort = 1;
            orderBy = 'ASC'
            skip = pos + (offset < 0 ? offset : 0);
            skip = skip < 0 ? 0 : skip;
            limit = Math.abs((offset + pos) < 0 ? pos : offset) + 1;
        }

        if (limit > 200) {
            limit = 200
        }

        let actionSql
        if (pos < 0) {
            actionSql = `SELECT aa.receipt,a.* FROM fibos_account_actions AS aa,fibos_actions AS a WHERE aa.account='${account_name}' AND aa.action_id = a.id  ORDER BY a.id DESC LIMIT ${limit};`
        } else {
            actionSql = `SELECT aa.receipt,a.* FROM fibos_account_actions AS aa,fibos_actions AS a WHERE aa.account='${account_name}' AND aa.action_id = a.id  AND a.global_sequence <= ${pos} ORDER BY a.id DESC LIMIT ${limit};`
        }

        // const actionSql = `SELECT aa.receipt,a.* FROM fibos_account_actions AS aa,fibos_actions AS a WHERE aa.account='${account_name}' AND aa.action_id = a.id  ORDER BY a.id ${orderBy} LIMIT ${limit} OFFSET ${skip};`
        // fix bug change pos to global_sequence
        const actionsPromise = db.all(actionSql);

        const libPromise = db.get(SQL`SELECT block_num FROM fibos_blocks WHERE status = 'noreversible' ORDER BY block_num desc LIMIT 1`);
        return Promise.all([libPromise, actionsPromise]).then(([lib, actions]) => {
            if (!actions) {
                actions = []
            }
            let formatActions = [];
            actions.forEach(element => {
                const receipt = JSON.parse(element.receipt)
                const action = JSON.parse(element.rawData)
                action.receipt = receipt
                formatActions.push({
                    "global_action_seq": Number(action.receipt.global_sequence),
                    "account_action_seq": Number(action.receipt.recv_sequence) - 1,
                    "block_num": Number(action.block_num),
                    "block_time": action.block_time,
                    "action_trace": action
                })
            });

            // if (sort == -1) {	//like history format
            //     formatActions.sort((a, b) => {
            //         return a.global_action_seq - b.global_action_seq;
            //     })
            // }

            formatActions.sort((a, b) => {
                return a.global_action_seq - b.global_action_seq;
            })

            const result = {}
            result.actions = formatActions;
            result.last_irreversible_block = lib.block_num;
            res.json(result)
        })
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


