const async = require('async');
const { DESC } = require('../constants');
const slotTemplateDBO = require('../dbos/slot_template.dbo');
const slotTemplateError = require('../errors/slot_template.error');
const processJSONResponse = require('../utils/response.util');
const logger = require('../../logger');

const getSlotTemplates = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        sortBy,
        order,
    } = req.query;
    const conditions = {
        media_space: mediaSpace,
    };
    const options = {};
    if (sortBy) {
        options.sort = {
            [sortBy]: order || DESC,
        };
    }

    async.waterfall([
        (next) => {
            slotTemplateDBO.find(conditions, {
                __v: 0,
                created_at: 0,
                updated_at: 0,
            }, options, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotTemplateError.findSlotTemplateFailed,
                        message: 'Error occurred while finding the slot templetes.',
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

const addSlotTemplate = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        name,
        type,
        duration,
        categories,
        genres,
        includeTags,
        excludeTags,
    } = req.body;

    async.waterfall([
        (next) => {
            slotTemplateDBO.findOne({
                name,
                media_space: mediaSpace,
            }, {
                _id: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotTemplateError.findSlotTemplateFailed,
                        message: 'Error occurred while finding the slot template.',
                    });
                } else if (result) {
                    next({
                        status: 400,
                        error: slotTemplateError.slotTemplateAlreadyExist,
                        message: 'slot template already exists.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            const doc = {
                name,
                type,
                media_space: mediaSpace,
            };
            if (duration) {
                doc.duration = duration;
            }
            if (categories) {
                doc.categories = categories;
            }
            if (genres) {
                doc.genres = genres;
            }
            if (includeTags) {
                doc.include_tags = includeTags;
            }
            if (excludeTags) {
                doc.exclude_tags = excludeTags;
            }

            slotTemplateDBO.save(doc, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotTemplateError.saveSlotTemplateFailed,
                        message: 'Error occurred while saving the slot template.',
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
        }], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateSlotTemplate = (req, res) => {
    const {
        id,
    } = req.params;
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        name,
        type,
        duration,
        categories,
        genres,
        includeTags,
        excludeTags,
    } = req.body;

    const set = {};
    if (type) {
        set.type = type;
    }
    if (name) {
        set.name = name;
    }
    if (duration) {
        set.duration = duration;
    }
    if (categories) {
        set.categories = categories;
    }
    if (genres) {
        set.genres = genres;
    }
    if (includeTags) {
        set.include_tags = includeTags;
    }
    if (excludeTags) {
        set.exclude_tags = excludeTags;
    }
    async.waterfall([
        (next) => {
            slotTemplateDBO.findOneAndUpdate({
                _id: id,
                media_space: mediaSpace,
            }, {
                $set: set,
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotTemplateError.updateSlotTemplateFailed,
                        message: 'Error occurred while updating the slot template.',
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
                    logger.error(error);
                    next({
                        error: slotTemplateError.slotTemplateDoesNotExist,
                        message: 'slot template does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const deleteSlotTemplate = (req, res) => {
    const {
        id,
    } = req.params;
    const {
        media_space: mediaSpace,
    } = req.user;

    async.waterfall([
        (next) => {
            slotTemplateDBO.findOneAndDelete({
                _id: id,
                media_space: mediaSpace,
            }, {}, false, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotTemplateError.deleteSlotTemplateFailed,
                        message: 'Error occurred while deleting the slot template.',
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
    getSlotTemplates,
    addSlotTemplate,
    updateSlotTemplate,
    deleteSlotTemplate,
};
