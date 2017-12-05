'use strict';

let util = require('util');
let _ = require('underscore');
let helper = require('../../../lib/helper');

exports.installChaincode = async function (req, res) {
    let cc_details = _.pick(req.body, 'peers', 'chaincodeName', 'chaincodePath', 'chaincodeVersion', 'chaincodeType');

    helper.setupChaincodeDeploy();
    let error_message = null;
    // let tx_id = null;
    try {
        let client = await helper.getClientForOrg(req.orgname, req.username);
        // tx_id = client.newTransactionID(true);
        let request = {
            targets: cc_details.peers,
            chaincodePath: cc_details.chaincodePath,
            chaincodeId: cc_details.chaincodeName,
            chaincodeVersion: cc_details.chaincodeVersion,
            chaincodeType: cc_details.chaincodeType
        };
        let results = await client.installChaincode(request);
        let proposalResponses = results[0];
        let proposal = results[1];

        let all_good = true;
        for (let i in proposalResponses) {
            let one_good = false;
            if (proposalResponses && proposalResponses[i].response &&
                proposalResponses[i].response.status === 200) {
                one_good = true;
            } else {
            }
            all_good = all_good & one_good;
        }
        if (all_good) {
        } else {
            error_message = 'Failed to send install Proposal or receive valid response. Response null or status is not 200'
        }

        if (!error_message) {
            let message = util.format('Successfully install chaincode');
            res.json({
                success: true,
                message: message
            });
        } else {
            let message = util.format('Failed to install due to:%s', error_message);
            throw new Error(message);
        }
    } catch (error) {
        res.status(400).json({
            "message": error.message
        });
    }
};


exports.instantiateChaincode = async function(req, res) {
    let cc_details = _.pick(req.body, 'chaincodeName', 'chaincodeVersion', 'chaincodeType', 'channelName', 'fcn', 'args');

    let error_message = null;
    let eventhubs_in_use = [];

    try {
        let client = await helper.getClientForOrg(req.orgname, req.username);
        let channel = client.getChannel(cc_details.channelName);
        if(!channel) {
            let message = util.format('Channel %s was not defined in the connection profile', cc_details.channelName);
            throw new Error(message);
        }
        let tx_id = client.newTransactionID(true);
        let deployId = tx_id.getTransactionID();

        let request = {
            chaincodeId: cc_details.chaincodeName,
            chaincodeType: cc_details.chaincodeType,
            chaincodeVersion: cc_details.chaincodeVersion,
            args: cc_details.args,
            txId: tx_id
        };

        if (cc_details.fcn)
            request.fcn = cc_details.fcn;

        let results = await channel.sendInstantiateProposal(request, 60000);

        let proposalResponses = results[0];
        let proposal = results[1];

        let all_good = true;
        for (let i in proposalResponses) {
            let one_good = false;
            if (proposalResponses && proposalResponses[i].response &&
                proposalResponses[i].response.status === 200) {
                one_good = true;
            } else {
            }
            all_good = all_good & one_good;
        }

        if (all_good) {
            let promises = [];
            let event_hubs = client.getEventHubsForOrg(req.orgname);
            event_hubs.forEach((eh) => {
                let instantiateEventPromise = new Promise((resolve, reject) => {
                    let event_timeout = setTimeout(() => {
                        let message = 'REQUEST_TIMEOUT:' + eh._ep._endpoint.addr;
                        eh.disconnect();
                        reject(new Error(message));
                    }, 60000);
                    eh.registerTxEvent(deployId, (tx, code) => {
                        clearTimeout(event_timeout);
                        eh.unregisterTxEvent(deployId);

                        if (code !== 'VALID') {
                            let message = until.format('The chaincode instantiate transaction was invalid, code:%s',code);
                            reject(new Error(message));
                        } else {
                            let message = 'The chaincode instantiate transaction was valid.';
                            resolve(message);
                        }
                    }, (err) => {
                        clearTimeout(event_timeout);
                        eh.unregisterTxEvent(deployId);
                        let message = 'Problem setting up the event hub :'+ err.toString();
                        reject(new Error(message));
                    });
                });
                promises.push(instantiateEventPromise);
                eh.connect();
                eventhubs_in_use.push(eh);
            });

            let orderer_request = {
                txId: tx_id,
                proposalResponses: proposalResponses,
                proposal: proposal
            };
            let sendPromise = channel.sendTransaction(orderer_request);
            promises.push(sendPromise);
            let results = await Promise.all(promises);
            let response = results.pop();
            if (response.status === 'SUCCESS') {
            } else {
                error_message = util.format('Failed to order the transaction. Error code: %s',response.status);
            }

            for(let i in results) {
                let event_hub_result = results[i];
                let event_hub = event_hubs[i];
                if(typeof event_hub_result === 'string') {
                } else {
                    if(!error_message) error_message = event_hub_result.toString();
                }
            }
        } else {
            error_message = util.format('Failed to send Proposal and receive all good ProposalResponse');
        }

        eventhubs_in_use.forEach((eh) => {
            eh.disconnect();
        });

        if (!error_message) {
            let message = util.format(
                'Successfully instantiate chaingcode in organization %s to the channel \'%s\'',
                req.orgname, cc_details.channelName);
            res.json({
                success: true,
                message: message
            });
        } else {
            let message = util.format('Failed to instantiate. cause:%s',error_message);
            throw new Error(message);
        }
    } catch (error) {
        res.status(400).json({
            "message": error.message
        });
    }
};

