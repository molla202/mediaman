const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const assetCategorySchema = new mongoose.Schema({
    user: {
        type: mongoose.ObjectId,
        ref: 'user',
    },
    name: {
        type: String,
        required: true,
    },
    global: {
        type: Boolean,
        default: false,
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

assetCategorySchema.index({ created_at: 1 });
assetCategorySchema.index({ updated_at: 1 });
assetCategorySchema.index({ user: 1 });
assetCategorySchema.index({
    user: 1,
    name: 1,
}, { unique: 1 });

const model = omniflixStudio.model('asset_category', assetCategorySchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
