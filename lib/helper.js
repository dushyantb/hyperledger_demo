'use strict';

let path = require('path');
let util = require('util');
// let fs = require('fs-extra');
// let User = require('fabric-client/lib/User.js');
let hfc = require('fabric-client');
//
// let ORGS = hfc.getConfigSetting('network-config');
//
// let clients = {};
// let channels = {};
// let caClients = {};
//
// let sleep = async function (sleep_time_ms) {
//     return new Promise(resolve => setTimeout(resolve, sleep_time_ms));
// };

async function getClientForOrg(userorg, username) {
    let config = '-connection-profile-path';

    let client = hfc.loadFromConfig(hfc.getConfigSetting('network' + config));
    client.loadFromConfig(hfc.getConfigSetting(userorg + config));

    await client.initCredentialStores();

    if (username) {
        let user = await client.getUserContext(username, true);
        if (!user) {
            throw new Error(util.format('User was not found:', username));
        } else {

        }
    }
    return client;
}

let getRegisteredUser = async function (username, userorg) {
    try {
        let client = await getClientForOrg(userorg);
        let user = await client.getUserContext(username, true);
        if (user && user.isEnrolled()) {
            return {
                success: true,
                secret: user._enrollmentSecret,
                message: username + ' is already enrolled',
            };
        } else {
            let admins = hfc.getConfigSetting('admins');
            let adminUserObj = await client.setUserContext({username: admins[0].username, password: admins[0].secret});
            let caClient = client.getCertificateAuthority();
            let secret = await caClient.register({
                enrollmentID: username,
                affiliation: userorg.toLowerCase() + '.department1'
            }, adminUserObj);
            user = await client.setUserContext({username: username, password: secret});
            user.setRoles(['test']);

            return {
                success: true,
                secret: user._enrollmentSecret,
                message: username + ' is enrolled successfully',
            };
        }
    } catch (error) {
        return 'failed ' + error.toString();
    }
};


let setupChaincodeDeploy = function () {
    process.env.GOPATH = path.join(__dirname, hfc.getConfigSetting('CC_SRC_PATH'));
};

exports.getClientForOrg = getClientForOrg;
exports.getRegisteredUser = getRegisteredUser;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
