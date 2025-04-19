const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const profileImageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        default: 'profile_image.png',
    },
    destination: {
        type: String,
        required: true,
        default: 'uploads/default',
    },
    MIME_type: {
        type: String,
        required: true,
        default: 'image/png',
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

const facebookSchema = new mongoose.Schema({
    token: {
        type: String,
    },
    user_id: {
        type: String,
    },
    code: {
        type: String,
    },
    access_token: {
        type: String,
    },
    refresh_token: {
        type: String,
    },
    scope: [{
        type: String,
    }],
    expires_in: {
        type: Number,
    },
    status: {
        type: String,
        enum: ['UNVERIFIED', 'VERIFIED'],
        required: true,
        default: 'UNVERIFIED',
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

const twitchSchema = new mongoose.Schema({
    token: {
        type: String,
    },
    broadcaster_id: {
        type: String,
    },
    code: {
        type: String,
    },
    access_token: {
        type: String,
    },
    refresh_token: {
        type: String,
    },
    scope: [{
        type: String,
    }],
    expires_in: {
        type: Number,
    },
    username: {
        type: String,
    },
    status: {
        type: String,
        enum: ['UNVERIFIED', 'VERIFIED'],
        required: true,
        default: 'UNVERIFIED',
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

const youtubeSchema = new mongoose.Schema({
    token: {
        type: String,
    },
    code: {
        type: String,
    },
    scope: {
        type: String,
    },
    youtube_url: {
        type: String,
    },
    channel_id: {
        type: String,
    },
    channel_name: {
        type: String,
    },
    thumbnail_url: {
        type: Object,
    },
    access_token: {
        type: String,
    },
    refresh_token: {
        type: String,
    },
    features: [{
        type: String,
    }],
    categories: [{
        type: String,
    }],
    expiry_date: {
        type: Date,
    },
    status: {
        type: String,
        enum: ['UNVERIFIED', 'VERIFIED'],
        required: true,
        default: 'UNVERIFIED',
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

const twitterSchema = new mongoose.Schema({
    token: {
        type: String,
    },
    username: {
        type: String,
        required: true,
    },
    user_id: {
        type: String,
        required: true,
    },
    verification_code: {
        type: String,
        required: true,
    },
    tweet_text: {
        type: String,
        required: true,
    },
    tweet_id: {
        type: String,
    },
    tweet_url: {
        type: String,
    },
    access_token: {
        type: String,
    },
    refresh_token: {
        type: String,
    },
    scope: {
        type: String,
    },
    expiry_date: {
        type: Date,
    },
    status: {
        type: String,
        enum: ['UNVERIFIED', 'VERIFIED'],
        default: 'UNVERIFIED',
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

const OFStudioSchema = new mongoose.Schema({
    access_token: {
        type: String,
        required: true,
    },
    channel_id: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['DEV', 'PROD', 'STAGING'],
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

const userSchema = new mongoose.Schema({
    is_media_node_admin: {
        type: Boolean,
        required: true,
        default: false,
    },
    is_admin: {
        type: Boolean,
        required: true,
        default: false,
    },
    username: {
        type: String,
    },
    root_path: {
        type: String,
    },
    bc_account_address: {
        type: String,
        required: true,
    },
    profile_image: {
        type: profileImageSchema,
        required: true,
        default: () => ({}),
    },
    created_by: {
        type: mongoose.ObjectId,
        ref: 'user',
    },
    permissions: [{
        type: String,
        enum: ['studio', 'runner', 'ipfs', 'streamer'],
    }],
    auth_token: {
        type: String,
        required: true,
    },
    fee_grant: {
        status: {
            type: String,
            enum: ['UNCLAIMED', 'CLAIMED'],
            required: true,
            default: 'UNCLAIMED',
        },
        tx_hash: {
            type: String,
        },
        updated_at: {
            type: Date,
        },
    },
    media_space: {
        type: mongoose.ObjectId,
        ref: 'media_space',
    },
    broadcast_enabled: {
        type: Boolean,
        required: true,
        default: true,
    },
    social_accounts: {
        youtube: [{
            type: youtubeSchema,
        }],
        twitch: [{
            type: twitchSchema,
        }],
        facebook: [{
            type: facebookSchema,
        }],
        twitter: [{
            type: twitterSchema,
        }],
        of_studio: [{
            type: OFStudioSchema,
        }],
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

userSchema.index({ created_at: 1 });
userSchema.index({ updated_at: 1 });
userSchema.index({
    bc_account_address: 1,
    auth_token: 1,
    media_space: 1,
}, {
    unique: 1,
});

const model = omniflixStudio.model('user', userSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
