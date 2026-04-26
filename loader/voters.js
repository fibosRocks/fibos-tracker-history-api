const axios = require("axios");
const config = require('../config/explorer.json');
const bigInt = require("big-integer");
const delay = require('delay');

const httpEndPoints = config.httpEndPoints;

module.exports = (memory, db) => {

    var voters = [];
    var bpcs = {};
    var proxy = {};
    var nextKey = "";

    // progress
    loop();
    setInterval(loop, 1000 * 60 * 10);
    cacheProducers();
    setInterval(cacheProducers, 1000 * 100);

    /**
     * get http endpoint by random
     */
    function getEndPoint() {
        let random = Math.floor(Math.random() * httpEndPoints.length);
        return httpEndPoints[random];
    }


    function loop() {
        refresh().then(() => {
            for (let i in proxy) {
                // 统计代理总得票
                let last_vote_weight = 0
                let staked = 0
                const owner = i
                proxy[i].proxied.forEach(item => {
                    staked += Number(item.staked)
                    last_vote_weight += Number(item.last_vote_weight)
                })
                proxy[i].total_vote = staked
                // 排序被代理人
                if (proxy[i].proxied.length > 0) {
                    proxy[i].proxied.sort(function (a, b) {
                        return Number(b.staked) - Number(a.staked);
                    });
                    // 代理人信息写入redis
                    memory.hset("proxy", i, JSON.stringify(proxy[i]));
                    memory.hset("proxied_vote", i, JSON.stringify(staked));
                }
                // 代理写入节点得票
                proxy[i].producers.forEach(producer => {
                    let exist = false
                    for (let j in bpcs[producer]) {
                        if (bpcs[producer][j].owner == owner) {
                            bpcs[producer][j].staked = staked + Number(bpcs[producer][j].staked)
                            bpcs[producer][j].last_vote_weight = last_vote_weight + Number(bpcs[producer][j].last_vote_weight)
                            bpcs[producer][j].is_proxy = true
                            exist = true
                        }
                    }
                    if (!exist) {
                        bpcs[producer].push({ owner, staked, last_vote_weight, is_proxy: true })
                    }
                })
            }
            //sort by last_vote_weight
            for (let i in bpcs) {
                bpcs[i].sort(function (a, b) {
                    return b.last_vote_weight - a.last_vote_weight;
                });
                memory.hset("voters", i, JSON.stringify(bpcs[i]));
                let total_vote = 0;
                bpcs[i].forEach(voter => {
                    total_vote += 1 * voter.staked;
                });
                memory.hset("total_vote", i, JSON.stringify(total_vote));
            }
            voters = [];
            bpcs = {};
            proxy = {};
            nextKey = "";
            console.log("get voters alive");
        });
    }

    function refresh() {
        return getVoterloop();
    }

    function getVoterloop() {
        return getVoters().then(more => {
            //for local test 
            //return Promise.resolve();
            //
            if (more) {
                console.log(voters.length);
                nextKey = voters[voters.length - 1].owner;
                //console.log("nextKey:", nextKey);
                return getVoterloop();
            }
        }).catch(async err => {
            console.error(err);
            await delay(2000);
            console.log("retry");
            return getVoterloop();
        });
    }

    function getVoters() {
        const httpEndPoint = getEndPoint();
        // convert key from string to uint_64
        let lower_value = string_to_name(nextKey).add(1);
        let lower_bound = lower_value.toString(10);

        return axios.post(httpEndPoint + "/v1/chain/get_table_rows", {
            "json": true,
            "code": "eosio",
            "scope": "eosio",
            "table": "voters",
            "table_key": "",
            "lower_bound": lower_bound,
            "upper_bound": "",
            "limit": 1000
        }).then(res => {
            const { data } = res;
            voters = voters.concat(data.rows);
            data.rows.forEach(element => {
                if (element.proxy) {
                    //console.log();
                    if (!proxy[element.proxy]) {
                        proxy[element.proxy] = {
                            producers: [],
                            proxied: []
                        };
                    }
                    proxy[element.proxy].proxied.push(element);
                }
                if (element.is_proxy) {
                    //console.log();
                    if (!proxy[element.owner]) {
                        proxy[element.owner] = {
                            producers: [],
                            proxied: []
                        };
                    }
                    if (element.proxy) {
                        console.error("proxy and is_proxy both true");
                    } else {
                        proxy[element.owner].producers = element.producers;
                    }
                }
                if (element.producers.length > 0) {
                    element.producers.forEach(producer => {
                        if (!bpcs[producer]) {
                            bpcs[producer] = [];
                        }
                        bpcs[producer].push({
                            "owner": element.owner,
                            "staked": element.staked,
                            "last_vote_weight": element.last_vote_weight,
                            "is_proxy": false
                        })
                    });

                }
            });
            return (data.more);
        })
    }

    function cacheProducers() {

        function getProducers(producers, lower_bound) {
            const httpEndPoint = getEndPoint();
            return axios.post(httpEndPoint + "/v1/chain/get_table_rows", {
                "json": true,
                "code": "eosio",
                "scope": "eosio",
                "table": "producers",
                "table_key": "",
                "lower_bound": lower_bound,
                "upper_bound": "",
                "limit": 1000
            }).then(res => {
                const { data } = res
                let rows = data.rows;
                producers = producers.concat(rows);
                if (data.more) {
                    let last_key = rows[rows.length - 1].owner;
                    let lower_value = string_to_name(last_key).add(1);
                    let new_lower_bound = lower_value.toString(10);
                    return getProducers(producers, new_lower_bound);
                } else {
                    return producers;
                }
            })
        }

        let producers = [];

        getProducers(producers, "").then(producers => {
            producers.sort((a, b) => {
                return 1 * b.total_votes - 1 * a.total_votes;
            });
            memory.set("producers", JSON.stringify(producers));
        })

    }


    function char_to_symbol(c) {
        if (c >= 'a' && c <= 'z')
            return c.charCodeAt(0) - 97 + 6;
        //return 1 * (c - 'a') + 6;
        if (c >= '1' && c <= '5')
            //return 1 * (c - '1') + 1;
            return 1 * c;
        return 0;
    }

    // Each char of the string is encoded into 5-bit chunk and left-shifted
    // to its 5-bit slot starting with the highest slot for the first char.
    // The 13th char, if str is long enough, is encoded into 4-bit chunk
    // and placed in the lowest 4 bits. 64 = 12 * 5 + 4
    function string_to_name(name_str) {
        let str = name_str.split("");
        let name = bigInt(0);
        let value = bigInt(0);
        let i = 0;
        for (; str[i] && i < 12; ++i) {
            // NOTE: char_to_symbol() returns char type, and without this explicit
            // expansion to uint64 type, the compilation fails at the point of usage
            // of string_to_name(), where the usage requires constant (compile time) expression.
            value = bigInt(char_to_symbol(str[i]) & 0x1f).shiftLeft((64 - 5 * (i + 1)));
            name = name.or(value);
        }

        // The for-loop encoded up to 60 high bits into uint64 'name' variable,
        // if (strlen(str) > 12) then encode str[12] into the low (remaining)
        // 4 bits of 'name'
        /* if (i == 12)
            name |= char_to_symbol(str[12]) & 0x0F; */
        return name;
    }
}