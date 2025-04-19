const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const sourceTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    base_URL: {
        type: String,
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

sourceTypeSchema.index({ created_at: 1 });
sourceTypeSchema.index({ updated_at: 1 });
sourceTypeSchema.index({ name: 1 }, { unique: 1 });

const model = omniflixStudio.model('source_type', sourceTypeSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
