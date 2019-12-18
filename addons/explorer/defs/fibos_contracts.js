module.exports = db => {
    let FibosContracts = db.define('fibos_contracts', {
        id: { type: 'integer', unique: true, required: true, key: true },//global_sequence
        account: { type: "text", size: 12, required: true, index: "contracts_account_index" },
        type: String,
        data: {
            required: false,
            type: "text",
            big: true
        },
        block_num: { type: 'integer', required: true },
        trx_id: { type: "text", required: true }
    }, {
        hooks: {},
        methods: {},
        validations: {},
        functions: {},
        ACL: function (session) {
            return {
                '*': {
                    find: true,
                    read: true
                }
            };
        }
    });

    // FibosContracts.hasOne('creator', FibosContracts, {});
    return FibosContracts;
}