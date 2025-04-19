const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const getStudioChannelsSchema = joi.object().keys({
    type: joi.string().required().valid('DEV', 'PROD', 'STAGING'),
});

const updateLiveStreamAccessTokenSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    liveStreamAccessToken: joi.string().required(),
    channelName: joi.string(),
    type: joi.string().required().valid('DEV', 'PROD', 'STAGING'),
    channelId: joi.string().regex(patterns.objectId),
}).xor('channelId', 'channelName');

const removeLiveStreamAccessTokenSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    channelId: joi.string().regex(patterns.objectId).required(),
});

const getStudioSocialsSchema = joi.object().keys({
    channelId: joi.string().required(),
});

const enableStudioChannelSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    channelId: joi.string().regex(patterns.objectId).required(),
});

const disableStudioChannelSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    channelId: joi.string().regex(patterns.objectId).required(),
});

module.exports = {
    getStudioChannels: (req, res, cb) => validate(getStudioChannelsSchema, req, res, cb),
    updateLiveStreamAccessToken: (req, res, cb) => validate(updateLiveStreamAccessTokenSchema, req, res, cb),
    removeLiveStreamAccessToken: (req, res, cb) => validate(removeLiveStreamAccessTokenSchema, req, res, cb),
    getStudioSocials: (req, res, cb) => validate(getStudioSocialsSchema, req, res, cb),
    enableStudioChannel: (req, res, cb) => validate(enableStudioChannelSchema, req, res, cb),
    disableStudioChannel: (req, res, cb) => validate(disableStudioChannelSchema, req, res, cb),
};
