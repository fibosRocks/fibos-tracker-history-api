'use strict';

const SQL = require('sql-template-strings');
const axios = require('axios');
const httpEndPoint = require('../config/explorer.json').httpEndPoints[0];

const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;

// 30s TTL cache for COUNT(*) — avoids repeated full-index scans on large accounts
const TOTAL_TTL_MS = 30 * 1000;
const TOTAL_CACHE_MAX = 1000;
const totalCache = new Map();

function getCachedTotal(account) {
    const e = totalCache.get(account);
    if (e && Date.now() - e.ts < TOTAL_TTL_MS) return e.total;
    return null;
}

function setCachedTotal(account, total) {
    if (totalCache.size >= TOTAL_CACHE_MAX) {
        const firstKey = totalCache.keys().next().value;
        totalCache.delete(firstKey);
    }
    totalCache.set(account, { total, ts: Date.now() });
}

module.exports = (app, db) => {

    /**
     * @swagger
     *
     * /explorer/history/{account}/paged:
     *   get:
     *     description: 获取账户交易历史（page 分页，返回总数）
     *     parameters:
     *       - in: path
     *         name: account
     *         required: true
     *         schema:
     *           type: string
     *         description: 账户名
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *         description: 页码，1-indexed
     *       - in: query
     *         name: size
     *         schema:
     *           type: integer
     *           default: 50
     *         description: 每页条数，1-100
     */
    app.get('/explorer/history/:account/paged', getAccountHistoryPaged);

    /**
     * @swagger
     *
     * /explorer/history/{account}:
     *   get:
     *     description: 获取账户交易历史（cursor 分页）
     *     parameters:
     *       - in: path
     *         name: account
     *         required: true
     *         schema:
     *           type: string
     *         description: 账户名
     *       - in: query
     *         name: cursor
     *         schema:
     *           type: integer
     *         description: 上一页返回的 next_cursor；首屏不传
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 20
     *         description: 每页条数，1-100
     */
    app.get('/explorer/history/:account', getAccountHistoryGET);

    function getAccountHistoryPaged(req, res) {
        const account = req.params.account;

        if (!account || !ACCOUNT_RE.test(account)) {
            return res.status(400).json({ error: 'Invalid account name' });
        }

        let page = parseInt(req.query.page, 10);
        if (isNaN(page) || page < 1) page = 1;

        let size = parseInt(req.query.size, 10);
        if (isNaN(size) || size < 1) size = 50;
        if (size > 100) size = 100;

        const offset = (page - 1) * size;

        const itemsQuery = db.all(SQL`
            SELECT aa.action_id, aa.receipt, a.global_sequence, a.trx_id, a.rawData
            FROM fibos_account_actions aa, fibos_actions a
            WHERE aa.account = ${account} AND aa.action_id = a.id
            ORDER BY aa.action_id DESC
            LIMIT ${size} OFFSET ${offset}
        `);

        const cachedTotal = getCachedTotal(account);
        const totalQuery = cachedTotal != null
            ? Promise.resolve(cachedTotal)
            : db.get(SQL`SELECT COUNT(*) AS c FROM fibos_account_actions WHERE account = ${account}`)
                .then(row => {
                    const total = row.c;
                    setCachedTotal(account, total);
                    return total;
                });

        Promise.all([getLib(), itemsQuery, totalQuery]).then(([lib, rows, total]) => {
            const items = rows.map(row => {
                const receipt = JSON.parse(row.receipt);
                const rawData = JSON.parse(row.rawData);
                return {
                    action_id: row.action_id,
                    global_sequence: receipt.global_sequence,
                    trx_id: row.trx_id,
                    block_num: rawData.block_num,
                    block_time: rawData.block_time,
                    act: rawData.act,
                };
            });

            res.json({
                items,
                total,
                page,
                size,
                has_more: (page * size) < total,
                last_irreversible_block: lib || 0,
            });
        }).catch(err => {
            console.error('account-history paged error:', err);
            res.status(500).json({ error: err.message });
        });
    }

    function getAccountHistoryGET(req, res) {
        const account = req.params.account;

        if (!account || !ACCOUNT_RE.test(account)) {
            return res.status(400).json({ error: 'Invalid account name' });
        }

        let limit = parseInt(req.query.limit, 10);
        if (isNaN(limit) || limit < 1) limit = 50;
        if (limit > 100) limit = 100;

        const cursorRaw = parseInt(req.query.cursor, 10);
        const hasCursor = !isNaN(cursorRaw) && cursorRaw >= 0;

        const fetch = hasCursor
            ? SQL`SELECT aa.action_id, aa.receipt, a.global_sequence, a.trx_id, a.rawData
                  FROM fibos_account_actions aa, fibos_actions a
                  WHERE aa.account = ${account} AND aa.action_id <= ${cursorRaw} AND aa.action_id = a.id
                  ORDER BY aa.action_id DESC
                  LIMIT ${limit + 1}`
            : SQL`SELECT aa.action_id, aa.receipt, a.global_sequence, a.trx_id, a.rawData
                  FROM fibos_account_actions aa, fibos_actions a
                  WHERE aa.account = ${account} AND aa.action_id = a.id
                  ORDER BY aa.action_id DESC
                  LIMIT ${limit + 1}`;

        Promise.all([getLib(), db.all(fetch)]).then(([lib, rows]) => {
            const hasMore = rows.length > limit;
            if (hasMore) rows = rows.slice(0, limit);

            const items = rows.map(row => {
                const receipt = JSON.parse(row.receipt);
                const rawData = JSON.parse(row.rawData);
                return {
                    action_id: row.action_id,
                    global_sequence: receipt.global_sequence,
                    trx_id: row.trx_id,
                    block_num: rawData.block_num,
                    block_time: rawData.block_time,
                    act: rawData.act,
                };
            });

            const next_cursor = hasMore ? items[items.length - 1].action_id - 1 : null;

            res.json({
                items,
                next_cursor,
                has_more: hasMore,
                last_irreversible_block: lib || 0,
            });
        }).catch(err => {
            console.error('account-history error:', err);
            res.status(500).json({ error: err.message });
        });
    }

    function getLib() {
        return axios.get(`${httpEndPoint}/v1/chain/get_info`).then(res => {
            return res.data.last_irreversible_block_num;
        }).catch(err => {
            console.error('getLib error:', err);
            return 0;
        });
    }

};
