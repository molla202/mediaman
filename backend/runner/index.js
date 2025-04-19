const async = require('async');
const request = require('request');
const logger = require('../logger');
const { ip, port } = require('../config').runner;

module.exports = {
    init: (cb) => {
        console.log('Trying to connect to runner');
        async.waterfall([
            (next) => {
                const uri = `http://${ip}:${port}/status`;
                const options = {
                    method: 'GET',
                    timeout: 100000,
                };
                request(uri, options, (error, response) => {
                    if (error) {
                        console.log(error);
                        next(error);
                    } else {
                        const body = JSON.parse(response.body);
                        if (body.success && body.success === true) {
                            logger.info(`Connected to Runner: http://${ip}:${port}`);
                            next(null);
                        } else {
                            next('Runner connection failed.');
                        }
                    }
                });
            },
        ], cb);
    },
};
