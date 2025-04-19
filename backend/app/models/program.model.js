const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const overlaySchema = new mongoose.Schema({
    start_at: {
        type: Date,
        required: true,
    },
    end_at: {
        type: Date,
        required: true,
    },
    asset: {
        type: mongoose.ObjectId,
        ref: 'asset',
        required: true,
    },
});

const programSchema = new mongoose.Schema({
    live_stream: {
        type: mongoose.ObjectId,
        required: true,
        ref: 'live_stream',
    },
    slot: {
        type: mongoose.ObjectId,
        required: true,
        ref: 'slot',
    },
    asset: {
        _: {
            type: mongoose.ObjectId,
            ref: 'asset',
            required: true,
        },
        start_at: {
            type: Number,
            required: true,
        },
        end_at: {
            type: Number,
            required: true,
        },
    },
    start_at: {
        type: Date,
        required: true,
    },
    end_at: {
        type: Date,
        required: true,
    },
    type: {
        type: String,
        enum: ['ad', 'content'],
        default: 'content',
    },
    segment_number: {
        type: Number,
        default: 0,
    },
    added_by: {
        type: mongoose.ObjectId,
        ref: 'user',
    },
    is_dynamic: {
        type: Boolean,
        default: false,
    },
    overlays: [{
        type: overlaySchema,
        required: true,
    }],
    push_at: {
        type: Date,
    },
    media_space: {
        type: mongoose.ObjectId,
        ref: 'media_space',
    },
});

programSchema.index({ created_at: 1 });
programSchema.index({ updated_at: 1 });

programSchema.index({
    live_stream: 1,
    slot: 1,
});

programSchema.index({
    _id: 1,
    live_stream: 1,
    slot: 1,
});

programSchema.index({
    live_stream: 1,
    slot: 1,
    'overlays._id': 1,
});

programSchema.index({
    _id: 1,
    live_stream: 1,
    slot: 1,
    'overlays._id': 1,
});
programSchema.index({
    _id: 1,
    live_stream: 1,
    slot: 1,
    start_at: 1,
});
programSchema.index({
    _id: 1,
    live_stream: 1,
    slot: 1,
    end_at: 1,
});
programSchema.index({
    live_stream: 1,
    slot: 1,
    start_at: 1,
    end_at: 1,
}, {
    unique: 1,
});

programSchema.index({
    _id: 1,
    live_stream: 1,
    slot: 1,
    start_at: 1,
    end_at: 1,
});

const model = omniflixStudio.model('program', programSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
