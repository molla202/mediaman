const async = require('async');
const mediaSpaceDBO = require('../dbos/media_space.dbo');
const mediaSpaceErrors = require('../errors/media_space.error');
const logger = require('../../logger');

const createMediaSpace = (admin, username, id, cb) => {
    const doc = {
        admin,
        username,
        id,
    };
    async.waterfall([
        (next) => {
            mediaSpaceDBO.save(doc, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: mediaSpaceErrors.createMediaSpaceError,
                        message: 'Error occurred while creating media space',
                    });
                } else if (result) {
                    console.log(result);
                    next(null, result._id);
                } else {
                    next({
                        error: mediaSpaceErrors.createMediaSpaceError,
                        message: 'Failed to create media space',
                    });
                }
            });
        },
    ], cb);
};

module.exports = {
    createMediaSpace,
};
