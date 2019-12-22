'use strict';

module.exports = (app, memory, db) => {

    app.get('/explorer/stats', (req, res) => {
        const dashboard = memory.get('dashboard')
        res.json(dashboard)
    });

    app.get('/explorer/resource', (req, res) => {
        const resource = memory.get('resource')
        res.json(resource)
    });

    app.get('/explorer/producers', (req, res) => {
        const producers = memory.get('producers')
        const objs = memory.hgetall("total_vote")
        if (!objs) {
            res.json();
        }
        producers.forEach((producer) => {
            producer.eos_votes = 1 * objs[producer.owner];
        });
        res.json(producers)
    });

    app.get('/explorer/vote', (req, res) => {
        const producer = req.query.producer
        const total_vote = memory.hget('total_vote', producer)
        res.json(total_vote)
    });

    app.get('/explorer/proxies', (req, res) => {

        const proxied_votes = memory.get("proxied_vote")
        if (!proxied_votes) {
            res.json();
        } else {
            let proxies = []
            for (let i in proxied_votes) {
                proxies.push({
                    proxy: i,
                    proxied_vote: Number(proxied_votes[i])
                })
            }
            res.json(proxies);
        }
    });

    app.get('/explorer/proxy', (req, res) => {

        let size = 30;
        let start = 0;

        if (req.query.page) {
            start = 1 * req.query.page * 30;
        }

        if (req.query.proxy) {
            let proxy_arr = [];
            const obj = memory.hget("proxy", req.query.proxy)

            if (!obj) {
                res.json();
            }

            proxy_arr = obj.proxied;
            if (proxy_arr) {
                let result = proxy_arr.slice(start, start + size);
                res.json(result);
            } else {
                return res.json();
            }

        } else {
            res.json();
        }
    });

    app.get('/explorer/voter', (req, res) => {
        let size = 30;
        let start = 0;

        if (req.query.page) {
            start = 1 * req.query.page * 30;
        }

        if (req.query.producer) {
            const voters = memory.hget("voters", req.query.producer)
            if (!voters) {
                res.json();
            } else {
                let result = voters.slice(start, start + size);
                res.json(result);
            }
        } else {
            res.json();
        }
    });


    /**
     * get contracts info
     */
    app.get('/explorer/contracts', (req, res) => {
        const objs = memory.hgetall("contracts")
        if (!objs) {
            res.json();
        }
        let arr = [];
        for (let obj in objs) {
            let newObj = objs[obj];
            arr.push(newObj);
        }
        arr.sort((a, b) => {
            return b.count - a.count;
        });
        res.json(arr);
    });

    /**
     * get single contract info
     */
    app.get('/explorer/contract/:account', (req, res) => {
        if (!req.params.account) {
            res.status(400).json({ error: 'contract name is null' })
        }
        const obj = memory.hget("contracts", req.params.account)
        if (!obj) {
            res.status(400).json({ error: 'contract name not found' })
        }
        res.json(obj);

    });

    /**
     * get action names by contract name
     */
    app.get('/explorer/contractActions/:contract', (req, res) => {
        if (!req.params.contract) {
            res.status(400).json({ error: 'contract name is null' })
        }
        const obj = redis.hget("contracts", req.params.contract)
        if (!obj) {
            res.json();
        }
        let actions = obj.actions;
        res.json(actions);
    });

    app.get('/explorer/contractTraces', (req, res) => {
        let size = 100;
        let skip = 0;

        if (req.query.size) {
            size = 1 * req.query.size;
        }

        if (req.query.page) {
            skip = 1 * req.query.page * 30;
            size = 30;
        }

        if (req.query.pending === 'true') {
            // collection_name = "ContractTracesPending";
            res.json([])
        }

        if (!req.query.contract) {
            res.json([])
        }

        let sql
        if (req.query.action) {
            sql = `SELECT * FROM fibos_actions WHERE contract='${req.query.contract}' AND action='${req.query.action}' ORDER BY id DESC LIMIT ${size} OFFSET ${skip};`
        } else {
            sql = `SELECT * FROM fibos_actions WHERE contract='${req.query.contract}' ORDER BY id DESC LIMIT ${size} OFFSET ${skip};`
        }

        db.all(sql).then(actions => {
            const newActions = []
            for (const action of actions) {
                const data = JSON.parse(action.rawData)
                const accounts = []
                for (const auth of data.act.authorization) {
                    accounts.push(auth.actor)
                }
                newActions.push({
                    contract: data.act.account,
                    action: data.act.name,
                    accounts,
                    block_num: data.block_num,
                    transaction_id: data.trx_id,
                    data: data.act.data
                })
            }
            res.json(newActions)
        })
    });

}