const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const slotTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
    },
    duration: {
        type: Number,
    },
    categories: [{
        type: mongoose.ObjectId,
        ref: 'asset_category',
    }],
    genres: [{
        type: mongoose.ObjectId,
        ref: 'genre',
    }],
    include_tags: [{
        type: String,
    }],
    exclude_tags: [{
        type: String,
    }],
    added_by: {
        type: mongoose.ObjectId,
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

slotTemplateSchema.index({ created_at: 1 });
slotTemplateSchema.index({ updated_at: 1 });

slotTemplateSchema.index({ name: 1 });

const model = omniflixStudio.model('slot_template', slotTemplateSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
