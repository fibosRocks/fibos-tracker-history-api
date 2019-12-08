const swaggerJSDoc = require('swagger-jsdoc');
const bodyparser = require('body-parser');
const sqlite = require('sqlite');

const serverPort = 8090

const swaggerSpec = swaggerJSDoc({
    definition: {
        info: {
            title: 'FIBOS history API by FibosRocks',
            version: '1.0.0',
        },
    },
    apis: ['./api/v2.history.js'],
});

const express = require('express');
const app = express();
app.use(bodyparser.json({
    strict: false,
}));
app.use('/', express.static(__dirname + '/html'));

// db
sqlite.open('./fibos_chain.db').then(db => {
    require('./api/v2.history.js')(app, db, swaggerSpec);
})

process.on('uncaughtException', (err) => {
    console.error(`======= UncaughtException API Server :  ${err}`);
});

const http = require('http').Server(app);
http.listen(serverPort, () => {
    console.log('=== Listening on port:', serverPort);
});
http.on('error', (err) => {
    console.error('=== Http server error', err);
});