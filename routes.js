'use strict';

const auth = require('./lib/authentication');

module.exports = function (app) {
    app.use('/api/users', require('./api/v1/users'));
    app.use('/api/channel', auth.verifyToken, require('./api/v1/channel'));
    app.use('/api/chaincode', auth.verifyToken, require('./api/v1/chaincode'));

    // All undefined asset or api routes should return a 404
    app.route('/:url(api)/*')
        .get(function pageNotFound(req, res) {
            const viewFilePath = '404';
            const statusCode = 404;
            const result = {
                status: statusCode
            };

            res.status(result.status);
            res.render(viewFilePath, {}, function (err, html) {
                if (err) {
                    return res.status(result.status).json(result);
                }

                res.send(html);
            });
        });
};