const async = require('async');
const Axios = require('axios');
const assetDBO = require('../dbos/asset.dbo');
const assetError = require('../errors/asset.error');
const assetCategoryDBO = require('../dbos/asset_category.dbo');
const assetCategoryError = require('../errors/asset_category.error');
const assetDistributionDBO = require('../dbos/asset_distribution.dbo');
const assetDistributionError = require('../errors/asset_distribution.error');
const { ip, port } = require('../../config/index').runner;
const logger = require('../../logger');

const getAssetsOverviewPipeline = (encode) => {
    const pipeline = [];

    if (encode) {
        pipeline.push({
            $match: {
                'file.encode.status': 'COMPLETE',
            },
        });
    }

    pipeline.push({
        $group: {
            _id: '$type',
            count: {
                $sum: 1,
            },
        },
    });

    return pipeline;
};

const deleteAsset = (asset, cb) => {
    const {
        _id,
        media_space: mediaSpace,
    } = asset;

    async.waterfall([
        (next) => {
            assetDBO.findOne({
                _id,
                media_space: mediaSpace,
            }, {
                'file.encode': 1,
                'file.download': 1,
                'file.name': 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the asset.',
                    });
                } else if (result) {
                    if (result.file.download.status === 'COMPLETE') {
                        next(null, true, result.file, result._id);
                    } else {
                        next(null, false, result.file, result._id);
                    }
                } else {
                    logger.error(error);
                    next({
                        error: assetError.assetDoesNotExist,
                        message: 'Asset does not exist.',
                    });
                }
            });
        }, (fileExists, file, AssetId, next) => {
            if (fileExists) {
                const url = `http://${ip}:${port}/runner/users/${_id}/assets/${AssetId}/delete`;
                const data = {};
                if (file && file.download && file.download.path) {
                    data.sourcePath = file.download.path + '/' + file.name;
                }
                if (file && file.encode && file.encode.path) {
                    data.encodedPath = file.encode.path;
                }

                Axios({
                    method: 'post',
                    url,
                    data,
                }).then(() => {
                    next(null);
                }).catch((error) => {
                    logger.error(error);
                    next({
                        error: assetError.requestRunnerFailed,
                        message: 'Error occurred while requesting the runner.',
                    });
                });
            } else {
                next(null);
            }
        }, (next) => {
            assetDBO.findOneAndDelete({
                _id,
            }, {}, false, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.deleteAssetFailed,
                        message: 'Error occurred while deleting the asset.',
                    });
                } else {
                    next(null);
                }
            });
        },
    ], (error) => {
        if (error) {
            logger.error(error);
        }
        cb(error);
    });
};

const deleteAssetCategoryAndDistribution = (mediaSpace, cb) => {
    async.waterfall([
        (next) => {
            assetCategoryDBO.deleteMany({
                media_space: mediaSpace,
            }, {}, (error) => {
                if (error) {
                    next({
                        error: assetCategoryError.deleteAssetCategoryFailed,
                        message: 'Error occurred while deleting the asset category.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            assetDistributionDBO.deleteMany({
                media_space: mediaSpace,
            }, {}, (error) => {
                if (error) {
                    next({
                        error: assetDistributionError.deleteAssetDistributionFailed,
                        message: 'Error occurred while deleting the asset distribution.',
                    });
                } else {
                    next(null);
                }
            });
        },
    ], (error) => {
        cb(error);
    });
};

module.exports = {
    getAssetsOverviewPipeline,
    deleteAsset,
    deleteAssetCategoryAndDistribution,
};
