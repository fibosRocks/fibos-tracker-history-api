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
        res.json(producers)
    });

    app.get('/explorer/vote', (req, res) => {
        const producer = req.params.producer
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

    app.get('/explorer/voter', (req, res) => {
        let size = 30;
        let start = 0;

        if (req.params.page) {
            start = 1 * req.params.page * 30;
        }

        if (req.params.producer) {
            const voters = memory.hget("voters", req.params.producer)
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


