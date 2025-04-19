const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const getAuthUrlSchema = joi.object().keys({});

const handleCallbackSchema = joi.object().keys({
    code: joi.string().required(),
    scope: joi.string().required(),
    state: joi.string().required(),
});

const updateMediaNodeTwitchDestinationSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
});

const broadcastTwitchLiveStreamSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    startTime: joi.string().required(),
    duration: joi.number().required(),
    timezone: joi.string().required(),
    title: joi.string().required(),
    isRecurring: joi.boolean().required(),
    categoryId: joi.string(),
    broadcasterId: joi.string(),
});

const updateTwitchScheduleSegmentSchema = joi.object().keys({
    segmentId: joi.string().required(),
    startTime: joi.string(),
    duration: joi.number(),
    title: joi.string(),
    isCancelled: joi.boolean(),
});

const getTwitchLiveStreamBroadcastsSchema = joi.object().keys({
    broadcasterId: joi.string().required(),
});

const deleteTwitchScheduleSegmentSchema = joi.object().keys({
    segmentId: joi.string().required(),
    broadcasterId: joi.string().required(),
});

module.exports = {
    getAuthUrl: (req, res, cb) => validate(getAuthUrlSchema, req, res, cb),
    handleCallback: (req, res, cb) => validate(handleCallbackSchema, req, res, cb),
    updateMediaNodeTwitchDestination: (req, res, cb) => validate(updateMediaNodeTwitchDestinationSchema, req, res, cb),
    broadcastTwitchLiveStream: (req, res, cb) => validate(broadcastTwitchLiveStreamSchema, req, res, cb),
    updateTwitchScheduleSegment: (req, res, cb) => validate(updateTwitchScheduleSegmentSchema, req, res, cb),
    getTwitchLiveStreamBroadcasts: (req, res, cb) => validate(getTwitchLiveStreamBroadcastsSchema, req, res, cb),
    deleteTwitchScheduleSegment: (req, res, cb) => validate(deleteTwitchScheduleSegmentSchema, req, res, cb),
};
