const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const getLiveStreamsSchema = joi.object().keys({
    status: joi.string().valid('UP_COMING', 'LIVE', 'ENDED'),
    total: joi.boolean(),
    skip: joi.string(),
    limit: joi.number(),
    sortBy: joi.string(),
    order: joi.string().valid('asc', 'desc'),
    liveFeed: joi.boolean(),
    userAuthToken: joi.string(),
    address: joi.string(),
    token: joi.string(),
});

const addLiveStreamSchema = joi.object().keys({
    name: joi.string().required(),
    imageURL: joi.string().uri(),
    description: joi.string(),
});

const updateLiveStreamSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    _default: joi.boolean(),
    streamQuality: joi.string().valid('SD', 'HD'),
    status: joi.string().valid('UP_COMING', 'LIVE', 'ENDED'),
    streamTimeZone: joi.string(),
    imageURL: joi.string().uri(),
    name: joi.string(),
    description: joi.string(),
    streamDestinations: joi.array().items(
        joi.object().keys({
            name: joi.string().valid('youtube', 'x', 'facebook', 'instagram', 'twitch', 'OmniFlixTV', 'custom').required(),
            url: joi.when('name', {
                is: 'OmniFlixTV',
                then: joi.forbidden(),
                otherwise: joi.string().required(),
            }),
            stream_id: joi.when('name', {
                is: 'OmniFlixTV',
                then: joi.string().required(),
                otherwise: joi.string(),
            }),
            tv_type: joi.when('name', {
                is: 'OmniFlixTV',
                then: joi.string().valid('DEV', 'PROD', 'STAGING'),
                otherwise: joi.forbidden(),
            }),
            key: joi.string().required(),
            enabled: joi.boolean().required(),
        })),
    inStreamConfig: joi.object().keys({
        adsEnabled: joi.boolean(),
        logoEnabled: joi.boolean(),
        watermarkEnabled: joi.boolean(),
        textScrollEnabled: joi.boolean(),
        streamLogoEnabled: joi.boolean(),
        showTimeCode: joi.boolean(),
    }),
    autoFillEnabled: joi.boolean(),
    fillerCategories: joi.array().items(joi.string().regex(patterns.objectId)),
    fillerTags: joi.array().items(joi.string()),
    contentConfigCategories: joi.array().items(joi.string().regex(patterns.objectId)),
    contentConfigTags: joi.array().items(joi.string()),
    revokeBroadcastStreamKeys: joi.boolean(),
    revokeLiveStreamKeys: joi.boolean(),
});

const addLiveStreamDestinationSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    name: joi.string().required().valid('youtube', 'x', 'facebook', 'instagram', 'twitch', 'OmniFlixTV', 'custom'),
    url: joi.when('name', {
        is: 'OmniFlixTV',
        then: joi.forbidden(),
        otherwise: joi.string().required(),
    }),
    key: joi.string().required(),
    streamId: joi.when('name', {
        is: 'OmniFlixTV',
        then: joi.string().required(),
        otherwise: joi.forbidden(),
    }),
    tvType: joi.when('name', {
        is: 'OmniFlixTV',
        then: joi.string().valid('DEV', 'PROD', 'STAGING'),
        otherwise: joi.forbidden(),
    }),
    username: joi.string(),
});

const getLiveStreamDestinationSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    destinationId: joi.string().regex(patterns.objectId).required(),
});

const deleteLiveStreamDestinationSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    destinationId: joi.string().regex(patterns.objectId).required(),
});

const updateLiveStreamDestinationSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    destinationId: joi.string().regex(patterns.objectId).required(),
    url: joi.string(),
    key: joi.string(),
    streamId: joi.string().regex(patterns.objectId),
    tvType: joi.string().valid('DEV', 'PROD', 'STAGING'),
    enabled: joi.boolean(),
    username: joi.string(),
});

const updateRunnerLiveStreamSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    token: joi.string().required(),
    status: joi.string().valid('LIVE', 'UP_COMING', 'ENDED'),
    playingLiveFeed: joi.boolean(),
    broadcastConfig: joi.object().keys({
        stream_url: joi.string().required(),
        stream_key: joi.string().required(),
    }),
    liveFeedConfig: joi.object().keys({
        stream_url: joi.string().required(),
        stream_key: joi.string().required(),
    }),
});

const getRunnerLiveStreamsSchema = joi.object().keys({
    status: joi.string().valid('ended', 'live', 'up_coming'),
});

const getLiveStreamConfigSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
});

const startLiveStreamSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
});

const stopLiveStreamSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
});

const updateLiveStreamLiveTextSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    text: joi.string().required(),
});

const getLiveStreamWatchUrlSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    ip: joi.string().ip({
        version: [
            'ipv4',
        ],
    }).required(),
});

const switchToLiveSchema = joi.object().keys({
    username: joi.string().required(),
    token: joi.string().required(),
    broadcast_key: joi.string().required(),
});

const switchToBroadcastSchema = joi.object().keys({
    username: joi.string().required(),
    token: joi.string().required(),
    broadcast_key: joi.string().required(),
    playback_id: joi.string(),
});

const stopStreamSchema = joi.object().keys({
    username: joi.string().required(),
    token: joi.string().required(),
    playback_id: joi.string().required(),
    broadcast_key: joi.string().required(),
});

const updateDestinationsFromStudioSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    destinations: joi.array().items(joi.object().keys({
        name: joi.string().required(),
        url: joi.string(),
        key: joi.string().required(),
        stream_id: joi.string().regex(patterns.objectId),
        tv_type: joi.string().valid('DEV', 'PROD', 'STAGING'),
        username: joi.string(),
        channel_id: joi.string(),
    })),
    userAuthToken: joi.string(),
    address: joi.string(),
});

module.exports = {
    getLiveStreams: (req, res, cb) => validate(getLiveStreamsSchema, req, res, cb),
    addLiveStream: (req, res, cb) => validate(addLiveStreamSchema, req, res, cb),
    updateLiveStream: (req, res, cb) => validate(updateLiveStreamSchema, req, res, cb),
    addLiveStreamDestination: (req, res, cb) => validate(addLiveStreamDestinationSchema, req, res, cb),
    getLiveStreamDestination: (req, res, cb) => validate(getLiveStreamDestinationSchema, req, res, cb),
    deleteLiveStreamDestination: (req, res, cb) => validate(deleteLiveStreamDestinationSchema, req, res, cb),
    updateLiveStreamDestination: (req, res, cb) => validate(updateLiveStreamDestinationSchema, req, res, cb),
    updateRunnerLiveStream: (req, res, cb) => validate(updateRunnerLiveStreamSchema, req, res, cb),
    getRunnerLiveStreams: (req, res, cb) => validate(getRunnerLiveStreamsSchema, req, res, cb),
    getLiveStreamConfig: (req, res, cb) => validate(getLiveStreamConfigSchema, req, res, cb),
    startLiveStream: (req, res, cb) => validate(startLiveStreamSchema, req, res, cb),
    stopLiveStream: (req, res, cb) => validate(stopLiveStreamSchema, req, res, cb),
    updateLiveStreamLiveText: (req, res, cb) => validate(updateLiveStreamLiveTextSchema, req, res, cb),
    getLiveStreamsStatus: (req, res, cb) => cb(),
    getLiveStreamWatchUrl: (req, res, cb) => validate(getLiveStreamWatchUrlSchema, req, res, cb),
    switchToLive: (req, res, cb) => validate(switchToLiveSchema, req, res, cb),
    switchToBroadcast: (req, res, cb) => validate(switchToBroadcastSchema, req, res, cb),
    stopStream: (req, res, cb) => validate(stopStreamSchema, req, res, cb),
    updateDestinationsFromStudio: (req, res, cb) => validate(updateDestinationsFromStudioSchema, req, res, cb),
};
