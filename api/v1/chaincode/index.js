'use strict';

let express = require('express');
let controller = require('./chaincode.controller');
let auth = require('../../../lib/authentication');

let router = express.Router();

router.post('/install', controller.installChaincode);
router.post('/instantiate', controller.instantiateChaincode);
router.post('/invoke', controller.invokeChaincode);
router.post('/query', controller.queryChaincode);
router.post('/queryTx', controller.getTransaction);

module.exports = router;


