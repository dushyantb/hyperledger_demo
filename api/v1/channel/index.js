'use strict';

let express = require('express');
let controller = require('./channels.controller');
let auth = require('../../../lib/authentication');

let router = express.Router();

router.post('/', controller.createChannel);    //Route for registering a new User
router.post('/join', controller.joinChannel);

module.exports = router;


