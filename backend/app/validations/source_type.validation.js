const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const addSourceTypeSchema = joi.object().keys({
    name: joi.string().required(),
});

const updateSourceTypeSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    name: joi.string(),
});

const deleteSourceTypeSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
});

module.exports = {
    getSourceTypes: (req, res, cb) => cb(),
    addSourceType: (req, res, cb) => validate(addSourceTypeSchema, req, res, cb),
    updateSourceType: (req, res, cb) => validate(updateSourceTypeSchema, req, res, cb),
    deleteSourceType: (req, res, cb) => validate(deleteSourceTypeSchema, req, res, cb),
};
