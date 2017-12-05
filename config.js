'use strict';

let hfc = require('fabric-client');
let path = require('path');

let file = 'network-config.yaml';

hfc.setConfigSetting('network-connection-profile-path',path.join(__dirname, './artifacts',file));
hfc.setConfigSetting('Org1-connection-profile-path',path.join(__dirname, './artifacts','org1.yaml'));
hfc.setConfigSetting('Org2-connection-profile-path',path.join(__dirname, './artifacts','org2.yaml'));
hfc.addConfigFile(path.join(__dirname, 'config.json'));
