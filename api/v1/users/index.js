'use strict';

const express = require('express');

let controller = require('./users.controller');
let auth = require('../../../lib/authentication');

let router = express.Router();

router.post('/signup', controller.registerUser);

module.exports = router;


