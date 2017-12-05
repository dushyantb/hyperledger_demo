'use strict';

let bodyParser = require('body-parser');
let bearerToken = require('express-bearer-token');
let cors = require('cors');
let express = require('express');
let hfc = require('fabric-client');
let http = require('http');

let auth = require('./lib/authentication');
let helper = require('./lib/helper');
auth.setPrivateJWTKey();

require('./config.js');

let app = express();

const host = process.env.HOST || hfc.getConfigSetting('host');
const port = process.env.PORT || hfc.getConfigSetting('port');

app.options('*', cors());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bearerToken());

let server = http.createServer(app).listen(port, function() {
    console.log('****************** SERVER STARTED ************************');
    console.log('**************  http://' + host + ':' + port + '  ******************');
});
server.timeout = 240000;

require('./routes') (app);

helper.getClientForOrg('Org1', 'Jim').then((client) => {
    let eh = client.getEventHubsForOrg('Org1');
    eh[0].registerBlockEvent(
        (block) => {
            console.log(JSON.stringify(block.data.data[0]))
        },
        (err) => {
            console.log('Error');
        }
    );
});

module.exports = app;
