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
    repeat: {
        type: Number,
    },
    frequency: {
        type: Number,
    },
    position: {
        type: String,
        enum: ['top_left', 'top_right', 'bottom_left', 'bottom_right'],
    },
});

const slotSchema = new mongoose.Schema({
    live_stream: {
        type: mongoose.ObjectId,
        required: true,
        ref: 'live_stream',
    },
    name: {
        type: String,
    },
    type: {
        type: String,
        default: 'mixed',
    },
    start_at: {
        type: Date,
        required: true,
    },
    end_at: {
        type: Date,
        required: true,
    },
    play_out: {
        type: Array,
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
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

slotSchema.index({ created_at: 1 });
slotSchema.index({ updated_at: 1 });

slotSchema.index({ name: 1 });
slotSchema.index({ start_at: 1 });
slotSchema.index({ end_at: 1 });
slotSchema.index({ live_stream: 1 });

slotSchema.index({
    _id: 1,
    live_stream: 1,
});

slotSchema.index({
    _id: 1,
    live_stream: 1,
    start_at: 1,
});
slotSchema.index({
    _id: 1,
    live_stream: 1,
    end_at: 1,
});
slotSchema.index({
    live_stream: 1,
    media_space: 1,
    start_at: 1,
    end_at: 1,
}, {
    unique: 1,
});

slotSchema.index({
    _id: 1,
    live_stream: 1,
    start_at: 1,
    end_at: 1,
});

const model = omniflixStudio.model('slot', slotSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
