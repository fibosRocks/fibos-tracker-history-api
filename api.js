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

app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type,Content-Length, Authorization, Accept,X-Requested-With");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("X-Powered-By", ' 3.2.1')
    if (req.method == "OPTIONS") {
        res.send(200);/*让options请求快速返回*/
    } else {
        next();
    }
});

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