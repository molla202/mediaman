const joi = require('@hapi/joi');
const { validate } = require('./common');

const getMediaSpacesSchema = joi.object().keys({
    skip: joi.number().min(0),
    limit: joi.number().min(1),
    sortBy: joi.string().valid('created_at', 'updated_at'),
    order: joi.string().valid('asc', 'desc'),
});

const addMediaNodeUserSchema = joi.object().keys({
    bcAccountAddress: joi.string().required(),
    id: joi.string().required(),
    token: joi.string().required(),
});

const updateMediaSpaceSchema = joi.object().keys({
    enableBroadcast: joi.boolean().required(),
});

module.exports = {
    getMediaSpaces: (req, res, cb) => validate(getMediaSpacesSchema, req, res, cb),
    addMediaNodeUser: (req, res, cb) => validate(addMediaNodeUserSchema, req, res, cb),
    updateMediaSpace: (req, res, cb) => validate(updateMediaSpaceSchema, req, res, cb),
};
