const joi = require('@hapi/joi');
const {
    validate,
    patterns,
} = require('./common');

const getAuthUrlSchema = joi.object().keys({});

const handleCallbackSchema = joi.object().keys({
    code: joi.string().required(),
    scope: joi.string().required(),
    state: joi.string().required(),
});

const getLiveStreamsSchema = joi.object().keys({
    id: joi.string(),
    pageToken: joi.string(),
    maxResults: joi.number().default(50),
    channelId: joi.string().required(),
});

const addLiveStreamSchema = joi.object().keys({
    channelId: joi.string().required(),
    cdn: joi.object().keys({
        frameRate: joi.string().valid('30fps', '60fps', 'variable').required(),
        resolution: joi.string().valid('1080p', '720p', '480p', '360p', '240p', '1440p', '2160p', 'variable').required(),
        ingestionType: joi.string().valid('rtmp', 'dash', 'hls', 'webrtc').required(),
    }),
    snippet: joi.object().keys({
        title: joi.string().required(),
        description: joi.string(),
    }),
    contentDetails: joi.object().keys({
        isReusable: joi.boolean().default(false),
    }),
});

const getLiveBroadcastsSchema = joi.object().keys({
    id: joi.string(),
    pageToken: joi.string(),
    maxResults: joi.number().default(50),
    broadcastStatus: joi.string().valid('active', 'all', 'completed', 'upcoming'),
    broadcastType: joi.string().valid('all', 'event', 'persistent'),
    channelId: joi.string().required(),
});

const addLiveBroadcastSchema = joi.object().keys({
    channelId: joi.string().required(),
    status: joi.object().keys({
        privacyStatus: joi.string().valid('public', 'private', 'unlisted').required(),
        selfDeclaredMadeForKids: joi.boolean(),
    }),
    snippet: joi.object().keys({
        title: joi.string().required(),
        description: joi.string(),
        scheduledStartTime: joi.string().isoDate().required(),
        scheduledEndTime: joi.string().isoDate(),
        isDefaultBroadcast: joi.boolean(),
    }),
    contentDetails: joi.object().keys({
        enableAutoStart: joi.boolean(),
        enableAutoStop: joi.boolean(),
        enableClosedCaptions: joi.boolean(),
        enableDvr: joi.boolean(),
        enableEmbed: joi.boolean(),
        recordFromStart: joi.boolean(),
        monitorStream: joi.object().keys({
            enableMonitorStream: joi.boolean(),
            broadcastStreamDelayMs: joi.number(),
        }),
    }),
});

const updateLiveBroadcastSchema = joi.object().keys({
    broadcastId: joi.string().required(),
    channelId: joi.string().required(),
    status: joi.object().keys({
        privacyStatus: joi.string().valid('public', 'private', 'unlisted').required(),
        selfDeclaredMadeForKids: joi.boolean(),
    }),
    snippet: joi.object().keys({
        title: joi.string().required(),
        description: joi.string(),
        scheduledStartTime: joi.string().isoDate().required(),
        scheduledEndTime: joi.string().isoDate(),
        isDefaultBroadcast: joi.boolean(),
    }),
    contentDetails: joi.object().keys({
        enableAutoStart: joi.boolean(),
        enableAutoStop: joi.boolean(),
        enableClosedCaptions: joi.boolean(),
        enableDvr: joi.boolean(),
        enableEmbed: joi.boolean(),
        recordFromStart: joi.boolean(),
    }),
});

const bindLiveBroadcastSchema = joi.object().keys({
    broadcastId: joi.string().required(),
    streamId: joi.string().required(),
    channelId: joi.string().required(),
});

const unbindLiveBroadcastSchema = joi.object().keys({
    broadcastId: joi.string().required(),
    channelId: joi.string().required(),
});

const updateMediaNodeYoutubeDestinationSchema = joi.object().keys({
    streamId: joi.string().required(),
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    channelId: joi.string().required(),
});

const uploadAssetSchema = joi.object().keys({
    channelId: joi.string().required(),
    assetId: joi.string().regex(patterns.objectId).required(),
    title: joi.string().required(),
    description: joi.string(),
    tags: joi.array().items(joi.string()),
    defaultLanguage: joi.string(),
    localizations: joi.object().keys({
        key: joi.string(),
        title: joi.string(),
        description: joi.string(),
    }),
    status: joi.object().keys({
        embeddable: joi.boolean(),
        license: joi.string().valid('creativeCommon', 'youtube'),
        selfDeclaredMadeForKids: joi.boolean(),
        privacyStatus: joi.string().valid('public', 'private', 'unlisted'),
        publicStatsViewable: joi.boolean(),
        containsSyntheticMedia: joi.boolean(),
        publishAt: joi.string().isoDate(),
    }),
});

const updateYoutubeAssetSchema = joi.object().keys({
    assetId: joi.string().regex(patterns.objectId).required(),
    channelId: joi.string().required(),
    title: joi.string().required(),
    description: joi.string(),
    tags: joi.array().items(joi.string()),
    defaultLanguage: joi.string(),
    localizations: joi.object().keys({
        key: joi.string(),
        title: joi.string(),
        description: joi.string(),
    }),
    status: joi.object().keys({
        embeddable: joi.boolean(),
        license: joi.string().valid('creativeCommon', 'youtube'),
        selfDeclaredMadeForKids: joi.boolean(),
        privacyStatus: joi.string().valid('public', 'private', 'unlisted'),
        publicStatsViewable: joi.boolean(),
        containsSyntheticMedia: joi.boolean(),
        publishAt: joi.string().isoDate(),
    }),
});

const getYoutubeAssetSchema = joi.object().keys({
    id: joi.string(),
    channelId: joi.string().required(),
});

module.exports = {
    getAuthUrl: (req, res, cb) => validate(getAuthUrlSchema, req, res, cb),
    handleCallback: (req, res, cb) => validate(handleCallbackSchema, req, res, cb),
    getLiveStreams: (req, res, cb) => validate(getLiveStreamsSchema, req, res, cb),
    addLiveStream: (req, res, cb) => validate(addLiveStreamSchema, req, res, cb),
    getLiveBroadcasts: (req, res, cb) => validate(getLiveBroadcastsSchema, req, res, cb),
    addLiveBroadcast: (req, res, cb) => validate(addLiveBroadcastSchema, req, res, cb),
    updateLiveBroadcast: (req, res, cb) => validate(updateLiveBroadcastSchema, req, res, cb),
    bindLiveBroadcast: (req, res, cb) => validate(bindLiveBroadcastSchema, req, res, cb),
    unbindLiveBroadcast: (req, res, cb) => validate(unbindLiveBroadcastSchema, req, res, cb),
    updateMediaNodeYoutubeDestination: (req, res, cb) => validate(updateMediaNodeYoutubeDestinationSchema, req, res, cb),
    uploadAsset: (req, res, cb) => validate(uploadAssetSchema, req, res, cb),
    updateYoutubeAsset: (req, res, cb) => validate(updateYoutubeAssetSchema, req, res, cb),
    getYoutubeAsset: (req, res, cb) => validate(getYoutubeAssetSchema, req, res, cb),
};
