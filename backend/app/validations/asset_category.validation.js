const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const getAssetCategoriesSchema = joi.object().keys({
    encode: joi.string(),
});

const addAssetCategorySchema = joi.object().keys({
    name: joi.string().required(),
});

const updatedAssetCategorySchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    name: joi.string(),
});

const deleteAssetCategorySchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
});

module.exports = {
    getAssetCategories: (req, res, cb) => validate(getAssetCategoriesSchema, req, res, cb),
    addAssetCategory: (req, res, cb) => validate(addAssetCategorySchema, req, res, cb),
    updateAssetCategory: (req, res, cb) => validate(updatedAssetCategorySchema, req, res, cb),
    deleteAssetCategory: (req, res, cb) => validate(deleteAssetCategorySchema, req, res, cb),
};
