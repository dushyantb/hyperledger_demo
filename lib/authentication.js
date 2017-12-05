'use strict';

// let crypto = require('crypto');
let jwt = require('jsonwebtoken');

let _privateJWTKey = '';

function verifyToken(req, res, next) {
	jwt.verify(req.token, _privateJWTKey, function(err, decoded) {
		if (err) {
			return res.status(401).json({
				success: false,
				message: 'Failed to authenticate token'
			});
		} else {
			req.username = decoded.username;
			req.orgname = decoded.orgname;
            req.role = decoded.role;
			return next();
		}
	});
}

function setPrivateJWTKey() {
    // _privateJWTKey = crypto.randomBytes(64).toString('base64');
    _privateJWTKey = 'mysecret';
}

function getPrivateJWTKey() {
    return _privateJWTKey;
}

exports.verifyToken = verifyToken;
exports.setPrivateJWTKey = setPrivateJWTKey;
exports.getPrivateJWTKey = getPrivateJWTKey;