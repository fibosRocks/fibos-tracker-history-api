'use strict';

module.exports = (app, memory, db) => {

    app.get('/explorer/stats', (req, res) => {
        memory.get("dashboard", function (err, obj) {
            if (err || obj == null) {
                res.json();
            }
            res.json(JSON.parse(obj));
        });
    });

    app.get('/explorer/resource', (req, res) => {
        memory.get("resource", function (err, obj) {
            if (err || obj == null) {
                res.json();
            }
            obj = JSON.parse(obj);
            res.json(obj);
        });
    });

    app.get('/explorer/producers', (req, res) => {
        memory.get("producers", (err, result) => {
            if (err) {
                res.error(err);
            }
            let producers = JSON.parse(result);
            memory.hgetall("total_vote", function (err, objs) {
                if (err || objs == null) {
                    res.json();
                }
                producers.forEach((producer) => {
                    producer.eos_votes = 1 * objs[producer.owner];
                });
                res.json(producers);
            });
        });
    });

    app.get('/explorer/vote', (req, res) => {
        if (req.query.producer) {
            memory.hget("total_vote", req.query.producer, function (err, obj) {
                if (err || obj == null) {
                    res.json();
                } else {
                    res.json(1 * obj);
                }
            });
        } else {
            res.json();
        }
    });

    app.get('/explorer/proxies', (req, res) => {
        memory.hgetall("proxied_vote", function (err, objs) {
            if (err || objs == null) {
                res.json();
            }
            let proxies = []
            for (let i in objs) {
                proxies.push({
                    proxy: i,
                    proxied_vote: Number(objs[i])
                })
            }
            res.json(proxies);
        });
    });

    app.get('/explorer/proxy', (req, res) => {

        let size = 30;
        let start = 0;

        if (req.query.page) {
            start = 1 * req.query.page * 30;
        }

        if (req.query.proxy) {
            let proxy_arr = [];
            memory.hget("proxy", req.query.proxy, function (err, obj) {
                if (err || obj == null) {
                    res.json();
                }
                proxy_arr = JSON.parse(obj).proxied;
                if (proxy_arr) {
                    let result = proxy_arr.slice(start, start + size);
                    res.json(result);
                } else {
                    return res.json();
                }
            });
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
            let voter_arr = [];
            memory.hget("voters", req.query.producer, function (err, obj) {
                if (err || obj == null) {
                    res.json();
                }
                voter_arr = JSON.parse(obj);
                if (voter_arr) {
                    let result = voter_arr.slice(start, start + size);
                    res.json(result);
                } else {
                    return res.json();
                }
            });
        } else {
            res.json();
        }
    });


    /**
     * get contracts info
     */
    app.get('/explorer/contracts', (req, res) => {
        memory.hgetall("contracts", function (err, objs) {
            if (err || objs == null) {
                res.json();
            }
            let arr = [];
            for (let obj in objs) {
                let newObj = JSON.parse(objs[obj]);
                newObj.abi = null;
                arr.push(newObj);
            }
            arr.sort((a, b) => {
                return b.count - a.count;
            });
            res.json(arr);
        });
    });

    /**
     * get single contract info
     */
    app.get('/explorer/contract/:account', (req, res) => {
        if (!req.params.account) {
            res.status(400).json({ error: 'contract name is null' })
        }
        memory.hget("contracts", req.params.account, function (err, obj) {
            if (err || obj == null) {
                res.status(400).json({ error: 'contract name not found' })
            }
            res.json(JSON.parse(obj));
        });

    });

    /**
     * get action names by contract name
     */
    app.get('/explorer/contractActions/:contract', (req, res) => {
        if (!req.params.contract) {
            res.status(400).json({ error: 'contract name is null' })
        }
        memory.hget("contracts", req.params.contract, function (err, obj) {
            if (err || obj == null) {
                res.json();
            }
            let actions = JSON.parse(obj).actions;
            res.json(actions);
        });
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