const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const youtubeTokenSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    media_space: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MediaSpace',
        required: true,
    },
    channel_id: {
        type: String,
        required: true,
    },
    code: {
        type: String,
        required: true,
    },
    access_token: {
        type: String,
        required: true,
    },
    refresh_token: {
        type: String,
        required: true,
    },
    scope: {
        type: String,
        required: true,
    },
    expiry_date: {
        type: Number,
        required: true,
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

youtubeTokenSchema.index({ created_at: 1 });
youtubeTokenSchema.index({ updated_at: 1 });
youtubeTokenSchema.index({
    user: 1,
    media_space: 1,
    channel_id: 1,
}, {
    unique: 1,
});

const model = omniflixStudio.model('youtube_token', youtubeTokenSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
