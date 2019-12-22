'use strict';

module.exports = (app, memory) => {

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
        if (err || objs == null) {
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
        res.send(total_vote)
    });

    app.get('/explorer/proxies', (req, res) => {
        res.header("Access-Control-Allow-Origin", "*");

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

    app.get('/proxy', (req, res) => {
        res.header("Access-Control-Allow-Origin", "*");

        let size = 30;
        let start = 0;

        if (req.query.page) {
            start = 1 * req.query.page * 30;
        }

        if (req.query.proxy) {
            let proxy_arr = [];
            const obj = memory.hget("proxy", req.query.proxy)

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


}


