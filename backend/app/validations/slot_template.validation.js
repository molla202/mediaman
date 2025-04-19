const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const getSlotTemplateSchema = joi.object().keys({
    sortBy: joi.string(),
    order: joi.string().valid('asc', 'desc'),
});

const addSlotTemplateSchema = joi.object().keys({
    name: joi.string().required(),
    type: joi.string().required(),
    duration: joi.number(),
    categories: joi.array().items(joi.string().regex(patterns.objectId)),
    genres: joi.array().items(joi.string().regex(patterns.objectId)),
    includeTags: joi.array().items(joi.string()),
    excludeTags: joi.array().items(joi.string()),
});

const updateSlotTemplateSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    name: joi.string(),
    type: joi.string(),
    duration: joi.number(),
    categories: joi.array().items(joi.string().regex(patterns.objectId)),
    genres: joi.array().items(joi.string().regex(patterns.objectId)),
    includeTags: joi.array().items(joi.string()),
    excludeTags: joi.array().items(joi.string()),
});

const deleteSlotTemplateSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
});

module.exports = {
    getSlotTemplates: (req, res, cb) => validate(getSlotTemplateSchema, req, res, cb),
    addSlotTemplate: (req, res, cb) => validate(addSlotTemplateSchema, req, res, cb),
    updateSlotTemplate: (req, res, cb) => validate(updateSlotTemplateSchema, req, res, cb),
    deleteSlotTemplate: (req, res, cb) => validate(deleteSlotTemplateSchema, req, res, cb),
};
