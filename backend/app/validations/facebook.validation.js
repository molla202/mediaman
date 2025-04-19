const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const getAuthUrlSchema = joi.object().keys({});

const handleCallbackSchema = joi.object().keys({
    code: joi.string().required(),
    state: joi.string().required(),
});

const updateMediaNodeFacebookDestinationSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    scheduleId: joi.string().required(),
});

const createFacebookScheduleSchema = joi.object().keys({
    scheduleStartTime: joi.string(),
    startImmediately: joi.boolean(),
    title: joi.string().required(),
    description: joi.string().required(),
    userId: joi.string().required(),
}).xor('scheduleStartTime', 'startImmediately');

const reScheduleFacebookScheduleSchema = joi.object().keys({
    scheduleId: joi.string().required(),
    scheduleStartTime: joi.string(),
    startImmediately: joi.boolean(),
    title: joi.string(),
    description: joi.string(),
    userId: joi.string(),
}).xor('scheduleStartTime', 'startImmediately');

const getFacebookLiveStreamBroadcastsSchema = joi.object().keys({
    userId: joi.string(),
});

module.exports = {
    getAuthUrl: (req, res, cb) => validate(getAuthUrlSchema, req, res, cb),
    handleCallback: (req, res, cb) => validate(handleCallbackSchema, req, res, cb),
    updateMediaNodeFacebookDestination: (req, res, cb) => validate(updateMediaNodeFacebookDestinationSchema, req, res, cb),
    createFacebookSchedule: (req, res, cb) => validate(createFacebookScheduleSchema, req, res, cb),
    reScheduleFacebookSchedule: (req, res, cb) => validate(reScheduleFacebookScheduleSchema, req, res, cb),
    getFacebookLiveStreamBroadcasts: (req, res, cb) => validate(getFacebookLiveStreamBroadcastsSchema, req, res, cb),
};
