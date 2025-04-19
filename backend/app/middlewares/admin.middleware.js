const processJSONResponse = require('../utils/response.util');
const logger = require('../../logger');

const isAdmin = (req, res, cb) => {
    let key = null;
    if (req.headers.key && req.headers.key) {
        key = req.headers.key;
    } else if (req.query && req.query.key) {
        key = req.query.key;
    } else if (req.body && req.body.key) {
        key = req.body.key;
    }
    if (key && key === 'OFStudioAdmin1122') {
        cb();
    } else {
        logger.error('Admin key is required.');
        processJSONResponse(res, {
            status: 400,
            message: 'Admin Key is required.',
        });
    }
};

module.exports = {
    isAdmin,
};
