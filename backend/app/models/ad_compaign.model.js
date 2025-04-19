const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const adCompaignSchema = new mongoose.Schema({
    asset: {
        type: mongoose.ObjectId,
        required: true,
        ref: 'asset',
    },
    type: {
        type: String,
        enum: ['ad', 'bug'],
        required: true,
    },
    frequency_per_slot: {
        type: Number,
        default: 1,
    },
    preferred_position: {
        type: String,
        enum: ['start', 'mid', 'end'],
        default: 'start',
    },
    start_at: {
        type: Date,
    },
    end_at: {
        type: Date,
    },
    repeat: {
        type: Number,
    },
    frequency: {
        type: Number,
    },
    position: {
        type: String,
    },
    slot: {
        type: mongoose.ObjectId,
        required: true,
        ref: 'slot',
    },
    live_stream: {
        type: mongoose.ObjectId,
        required: true,
        ref: 'live_stream',
    },
    added_by: {
        type: mongoose.ObjectId,
        required: true,
        ref: 'user',
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

const model = omniflixStudio.model('ad_campaign', adCompaignSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

adCompaignSchema.index({ created_at: 1 });
adCompaignSchema.index({ updated_at: 1 });
adCompaignSchema.index({ name: 1 });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
