const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const addVideoSchema = joi.object().keys({
    type: joi.string().valid('audio', 'video'),
    customId: joi.string(),
    videoType: joi.string(),
    language: joi.string().regex(patterns.objectId),
    category: joi.string().regex(patterns.objectId),
    genre: joi.string().regex(patterns.objectId),
    tags: joi.array().items(joi.string()),
    description: joi.string(),
    name: joi.string(),
    duration: joi.number().min(1),
    file: joi.object().keys({
        source: joi.string(),
        id: joi.string(),
    }),
    horizontalThumbnail: joi.string(),
    verticalThumbnail: joi.string(),
    squareThumbnail: joi.string(),
    horizontalCompressedThumbnail: joi.string(),
    verticalCompressedThumbnail: joi.string(),
    squareCompressedThumbnail: joi.string(),
});

const addAudioSchema = joi.object().keys({
    type: joi.string().valid('audio', 'video', 'graphic', 'text'),
    customId: joi.string(),
    language: joi.string().regex(patterns.objectId),
    category: joi.string().regex(patterns.objectId),
    genre: joi.string().regex(patterns.objectId),
    tags: joi.array().items(joi.string()),
    description: joi.string(),
    trackName: joi.string(),
    name: joi.string(),
    duration: joi.number().min(1),
    ownershipStatus: joi.string(),
    isrcCode: joi.string(),
    popularity: joi.string().valid('latest', 'classics', 'evergreen', 'retro', 'popular'),
    file: joi.object().keys({
        source: joi.string(),
        id: joi.string(),
    }),
    horizontalThumbnail: joi.string(),
    verticalThumbnail: joi.string(),
    squareThumbnail: joi.string(),
    horizontalCompressedThumbnail: joi.string(),
    verticalCompressedThumbnail: joi.string(),
    squareCompressedThumbnail: joi.string(),
});

const addAsset = (req, res, cb) => {
    if (req.body.type) {
        const type = req.body.type.toLowerCase();
        if (type === 'audio') {
            validate(addAudioSchema, req, res, cb);
        } else if (type === 'video') {
            validate(addVideoSchema, req, res, cb);
        } else {
            res.status(422).send({
                success: false,
                error: {
                    message: 'Invalid \'type\'.',
                },
            });
        }
    } else {
        res.status(422).send({
            success: false,
            error: {
                message: 'Field \'type\' is required',
            },
        });
    }
};

const updateVideoSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    type: joi.string(),
    customId: joi.string(),
    videoType: joi.string(),
    language: joi.string().regex(patterns.objectId),
    category: joi.string().regex(patterns.objectId),
    genre: joi.string().regex(patterns.objectId),
    tags: joi.array().items(joi.string()),
    description: joi.string(),
    trackName: joi.string(),
    name: joi.string(),
    duration: joi.number().min(1),
    ownershipStatus: joi.string(),
    isrcCode: joi.string(),
    file: joi.object().keys({
        source: joi.string(),
        id: joi.string(),
    }),
    horizontalThumbnail: joi.string(),
    verticalThumbnail: joi.string(),
    squareThumbnail: joi.string(),
    horizontalCompressedThumbnail: joi.string(),
    verticalCompressedThumbnail: joi.string(),
    squareCompressedThumbnail: joi.string(),
});

const updateAudioSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    type: joi.string(),
    customId: joi.string(),
    language: joi.string().regex(patterns.objectId),
    category: joi.string().regex(patterns.objectId),
    genre: joi.string().regex(patterns.objectId),
    tags: joi.array().items(joi.string()),
    description: joi.string(),
    trackName: joi.string(),
    name: joi.string(),
    duration: joi.number().min(1),
    ownershipStatus: joi.string(),
    isrcCode: joi.string(),
    popularity: joi.string().valid('latest', 'classics', 'evergreen', 'retro', 'popular'),
    file: joi.object().keys({
        source: joi.string(),
        id: joi.string(),
    }),
    horizontalThumbnail: joi.string(),
    verticalThumbnail: joi.string(),
    squareThumbnail: joi.string(),
    horizontalCompressedThumbnail: joi.string(),
    verticalCompressedThumbnail: joi.string(),
    squareCompressedThumbnail: joi.string(),
});

const updateAsset = (req, res, cb) => {
    if (req.body.type) {
        const type = req.body.type.toLowerCase();
        if (type === 'audio') {
            validate(updateAudioSchema, req, res, cb);
        } else if (type === 'video') {
            validate(updateVideoSchema, req, res, cb);
        } else {
            res.status(422).send({
                success: false,
                error: {
                    message: 'Invalid \'type\'.',
                },
            });
        }
    } else {
        res.status(422).send({
            success: false,
            error: {
                message: 'Field \'type\' is required.',
            },
        });
    }
};

const updateAssetFileSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    token: joi.string(),
    file: joi.object().keys({
        name: joi.string(),
        path: joi.string(),
        size: joi.number(),
        MIMEType: joi.string(),
        duration: joi.number(),
        length: joi.number(),
        IPFSHash: joi.string(),
        previewIPFSHash: joi.string(),
        status: joi.string().valid('PENDING', 'IN_QUEUE', 'UPLOAD_FAILED', 'PROCESSING', 'IPFS_PIN_FAILED', 'ERROR', 'COMPLETE'),
    }),
    thumbnail: joi.object().keys({
        horizontalThumbnail: joi.string(),
        verticalThumbnail: joi.string(),
        squareThumbnail: joi.string(),
        horizontalCompressedThumbnail: joi.string(),
        verticalCompressedThumbnail: joi.string(),
        squareCompressedThumbnail: joi.string(),
    }),
});

const getAssetSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
});

const deleteAssetSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    source: joi.boolean(),
    encoded: joi.boolean(),
});

const encodeAssetSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
});

const getAssetsSchema = joi.object().keys({
    skip: joi.number().min(0),
    limit: joi.number().min(0),
    sortBy: joi.string(),
    order: joi.string().valid('asc', 'desc'),
    minted: joi.boolean(),
    total: joi.boolean(),
    type: joi.string(),
    category: joi.string(),
    genre: joi.string(),
    encode: joi.string(),
    recent: joi.boolean(),
    days: joi.number().min(0),
    uncategorised: joi.boolean(),
    search: joi.string(),
    categories: joi.array().items(joi.string().regex(patterns.objectId)),
    genres: joi.array().items(joi.string()),
    sources: joi.array().items(joi.string()),
    downloadStatus: joi.string(),
    encodeStatus: joi.string(),
    uploadDate: joi.date(),
    publishDate: joi.date(),
    tags: joi.array().items(joi.string()),
});

const updateRunnerAssetSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    token: joi.string().required(),
    file: joi.object().keys({
        name: joi.string(),
        path: joi.string(),
        size: joi.number().positive(),
        MIMEType: joi.string(),
        duration: joi.number().positive(),
        length: joi.number().positive(),
        IPFSHash: joi.string(),
        encodedFileIPFSHash: joi.string(),
        previewIPFSHash: joi.string(),
        status: joi.string(),
        thumbnail: {
            horizontalThumbnail: joi.string(),
            verticalThumbnail: joi.string(),
            squareThumbnail: joi.string(),
            horizontalCompressedThumbnail: joi.string(),
            verticalCompressedThumbnail: joi.string(),
            squareCompressedThumbnail: joi.string(),
        },
    }),
    name: joi.string(),
    source: joi.string().valid('sftp', 'studio', 'twitter', 'youtube'),
    downloadStatus: joi.string(),
    encodeStatus: joi.string(),
    downloadPath: joi.string(),
    encodePath: joi.string(),
    encodeSegments: joi.array().items(
        joi.object().keys({
            startAt: joi.number().min(0).required(),
            endAt: joi.number().min(0).required(),
        }),
    ),
    duration: joi.number(),
});

const addRunnerAssetSchema = joi.object().keys({
    token: joi.string().required(),
    userId: joi.string().regex(patterns.objectId).required(),
    name: joi.string(),
    file: joi.object().keys({
        name: joi.string(),
        size: joi.number().positive(),
        MIMEType: joi.string(),
        length: joi.number().positive(),
        path: joi.string(),
        source: joi.string().valid('sftp', 'studio', 'twitter', 'youtube'),
        id: joi.string(),
        category: joi.string().regex(patterns.objectId),
        IPFSHash: joi.string(),
        previewIPFSHash: joi.string(),
        genre: joi.string().regex(patterns.objectId),
        tags: joi.array().items(joi.string()),
        assetName: joi.string(),
        duration: joi.number().min(1),
        videoType: joi.string(),
        thumbnail: {
            horizontalThumbnail: joi.string(),
            verticalThumbnail: joi.string(),
            squareThumbnail: joi.string(),
            horizontalCompressedThumbnail: joi.string(),
            verticalCompressedThumbnail: joi.string(),
            squareCompressedThumbnail: joi.string(),
        },
    }),
});

const getAssetWatchUrlSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    deviceId: joi.string().required(),
});

const getAssetCountSchema = joi.object().keys({
    mediaSpaceId: joi.string().regex(patterns.objectId).required(),
});

const addScriptAssetSchema = joi.object().keys({
    name: joi.string().required(),
    token: joi.string().required(),
    type: joi.string().valid('audio', 'video', 'graphic', 'text').required(),
    user_id: joi.string().regex(patterns.objectId).required(),
});

const updateScriptAssetSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    token: joi.string().required(),
    encodePath: joi.string(),
    encodeStatus: joi.string(),
    encodeSegments: joi.array().items(
        joi.object().keys({
            startAt: joi.number().min(0).required(),
            endAt: joi.number().min(0).required(),
        }),
    ),
});

module.exports = {
    getAssets: (req, res, cb) => validate(getAssetsSchema, req, res, cb),
    getAssetTags: (req, res, cb) => cb(),
    addAsset,
    updateAsset,
    getAsset: (req, res, cb) => validate(getAssetSchema, req, res, cb),
    updateAssetFile: (req, res, cb) => validate(updateAssetFileSchema, req, res, cb),
    deleteAsset: (req, res, cb) => validate(deleteAssetSchema, req, res, cb),
    encodeAsset: (req, res, cb) => validate(encodeAssetSchema, req, res, cb),
    getAssetsOverview: (req, res, cb) => cb(),
    getAssetWatchUrl: (req, res, cb) => validate(getAssetWatchUrlSchema, req, res, cb),
    getAssetCount: (req, res, cb) => validate(getAssetCountSchema, req, res, cb),
    addRunnerAssets: (req, res, cb) => validate(addRunnerAssetSchema, req, res, cb),
    updateRunnerAsset: (req, res, cb) => validate(updateRunnerAssetSchema, req, res, cb),
    addScriptAsset: (req, res, cb) => validate(addScriptAssetSchema, req, res, cb),
    updateScriptAsset: (req, res, cb) => validate(updateScriptAssetSchema, req, res, cb),
};
