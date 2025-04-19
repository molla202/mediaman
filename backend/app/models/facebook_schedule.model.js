const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const facebookScheduleSegmentSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
    },
    start_time: {
        type: Date,
        required: true,
    },
    stream_url: {
        type: String,
        required: true,
    },
    title: {
        type: String,
    },
    description: {
        type: String,
    },
    user_id: {
        type: String,
        required: true,
    },
    user: {
        type: mongoose.ObjectId,
        ref: 'user',
        required: true,
    },
    media_space: {
        type: mongoose.ObjectId,
        ref: 'media_space',
        required: true,
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

facebookScheduleSegmentSchema.index({ created_at: 1 });
facebookScheduleSegmentSchema.index({ updated_at: 1 });

const model = omniflixStudio.model('facebook_schedule', facebookScheduleSegmentSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
