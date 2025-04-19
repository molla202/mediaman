const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const youtubeAssetsSchema = new mongoose.Schema({
    id: {
        type: String,
    },
    title: {
        type: String,
    },
    description: {
        type: String,
    },
    thumbnail: {
        type: Object,
    },
    video_url: {
        type: String,
    },
    privacy_status: {
        type: String,
        enum: ['public', 'private', 'unlisted'],
    },
    channel_id: {
        type: String,
    },
});
const assetDistributionSchema = new mongoose.Schema({
    asset: {
        type: mongoose.Types.ObjectId,
        ref: 'asset',
        required: true,
    },
    social_media: {
        type: String,
        enum: ['TWITTER', 'INSTAGRAM', 'YOUTUBE'],
        required: true,
    },
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'user',
        required: true,
    },
    status: {
        type: String,
        enum: ['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
        default: 'IN_QUEUE',
    },
    youtube: {
        type: youtubeAssetsSchema,
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

assetDistributionSchema.index({ created_at: 1 });
assetDistributionSchema.index({ updated_at: 1 });
const model = omniflixStudio.model('asset_distribution', assetDistributionSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
