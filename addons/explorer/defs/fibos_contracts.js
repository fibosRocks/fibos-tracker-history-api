module.exports = db => {
    let FibosContracts = db.define('fibos_contracts', {
        id: { type: 'integer', unique: true, required: true, key: true },//global_sequence
        account: { type: "text", size: 12, required: true },
        type: String,
        data: {
            required: false,
            type: "text",
            big: true
        },
        block_num: { type: 'integer' }
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