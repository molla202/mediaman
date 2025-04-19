const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const adConfigSchema = new mongoose.Schema({
    ads: {
        type: Boolean,
        default: false,
    },
    total_ads_duration: {
        type: Number,
        default: 360,
    },
    no_ads_per_break: {
        type: Number,
        default: 1,
    },
    ad_duration: {
        type: Number,
        default: 60,
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
});

const contentConfigSchema = new mongoose.Schema({
    categories: [{
        type: mongoose.ObjectId,
        ref: 'asset_category',
    }],
    tags: [{
        type: String,
    }],
});

const slotConfigurationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    live_stream: {
        type: mongoose.ObjectId,
        required: true,
        ref: 'live_stream',
    },
    type: {
        type: String,
        enum: ['music', 'movie', 'scenes', 'mixed'],
        required: true,
    },
    slot_length: {
        type: Number,
        required: true,
        default: 3600,
    },
    ad_config: {
        type: adConfigSchema,
        default: () => ({}),
    },
    content_config: {
        type: contentConfigSchema,
        default: () => ({}),
    },
    media_space: {
        type: mongoose.ObjectId,
        ref: 'media_space',
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});
slotConfigurationSchema.index({ created_at: 1 });
slotConfigurationSchema.index({ updated_at: 1 });

slotConfigurationSchema.index({
    live_stream: 1,
    name: 1,
});

const model = omniflixStudio.model('slot_config', slotConfigurationSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
