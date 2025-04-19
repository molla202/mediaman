const async = require('async');
const mongoose = require('mongoose');
const omniflixStudioURI = require('./omniflix_studio');
const logger = require('../logger');

const options = {
    maxPoolSize: 16,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: true,
    useCreateIndex: true,
};

module.exports = {
    init: (cb) => {
        async.waterfall([
            (next) => {
                module.exports.omniflixStudio = mongoose.createConnection(omniflixStudioURI, options, (error) => {
                    if (error) {
                        next(error);
                    } else {
                        logger.info(`Connected to database: ${omniflixStudioURI}`);
                        next(null);
                    }
                });
            },
        ], cb);
    },
};
