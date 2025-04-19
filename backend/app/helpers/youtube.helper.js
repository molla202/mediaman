const async = require('async');
const fs = require('fs');
const assetDistributionDBO = require('../dbos/asset_distribution.dbo');
const assetDistributionError = require('../errors/asset_distribution.error');
const logger = require('../../logger');

const uploadYoutubeVideo = (youtube, assetOptions, filePath, assetDistributionId) => {
    async.waterfall([
        (next) => {
            assetDistributionDBO.findOneAndUpdate({
                _id: assetDistributionId,
            }, {
                $set: {
                    status: 'IN_PROGRESS',
                },
            }, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: assetDistributionError.updateAssetDistributionFailed,
                        message: 'Error occurred while updating asset distribution.',
                    });
                } else if (result) {
                    next(null);
                } else {
                    next({
                        error: assetDistributionError.assetDistributionNotFound,
                        message: 'Asset distribution not found.',
                    });
                }
            });
        }, (next) => {
            assetOptions.media.body = fs.createReadStream(filePath, 'binary');
            youtube.insert(assetOptions, {
                onUploadProgress: (progress) => {
                    console.log(progress);
                },
            }, (error, result) => {
                if (error) {
                    logger.error(error);
                    updateAssetDistributionStatus(assetDistributionId, 'FAILED');
                } else if (result && result.data && result.data.id) {
                    next(null, result.data);
                } else {
                    logger.error(result);
                    updateAssetDistributionStatus(assetDistributionId, 'FAILED');
                }
            });
        }, (ytData, next) => {
            const updates = {
                $set: {
                    youtube: {
                        id: ytData.id,
                        title: ytData.snippet.title,
                        description: ytData.snippet.description,
                        thumbnail: ytData.snippet.thumbnails,
                        privacy_status: ytData.status.privacyStatus,
                        channel_id: ytData.snippet.channelId,
                    },
                    status: 'COMPLETED',
                },
            };
            assetDistributionDBO.findOneAndUpdate({
                _id: assetDistributionId,
            }, updates, false, (error, result) => {
                if (error) {
                    next({
                        error: assetDistributionError.updateAssetDistributionFailed,
                        message: 'Error occurred while updating asset distribution.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        error: assetDistributionError.assetDistributionNotFound,
                        message: 'Asset distribution not found.',
                    });
                }
            });
        },
    ], (error) => {
        if (error) {
            logger.error(error);
        }
    });
};

const updateAssetDistributionStatus = (assetDistributionId, status) => {
    async.waterfall([
        (next) => {
            assetDistributionDBO.findOneAndUpdate({
                _id: assetDistributionId,
            }, {
                $set: {
                    status,
                },
            }, false, (error, result) => {
                if (error) {
                    next({
                        error: assetDistributionError.updateAssetDistributionFailed,
                        message: 'Error occurred while updating asset distribution.',
                    });
                } else if (result) {
                    next(null);
                } else {
                    next({
                        error: assetDistributionError.assetDistributionNotFound,
                        message: 'Asset distribution not found.',
                    });
                }
            });
        },
    ], (error) => {
        if (error) {
            logger.error(error);
        }
    });
};

module.exports = {
    uploadYoutubeVideo,
};
