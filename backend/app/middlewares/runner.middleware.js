const async = require('async');
const processJSONResponse = require('../utils/response.util');
const { tokenId } = require('../../config').runner;

const isValidRunner = (req, res, cb) => {
    const { token } = req.body;
    async.waterfall([
        (next) => {
            if (token === tokenId) {
                next(null);
            } else {
                next({
                    status: 404,
                    message: 'invalid runner token',
                });
            }
        },
    ], (error) => {
        if (error) {
            processJSONResponse(res, error);
        } else {
            cb();
        }
    });
};

module.exports = isValidRunner;
