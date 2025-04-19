const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const genreSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
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

genreSchema.index({ created_at: 1 });
genreSchema.index({ updated_at: 1 });

genreSchema.index({ name: 1 }, { unique: 1 });

const model = omniflixStudio.model('genre', genreSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