exports.invokeChaincode = async function(req, res){
    let cc_details = _.pick(req.body, 'peers', 'chaincodeName', 'channelName', 'fcn', 'args');

    let error_message = null;
    let eventhubs_in_use = [];
    let tx_id_string = null;
    try {
        let client = await helper.getClientForOrg(req.orgname, req.username);
        let channel = client.getChannel(cc_details.channelName);
        if(!channel) {
            let message = util.format('Channel %s was not defined in the connection profile', cc_details.channelName);
            throw new Error(message);
        }
        let tx_id = client.newTransactionID();
        tx_id_string = tx_id.getTransactionID();

        let request = {
            chaincodeId: cc_details.chaincodeName,
            fcn: cc_details.fcn,
            args: cc_details.args,
            chainId: cc_details.channelName,
            txId: tx_id
        };

        let results = await channel.sendTransactionProposal(request);

        let proposalResponses = results[0];
        let proposal = results[1];

        let all_good = true;
        for (let i in proposalResponses) {
            let one_good = false;
            if (proposalResponses && proposalResponses[i].response &&
                proposalResponses[i].response.status === 200) {
                one_good = true;
            } else {
            }
            all_good = all_good & one_good;
        }

        if (all_good) {
            let promises = [];
            let event_hubs = client.getEventHubsForOrg(req.orgname);

            event_hubs.forEach((eh) => {
                let invokeEventPromise = new Promise((resolve, reject) => {
                    let event_timeout = setTimeout(() => {
                        let message = 'REQUEST_TIMEOUT:' + eh._ep._endpoint.addr;
                        eh.disconnect();
                        reject(new Error(message));
                    }, 3000);
                    eh.registerTxEvent(tx_id_string, (tx, code) => {
                        clearTimeout(event_timeout);
                        eh.unregisterTxEvent(tx_id_string);

                        if (code !== 'VALID') {
                            let message = until.format('The invoke chaincode transaction was invalid, code:%s',code);
                            reject(new Error(message));
                        } else {
                            let message = 'The invoke chaincode transaction was valid.';
                            resolve(message);
                        }
                    }, (err) => {
                        clearTimeout(event_timeout);
                        eh.unregisterTxEvent(tx_id_string);
                        let message = 'Problem setting up the event hub :'+ err.toString();
                        reject(new Error(message));
                    });
                });
                promises.push(invokeEventPromise);
                eh.connect();
                eventhubs_in_use.push(eh);
            });

            let orderer_request = {
                txId: tx_id,
                proposalResponses: proposalResponses,
                proposal: proposal
            };

            let sendPromise = channel.sendTransaction(orderer_request);
            promises.push(sendPromise);
            let results = await Promise.all(promises);
            let response = results.pop();
            if (response.status === 'SUCCESS') {
            } else {
                error_message = util.format('Failed to order the transaction. Error code: %s',response.status);
            }

            for(let i in results) {
                let event_hub_result = results[i];
                let event_hub = event_hubs[i];
                if(typeof event_hub_result === 'string') {
                } else {
                    if(!error_message) error_message = event_hub_result.toString();
                }
            }
        } else {
            error_message = util.format('Failed to send Proposal and receive all good ProposalResponse');
        }

        eventhubs_in_use.forEach((eh) => {
            eh.disconnect();
        });

        if (!error_message) {
            let message = util.format(
                'Successfully invoked the chaincode %s to the channel \'%s\'',
                req.orgname, cc_details.channelName);
            res.json({
                success: true,
                message: message,
                tx: tx_id_string
            });
        } else {
            let message = util.format('Failed to invoke chaincode. cause:%s',error_message);
            throw new Error(message);
        }
    } catch (error) {
        res.status(400).json({
            "message": error.message
        });
    }
};

exports.queryChaincode = async function(req, res){
    let query_details = _.pick(req.body, 'peers', 'chaincodeName', 'channelName', 'fcn', 'args');

    try {
        let client = await helper.getClientForOrg(req.orgname, req.username);
        let channel = client.getChannel(query_details.channelName);
        if(!channel) {
            let message = util.format('Channel %s was not defined in the connection profile', query_details.channelName);
            throw new Error(message);
        }

        let request = {
            targets : query_details.peers,
            chaincodeId: query_details.chaincodeName,
            fcn: query_details.fcn,
            args: query_details.args
        };
        let response_payloads = await channel.queryByChaincode(request);

        if (response_payloads) {
            for (let i = 0; i < response_payloads.length; i++) {
                res.json({
                    success: true,
                    asset: query_details.args[0],
                    value: response_payloads[i].toString('utf8')
                });
            }
        } else {
            res.json({
                success: true,
                asset: query_details.args[0],
                value: null
            });
        }
    } catch(error) {
        res.status(400).json({
            "message": error.message
        });
    }
};

exports.getTransaction = async function(req, res){
    let tx_details = _.pick(req.body, 'peers', 'channelName', 'txId');

    try {
        let client = await helper.getClientForOrg(req.orgname, req.username);
        let channel = client.getChannel(tx_details.channelName);
        if(!channel) {
            let message = util.format('Channel %s was not defined in the connection profile', tx_details.channelName);
            throw new Error(message);
        }

        let response_payload = await channel.queryTransaction(tx_details.txId, tx_details.peers);
        if (response_payload) {
            res.json({
                success: true,
                tx: response_payload
            });
        } else {
            res.json({
                success: true,
                tx: null
            });
        }
    } catch(error) {
        res.status(400).json({
            "message": error.message
        });
    }
};