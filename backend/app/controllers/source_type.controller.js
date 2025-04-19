const async = require('async');
const sourceTypeDBO = require('../dbos/source_type.dbo');
const sourceTypeError = require('../errors/source_type.error');
const processJSONResponse = require('../utils/response.util');
const logger = require('../../logger');

const getSourceTypes = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;

    async.waterfall([
        (next) => {
            sourceTypeDBO.find({
                media_space: mediaSpace,
            }, {
                name: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: sourceTypeError.findSourceTypeFailed,
                        message: 'Error occurred while finding the source types.',
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

const addSourceType = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    let { name } = req.body;

    name = name.trim().toLowerCase();

    async.waterfall([
        (next) => {
            sourceTypeDBO.save({
                name,
                media_space: mediaSpace,
            }, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: sourceTypeError.saveSourceTypeFailed,
                        message: 'Error occurred while saving the source type.',
                    });
                } else {
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

const updateSourceType = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const { id } = req.params;
    let { name } = req.body;

    if (name) {
        name = name.trim().toLowerCase();
    }

    async.waterfall([
        (next) => {
            sourceTypeDBO.findOneAndUpdate({
                _id: id,
                media_space: mediaSpace,
            }, {
                $set: {
                    name: name,
                },
            }, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: sourceTypeError.updateSourceTypeFailed,
                        message: 'Error occurred while updating the source type.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result,
                    });
                } else {
                    next({
                        status: 404,
                        error: sourceTypeError.sourceTypeDoesNotExist,
                        message: 'Source type does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const deleteSourceType = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const { id } = req.params;

    async.waterfall([
        (next) => {
            sourceTypeDBO.findOneAndDelete({
                _id: id,
                media_space: mediaSpace,
            }, {}, false, (error) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: sourceTypeError.deleteSourceTypeFailed,
                        message: 'Error occurred while deleting the source type.',
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
    getSourceTypes,
    addSourceType,
    updateSourceType,
    deleteSourceType,
};
