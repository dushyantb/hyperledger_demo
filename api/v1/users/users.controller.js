'use strict';

let hfc = require('fabric-client');
let _ = require('underscore');
let auth = require('../../../lib/authentication');
let helper = require('../../../lib/helper');
let jwt = require('jsonwebtoken');

exports.registerUser = async function(req, res) {
	let user_details = _.pick(req.body, 'username', 'orgname', 'role');
	let token = jwt.sign({
		exp: Math.floor(Date.now() / 1000) + parseInt(hfc.getConfigSetting('jwt_expiretime')),
		username: user_details.username,
        orgname: user_details.orgname,
        role: user_details.role
	}, auth.getPrivateJWTKey());
	
	let response = await helper.getRegisteredUser(user_details.username, user_details.orgname);

	if (response && typeof response !== 'string') {
		response.token = token;
		res.json(response);
	} else {
		res.json({success: false, message: response});
	}	
};
