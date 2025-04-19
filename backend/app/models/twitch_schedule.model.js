const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const twitchScheduleSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    start_time: {
        type: Date,
        required: true,
    },
    end_time: {
        type: Date,
        required: true,
    },
    category_id: {
        type: String,
    },
    is_recurring: {
        type: Boolean,
        required: true,
    },
    is_cancelled: {
        type: Boolean,
    },
    timezone: {
        type: String,
    },
    duration: {
        type: Number,
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
    },
    media_space: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'media_space',
        required: true,
    },
    broadcaster_id: {
        type: String,
        required: true,
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

twitchScheduleSchema.index({ created_at: 1 });
twitchScheduleSchema.index({ updated_at: 1 });

const model = omniflixStudio.model('twitch_schedule', twitchScheduleSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
