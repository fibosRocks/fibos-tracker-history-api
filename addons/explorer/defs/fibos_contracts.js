module.exports = db => {
    let FibosContracts = db.define('fibos_contracts', {
        id: { type: 'serial', key: true },
        global_sequence: { type: 'integer' },
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