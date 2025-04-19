const mongoose = require('mongoose');
const { omniflixStudio } = require('../../database');
const logger = require('../../logger');

const segmentSchema = new mongoose.Schema({
    start_at: {
        type: Number,
        required: true,
    },
    end_at: {
        type: Number,
        required: true,
    },
});

const encodeSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['PENDING', 'IN_QUEUE', 'IN_PROGRESS', 'ERROR', 'COMPLETE'],
        default: 'PENDING',
        required: true,
    },
    segment_duration: {
        type: Number,
        required: true,
        default: 900,
    },
    encoded_file_ipfs_hash: {
        type: String,
    },
    path: {
        type: String,
    },
    segments: [{
        type: segmentSchema,
        required: true,
    }],
    at: {
        type: Date,
        required: true,
        default: Date.now,
    },
});

const downloadSchema = new mongoose.Schema({
    source: {
        type: String,
    },
    id: {
        type: String,
    },
    status: {
        type: String,
        enum: ['PENDING', 'IN_QUEUE', 'IN_PROGRESS', 'ERROR', 'COMPLETE', 'NO_SOURCE'],
        default: 'PENDING',
        required: true,
    },
    path: {
        type: String,
    },
    at: {
        type: Date,
        default: Date.now,
        required: true,
    },
});

const fileSchema = new mongoose.Schema({
    download: {
        type: downloadSchema,
        required: true,
        default: () => ({}),
    },
    encode: {
        type: encodeSchema,
        required: true,
        default: () => ({}),
    },
    name: {
        type: String,
    },
    size: {
        type: Number,
    },
    path: {
        type: String,
    },
    MIME_type: {
        type: String,
    },
    duration: {
        type: Number,
    },
    length: {
        type: Number,
    },
    IPFS_hash: {
        type: String,
    },
    preview_IPFS_hash: {
        type: String,
    },
    status: {
        type: String,
        required: true,
        enum: ['PENDING', 'IN_QUEUE', 'UPLOAD_FAILED', 'PROCESSING', 'IPFS_PIN_FAILED', 'ERROR', 'COMPLETE'],
        default: 'PENDING',
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

const audioSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    duration: {
        type: Number,
    },
    isrc_code: {
        type: String,
    },
    ownership_status: {
        type: String,
    },
});

const videoSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    duration: {
        type: Number,
    },
    video_type: {
        type: String,
    },
    ownership_status: {
        type: String,
    },
    isrc_code: {
        type: String,
    },
    is_distributed_to_nucleus: {
        type: Boolean,
        default: false,
    },
    distributions: [{
        platform: {
            type: String,
            enum: ['TWITTER', 'INSTAGRAM', 'YOUTUBE'],
        },
        asset_distribution: {
            type: mongoose.Types.ObjectId,
            ref: 'asset_distribution',
        },
    }],
});

const assetSchema = new mongoose.Schema({
    added_by: {
        type: mongoose.ObjectId,
        ref: 'user',
    },
    is_default_asset: {
        type: Boolean,
        default: false,
    },
    name: {
        type: String,
    },
    duration: {
        type: Number,
    },
    category: {
        type: mongoose.ObjectId,
        ref: 'asset_category',
    },
    description: {
        type: String,
    },
    tags: [{
        type: String,
    }],
    source: {
        type: {
            type: mongoose.ObjectId,
            ref: 'source_type',
        },
        id: {
            type: String,
        },
    },
    file: {
        type: fileSchema,
        default: () => ({}),
    },
    thumbnail: {
        horizontal: {
            type: String,
        },
        horizontal_compressed: {
            type: String,
        },
        vertical: {
            type: String,
        },
        vertical_compressed: {
            type: String,
        },
        square: {
            type: String,
        },
        square_compressed: {
            type: String,
        },
    },
    custom_id: {
        type: String,
    },
    type: {
        type: String,
        enum: ['video', 'audio'],
        required: true,
    },
    genre: {
        type: mongoose.ObjectId,
        ref: 'genre',
    },
    language: {
        type: mongoose.ObjectId,
        ref: 'language',
    },
    audio: {
        type: audioSchema,
    },
    video: {
        type: videoSchema,
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

assetSchema.index({ created_at: 1 });
assetSchema.index({ updated_at: 1 });
assetSchema.index({ custom_id: 1 }, {
    unique: true,
    sparse: 1,
});

assetSchema.index({
    _id: 1,
    user: 1,
});
assetSchema.index({
    user: 1,
    category: 1,
});

const model = omniflixStudio.model('asset', assetSchema)
    .on('index', (error) => {
        if (error) {
            logger.error(error);
        }
    });

model.syncIndexes().then().catch(logger.error);

module.exports = model;
