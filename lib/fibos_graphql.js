const axios = require('axios')

const graphql = function (url, data) {
    return axios({
        method: 'POST',
        headers: { 'Content-Type': 'application/graphql' },
        data,
        url,
    })
}

const getSymbolTxs = function (account, limit, skip) {
    return graphql('http://api.tracker.fibos.io/1.0/app/',
        `{
            find_symbolTransactions(
                limit: ${limit},
                skip:  ${skip},
                order: "-global_sequence",
                where: {
                    from_account:"${account}"
                }
            ){
                    producer_block_id
                    global_sequence
                    trx_id
                    block_num
                    from_account
                    to_account
                    contract
                    symbol
                    action
                    data
                    created
                    id
            }
        }`
    ).then(res => {
        const actions = res.data.data.find_symbolTransactions
        const format_actions = []
        for (const action of actions) {
            action.created = action.created.slice(0, -1)
            format_actions.push(action)
        }
        return format_actions
    })
}

module.exports = {
    getSymbolTxs
}

