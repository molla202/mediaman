const joi = require('@hapi/joi');
const { validate } = require('./common');

const restartStudioSchema = joi.object().keys({
    data: joi.object().keys({
        youtube: joi.object().keys({
            clientId: joi.string().required(),
            clientSecret: joi.string().required(),
            redirectUri: joi.string().required(),
        }),
        twitch: joi.object().keys({
            clientId: joi.string().required(),
            clientSecret: joi.string().required(),
            redirectUri: joi.string().required(),
        }),
        facebook: joi.object().keys({
            apiUrl: joi.string().required(),
            appId: joi.string().required(),
            appSecret: joi.string().required(),
        }),
    }).required(),
});

const restartNginxSchema = joi.object().keys({});

const getStudioConfigSchema = joi.object().keys({});

const getMediaSpaceSlotsSchema = joi.object().keys({});

const getHardwareSpecsSchema = joi.object().keys({});

const getHardwareStatsSchema = joi.object().keys({});

const updateMediaSpaceLeaseSchema = joi.object().keys({
    enable: joi.boolean().required(),
});

const checkConfigSchema = joi.object().keys({});

const getGeolocationSchema = joi.object().keys({});

module.exports = {
    restartStudio: (req, res, cb) => validate(restartStudioSchema, req, res, cb),
    restartNginx: (req, res, cb) => validate(restartNginxSchema, req, res, cb),
    getStudioConfig: (req, res, cb) => validate(getStudioConfigSchema, req, res, cb),
    getMediaSpaceSlots: (req, res, cb) => validate(getMediaSpaceSlotsSchema, req, res, cb),
    getHardwareSpecs: (req, res, cb) => validate(getHardwareSpecsSchema, req, res, cb),
    getHardwareStats: (req, res, cb) => validate(getHardwareStatsSchema, req, res, cb),
    updateMediaSpaceLease: (req, res, cb) => validate(updateMediaSpaceLeaseSchema, req, res, cb),
    checkConfig: (req, res, cb) => validate(checkConfigSchema, req, res, cb),
    getGeolocation: (req, res, cb) => validate(getGeolocationSchema, req, res, cb),
};
