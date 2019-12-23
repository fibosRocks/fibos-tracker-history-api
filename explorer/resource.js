/**
 * calculate ram net cpu price
 */
const axios = require('axios');
const config = require('../config/explorer.json');
const delay = require('delay');

const httpEndPoints = config.httpEndPoints;

module.exports = (memory, db) => {

    refresh();
    setInterval(() => {
        refresh()
    }, 1000 * 30);

    /**
     * get http endpoint by random
     */
    function getEndPoint() {
        let random = Math.floor(Math.random() * httpEndPoints.length);
        return httpEndPoints[random];
    }

    function refresh() {
        return getResourcePriceLoop().then(() => {
            console.log("get resource alive");
        })
    }

    function getResourcePriceLoop() {
        return Promise.all([getRamPrice(), getEosInMarket(), getRamProgress(), getBWPrice(), getTotalFo(), cacheFoPrice()]).then(([ramPrice, ramEOS, [ram_reserved, ram_total], [cpu, net], total_fo, fo_usdt_price]) => {
            const resource = {
                "ram": ramPrice,
                "eos_in_ram": ramEOS,
                "ram_reserved": ram_reserved,
                "ram_total": ram_total,
                "cpu": cpu,
                "net": net,
                "total_fo": total_fo,
                "fo_usdt_price": fo_usdt_price
            }
            console.log("resource:", resource);
            memory.set("resource", JSON.stringify(resource));
        }).catch(async err => {
            console.error(err);
            await delay(2000);
            console.log("retry");
            getResourcePriceLoop();
        });
    }

    function post(api_url, post_json) {
        const httpEndPoint = getEndPoint();
        return axios.post(httpEndPoint + api_url, post_json).then(res => {
            return res.data
        })
    }

    function getRamPrice() {
        let api_url = "/v1/chain/get_table_rows";
        let post_json = {
            "json": true,
            "code": "eosio",
            "scope": "eosio",
            "table": "rammarket"
        };
        return post(api_url, post_json).then(obj => {
            let object = obj.rows[0];
            let base = 1 * object.base.balance.toString().split(" ")[0];
            let quote = 1 * object.quote.balance.toString().split(" ")[0];
            return (quote / base * 1000);//EOS / KB + total
        });
    }

    function getRamProgress() {
        let api_url = "/v1/chain/get_table_rows";
        let post_json = {
            "json": true,
            "code": "eosio",
            "scope": "eosio",
            "table": "global"
        };
        return post(api_url, post_json).then(obj => {
            let object = obj.rows[0];
            let max_ram_size = 1 * object.max_ram_size;
            let total_ram_bytes_reserved = 1 * object.total_ram_bytes_reserved;
            return ([total_ram_bytes_reserved, max_ram_size]);
        });
    }

    function getBWPrice() {
        let api_url = "/v1/chain/get_account";
        let post_json = {
            "account_name": "rockrockrock"
        };
        return post(api_url, post_json).then(object => {
            let cpu = 1 * object.cpu_weight / 10000 / object.cpu_limit.max * 1000;// EOS / ms
            let net = 1 * object.net_weight / 10000 / object.net_limit.max * 1000;// EOS / KB
            return ([cpu, net]);
        });
    }

    function getEosInMarket() {

        let api_url = "/v1/chain/get_table_rows";
        let post_json = {
            "json": true,
            "code": "eosio.token",
            "scope": "eosio.ram",
            "table": "accounts"
        };
        return post(api_url, post_json).then(obj => {
            let object = obj.rows[0];
            let eos_in_ram = 1 * object.balance.quantity.toString().split(" ")[0];
            return eos_in_ram;
        });
    }

    function getTotalFo() {

        let api_url = "/v1/chain/get_table_rows";
        let post_json = {
            "json": true,
            "code": "eosio.token",
            "scope": "eosio",
            "table": "stats"
        };
        return post(api_url, post_json).then(obj => {
            let total;
            obj.rows.forEach(item => {
                if (item.supply.toString().split(" ")[1] === "FO") {
                    let supply = 1 * item.supply.toString().split(" ")[0];
                    let reserve_supply = 1 * item.reserve_supply.toString().split(" ")[0];
                    total = supply + reserve_supply;
                }
            })
            return total;
        });
    }

    function cacheFoPrice() {

        let api_url = "/v1/chain/get_table_rows";
        let post_json = {
            "json": true,
            "code": "eosio.token",
            "scope": "eosio.token",
            "table": "swapmarket",
            limit: 100
        };
        return post(api_url, post_json).then(res => {
            for (const item of res.rows) {
                if (item.tokenx.contract == "eosio" && item.tokeny.contract == "eosio") {
                    const getQuantity = function (quantity) {
                        return {
                            amount: Number(quantity.split(" ")[0]),
                            symbol: quantity.split(" ")[1]
                        }
                    }
                    const tokenx = getQuantity(item.tokenx.quantity)
                    const tokeny = getQuantity(item.tokeny.quantity)
                    if (tokenx.symbol == "FOUSDT" && tokeny.symbol == "FO") {
                        return tokenx.amount / tokeny.amount
                    } else if (tokenx.symbol == "FO" && tokeny.symbol == "FOUSDT") {
                        return tokeny.amount / tokenx.amount
                    }
                }
            }
        })
    }
}