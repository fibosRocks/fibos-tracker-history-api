module.exports = {
    "eosio/setabi": (db, messages) => {
        messages.forEach(msg => {
            const data = msg.act.data;
            const account = data.account;
            const abi = data.abi;
            const global_sequence = msg.receipt.global_sequence
            console.log('setabi', account, msg.trx_id)

            let FibosContracts = db.models.fibos_contracts;

            if (FibosContracts.oneSync({ id: global_sequence })) return;

            FibosContracts.createSync({
                id: global_sequence,
                account,
                type: "setabi",
                data: abi,
                block_num: msg.block_num,
                trx_id: msg.trx_id
            })
        })
    },
    "eosio/setcode": (db, messages) => {
        messages.forEach(msg => {
            let data = msg.act.data;
            let account = data.account;
            let code = data.code;
            const global_sequence = msg.receipt.global_sequence
            console.log('setcode', account, msg.trx_id)

            let FibosContracts = db.models.fibos_contracts;

            if (FibosContracts.oneSync({ id: global_sequence })) return;

            FibosContracts.createSync({
                id: global_sequence,
                account,
                type: "setcode",
                data: code,
                block_num: msg.block_num,
                trx_id: msg.trx_id
            })
        })
    },
}