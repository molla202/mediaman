const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const leaseSchema = new mongoose.Schema({
    lessee: {
        type: mongoose.ObjectId,
        ref: 'user',
    },
    start_time: {
        type: Date,
    },
    expiry: {
        type: Date,
    },
    status: {
        type: String,
        enum: ['LEASE_STATUS_ACTIVE', 'LEASE_STATUS_EXPIRED'],
    },
    leased_hours: {
        type: Number,
    },
    last_settled_at: {
        type: Date,
    },
});

const mediaSpaceSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    admin: {
        type: mongoose.ObjectId,
        ref: 'user',
    },
    username: {
        type: String,
        required: true,
    },
    id: {
        type: String,
        required: true,
    },
    lease: {
        type: leaseSchema,
    },
    broadcast_enabled: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

mediaSpaceSchema.index({ username: 1 }, { unique: true });
mediaSpaceSchema.index({ admin: 1 });
mediaSpaceSchema.index({ created_at: 1 });
mediaSpaceSchema.index({ updated_at: 1 });

const model = omniflixStudio.model('media_space', mediaSpaceSchema)
    .on('index', (err) => {
        if (err) {
            logger.error('Media space model index error', err);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
