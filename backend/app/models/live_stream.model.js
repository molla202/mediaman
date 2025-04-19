const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const streamDestinationSchema = new mongoose.Schema({
    name: {
        type: String,
        enum: ['youtube', 'x', 'facebook', 'instagram', 'twitch', 'OmniFlixTV', 'custom'],
        required: true,
    },
    url: {
        type: String,
        required: function () {
            return this.name !== 'OmniFlixTV';
        },
    },
    key: {
        type: String,
        required: true,
    },
    stream_id: {
        type: String,
        required: function () {
            return this.name === 'OmniFlixTV';
        },
    },
    channel_id: {
        type: String,
    },
    type: {
        type: String,
        enum: ['broadcast', 'live_feed'],
        default: function () {
            return this.name === 'OmniFlixTV' ? 'live_feed' : undefined;
        },
    },
    tv_type: {
        type: String,
        enum: ['DEV', 'PROD', 'STAGING'],
        default: function () {
            return this.name === 'OmniFlixTV' ? 'DEV' : undefined;
        },
    },
    enabled: {
        type: Boolean,
        required: true,
        default: true,
    },
    username: {
        type: String,
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

const connectedChannelSchema = new mongoose.Schema({
    channel_id: {
        type: mongoose.ObjectId,
        required: true,
    },
    live_stream_access_token: {
        type: String,
        required: true,
    },
    bc_account_address: {
        type: String,
    },
    studio_type: {
        type: String,
        enum: ['DEV', 'PROD', 'STAGING'],
        required: true,
    },
    enabled: {
        type: Boolean,
        required: true,
        default: true,
    },
    username: {
        type: String,
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

const configurationSchema = new mongoose.Schema({
    slot_length: {
        type: Number,
        required: true,
        default: 3600,
    },
    stream_timezone: {
        type: String,
        required: true,
        default: 'Etc/UTC',
    },
    stream_destinations: [{
        type: streamDestinationSchema,
        required: true,
    }],
    connected_channels: [{
        type: connectedChannelSchema,
        required: true,
    }],
    in_stream_config: {
        ads_enabled: {
            type: Boolean,
            required: true,
            default: false,
        },
        logo_enabled: {
            type: Boolean,
            required: true,
            default: false,
        },
        watermark_enabled: {
            type: Boolean,
            required: true,
            default: false,
        },
        text_scroll_enabled: {
            type: Boolean,
            required: true,
            default: false,
        },
        show_time_code: {
            type: Boolean,
            required: true,
            default: false,
        },
        stream_logo_enabled: {
            type: Boolean,
            required: true,
            default: false,
        },
    },
    stream_quality: {
        type: String,
        enum: ['SD', 'HD'],
        default: 'SD',
    },
    stream_quality_settings: {
        SD: {
            resolution: {
                type: String,
                default: '1280x720',
            },
            bitrate: {
                type: Number,
                default: 4500000,
            },
        },
        HD: {
            resolution: {
                type: String,
                default: '1920x1080',
            },
            bitrate: {
                type: Number,
                default: 6000000,
            },
        },
    },
    stream_live_text: {
        type: String,
        max: 2000,
    },
    broadcast_config: {
        stream_url: {
            type: String,
            required: true,
            default: '-',
        },
        stream_key: {
            type: String,
            required: true,
            default: '-',
        },
    },
    live_feed_config: {
        stream_url: {
            type: String,
            required: true,
            default: '-',
        },
        stream_key: {
            type: String,
            required: true,
            default: '-',
        },
    },
    broadcast_enabled: {
        type: Boolean,
        required: true,
        default: true,
    },
    broadcast_state: {
        type: String,
        enum: ['running', 'stopped'],
        default: 'stopped',
    },
});

const slotConfigurationSchema = new mongoose.Schema({
    slot_length: {
        type: Number,
        required: true,
        default: 3600,
    },
    ads: {
        type: Boolean,
        required: true,
        default: false,
    },
    total_ads_duration: {
        type: Number,
        default: 360,
    },
    ad_duration: {
        type: Number,
        default: 60,
    },
    no_ads_per_break: {
        type: Number,
        default: 1,
    },
    ad_after: {
        programs: {
            type: Number,
            default: 3,
        },
        duration: {
            type: Number,
            default: 900,
        },
    },
    ad_based_on: {
        type: String,
        enum: ['programs', 'duration'],
        default: 'duration',
    },
    content_promos: {
        type: Boolean,
        default: false,
    },
    promos_per_break: {
        type: Number,
        default: 2,
    },
    default_ad_campaigns: [{
        type: mongoose.ObjectId,
        ref: 'default_ad_campaign',
    }],
    content_auto_fill_enabled: {
        type: Boolean,
        default: false,
    },
    content_config: {
        categories: [{
            type: mongoose.ObjectId,
            ref: 'asset_category',
        }],
        tags: [{
            type: String,
        }],
    },
    fillers: {
        categories: [{
            type: mongoose.ObjectId,
            ref: 'asset_category',
        }],
        tags: [{
            type: String,
        }],
    },
});

const viewsSchema = new mongoose.Schema({
    current: {
        type: Number,
        default: 0,
    },
    total: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

const liveStreamSchema = new mongoose.Schema({
    created_by: {
        type: mongoose.ObjectId,
        ref: 'user',
        required: true,
    },
    previews: {
        type: {
            type: String,
            enum: ['youtube', 'x', 'facebook', 'twitch', 'instagram', 'OmniFlixTV'],
            default: 'youtube',
            required: true,
        },
        url: {
            type: String,
            required: true,
            default: '-',
        },
        id: {
            type: String,
            required: true,
            default: '-',
        },
    },
    name: {
        type: String,
        required: true,
    },
    image_url: {
        type: String,
    },
    description: {
        type: String,
    },
    start_at: {
        type: Date,
        required: true,
        default: Date.now(),
    },
    end_at: {
        type: Date,
    },
    views: {
        type: viewsSchema,
        required: true,
        default: () => ({}),
    },
    tags: [{
        type: String,
        required: true,
    }],
    status: {
        type: String,
        enum: ['UP_COMING', 'LIVE', 'ENDED'],
        required: true,
        default: 'LIVE',
    },
    embed: {
        type: Boolean,
        required: true,
        default: true,
    },
    default: {
        type: Boolean,
        required: true,
        default: false,
    },
    playing_live_feed: {
        type: Boolean,
        default: false,
    },
    broadcast_stream_keys: {
        type: String,
    },
    live_stream_keys: {
        type: String,
    },
    configuration: {
        type: configurationSchema,
        required: true,
        default: () => ({}),
    },
    slot_configuration: {
        type: slotConfigurationSchema,
        required: true,
        default: () => ({}),
    },
    media_space: {
        type: mongoose.ObjectId,
        ref: 'media_space',
    },
    playback_path: {
        type: String,
    },
    extra_destinations: [{
        type: String,
    }],
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

liveStreamSchema.index({ created_at: 1 });
liveStreamSchema.index({ updated_at: 1 });
liveStreamSchema.index({ name: 1 });
liveStreamSchema.index({ status: 1 });
liveStreamSchema.index({ 'views.current': 1 });

liveStreamSchema.index({
    status: 1,
    embed: 1,
});

const model = omniflixStudio.model('live_stream', liveStreamSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
