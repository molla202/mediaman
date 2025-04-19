const async = require('async');
const assetCategoryDBO = require('../dbos/asset_category.dbo');
const assetCategoryError = require('../errors/asset_category.error');
const processJSONResponse = require('../utils/response.util');
const logger = require('../../logger');
const { getAssetCategoryPipeLine } = require('../helpers/asset_category.helper');

const getAssetCategories = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const { encode } = req.query;

    async.waterfall([
        (next) => {
            const pipeline = getAssetCategoryPipeLine(_id, encode, mediaSpace._id || mediaSpace);
            next(null, pipeline);
        }, (pipeline, next) => {
            assetCategoryDBO.aggregate(pipeline, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetCategoryError.findAssetCategoryFailed,
                        message: 'Error occurred while finding the asset categories.',
                    });
                } else {
                    next(null, {
                        status: 200,
                        result,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addAssetCategory = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    let { name } = req.body;

    name = name.trim().toLowerCase();

    async.waterfall([
        (next) => {
            assetCategoryDBO.save({
                user: _id,
                media_space: mediaSpace,
                name,
            }, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetCategoryError.saveAssetCategoryFailed,
                        message: 'Error occurred while saving the asset category.',
                    });
                } else {
                    result = result.toObject();
                    delete (result['created_at']);
                    delete (result['updated_at']);
                    delete (result.__v);

                    next(null, {
                        status: 201,
                        result,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateAssetCategory = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const { id } = req.params;
    let { name } = req.body;

    if (name) {
        name = name.trim().toLowerCase();
    }

    async.waterfall([
        (next) => {
            assetCategoryDBO.findOneAndUpdate({
                _id: id,
                user: _id,
                media_space: mediaSpace,
            }, {
                $set: {
                    name: name,
                },
            }, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetCategoryError.updateAssetCategoryFailed,
                        message: 'Error occurred while updating the asset category.',
                    });
                } else if (result) {
                    delete (result['created_at']);
                    delete (result['updated_at']);
                    delete (result.__v);

                    next(null, {
                        status: 200,
                        result,
                    });
                } else {
                    next({
                        status: 404,
                        error: assetCategoryError.assetCategoryDoesNotExist,
                        message: 'Asset category does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const deleteAssetCategory = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const { id } = req.params;

    async.waterfall([
        (next) => {
            assetCategoryDBO.findOneAndDelete({
                _id: id,
                user: _id,
                media_space: mediaSpace,
            }, {}, false, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetCategoryError.deleteAssetCategoryFailed,
                        message: 'Error occurred while deleting the asset category.',
                    });
                } else {
                    next(null, {
                        status: 200,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

module.exports = {
    getAssetCategories,
    addAssetCategory,
    updateAssetCategory,
    deleteAssetCategory,
};
