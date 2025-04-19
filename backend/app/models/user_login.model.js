const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const userLoginSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.ObjectId,
        required: true,
        ref: 'user',
    },
    bc_account_address: {
        type: String,
        required: true,
    },
    auth_code: {
        type: Number,
        required: true,
    },
    auth_code_expire_at: {
        type: Date,
        required: true,
    },
    access_token: {
        type: String,
    },
    refresh_token: {
        type: String,
    },
    remote_address: {
        type: String,
    },
    status: {
        type: String,
        enum: ['REQUESTED', 'SUCCESS'],
        default: 'REQUESTED',
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

userLoginSchema.index({ created_at: 1 });
userLoginSchema.index({ updated_at: 1 });

userLoginSchema.index({
    user_id: 1,
    auth_code: 1,
});
userLoginSchema.index({
    user_id: 1,
    auth_code: 1,
    access_token: 1,
});
userLoginSchema.index({
    user_id: 1,
    access_token: 1,
});
userLoginSchema.index({
    user_id: 1,
    refresh_token: 1,
});

const model = omniflixStudio.model('user_login', userLoginSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
