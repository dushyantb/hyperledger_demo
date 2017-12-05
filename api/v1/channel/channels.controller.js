'use strict';

let fs = require('fs');

let path = require('path');
let util = require('util');
let _ = require('underscore');
let helper = require('../../../lib/helper');

exports.createChannel = async function (req, res) {
    let channel_details = _.pick(req.body, 'channelName', 'channelConfigPath');

    try {
        let client = await helper.getClientForOrg(req.orgname, req.username);
        let envelope = fs.readFileSync(path.join(__dirname, channel_details.channelConfigPath));
        let channelConfig = client.extractChannelConfig(envelope);

        let signature = client.signChannelConfig(channelConfig);

        let request = {
            config: channelConfig,
            signatures: [signature],
            name: channel_details.channelName,
            txId: client.newTransactionID(true)
        };

        let response = await client.createChannel(request);
        if (response && response.status === 'SUCCESS') {
            res.json({
                success: true,
                message: 'Channel \'' + channel_details.channelName + '\' created Successfully'
            });
        } else {
            throw new Error('Failed to create the channel \'' + channel_details.channelName + '\'');
        }
    } catch (error) {
        res.status(400).json({
            "message": error.message
        });
    }
};

exports.joinChannel = async function (req, res) {
    let channel_details = _.pick(req.body, 'channelName', 'peers');

    let error_message = null;
    let all_eventhubs = [];
    try {
        let client = await helper.getClientForOrg(req.orgname, req.username);
        let channel = client.getChannel(channel_details.channelName);
        if (!channel) {
            let message = util.format('Channel %s was not defined in the connection profile', channel_details.channelName);
            throw new Error(message);
        }

        let request = {
            txId: client.newTransactionID(true)
        };
        let genesis_block = await channel.getGenesisBlock(request);

        let promises = [];
        let block_registration_numbers = [];
        let event_hubs = client.getEventHubsForOrg(req.orgname);

        event_hubs.forEach((eh) => {
            let configBlockPromise = new Promise((resolve, reject) => {
                let event_timeout = setTimeout(() => {
                    let message = 'REQUEST_TIMEOUT:' + eh._ep._endpoint.addr;
                    eh.disconnect();
                    reject(new Error(message));
                }, 60000);
                let block_registration_number = eh.registerBlockEvent((block) => {
                    clearTimeout(event_timeout);
                    if (block.data.data.length === 1) {
                        let channel_header = block.data.data[0].payload.header.channel_header;
                        if (channel_header.channel_id === channel_details.channelName) {
                            let message = util.format('EventHub % has reported a block update for channel %s', eh._ep._endpoint.addr, channel_details.channelName);
                            resolve(message);
                        } else {
                            let message = util.format('Unknown channel block event received from %s', eh._ep._endpoint.addr);
                            reject(new Error(message));
                        }
                    }
                }, (err) => {
                    clearTimeout(event_timeout);
                    let message = 'Problem setting up the event hub :' + err.toString();
                    reject(new Error(message));
                });
                block_registration_numbers.push(block_registration_number);
                all_eventhubs.push(eh);
            });
            promises.push(configBlockPromise);
            eh.connect();
        });

        let join_request = {
            targets: channel_details.peers,
            txId: client.newTransactionID(true),
            block: genesis_block
        };

        let join_promise = channel.joinChannel(join_request);
        promises.push(join_promise);
        let results = await Promise.all(promises);

        let peers_results = results.pop();
        for (let i in peers_results) {
            let peer_result = peers_results[i];
            if (peer_result.response && peer_result.response.status === 200) {
            } else {
                error_message = util.format('Failed to joined peer to the channel %s', channel_details.channelName);
            }
        }

        for (let i in results) {
            let event_hub_result = results[i];
            let event_hub = event_hubs[i];
            let block_registration_number = block_registration_numbers[i];
            if (typeof event_hub_result === 'string') {
            } else {
                if (!error_message) error_message = event_hub_result.toString();
            }
            event_hub.unregisterBlockEvent(block_registration_number);
        }

        all_eventhubs.forEach((eh) => {
            eh.disconnect();
        });

        if (!error_message) {
            let message = util.format(
                'Successfully joined peers in organization %s to the channel:%s',
                req.orgname, channel_details.channelName);
            res.json({
                success: true,
                message: message
            });
        } else {
            let message = util.format('Failed to join all peers to channel. cause:%s', error_message);
            throw new Error(message);
        }
    } catch (error) {
        error_message = error.toString();
    }
};