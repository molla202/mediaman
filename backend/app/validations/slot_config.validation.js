const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const getSlotsConfigSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
});

const addSlotConfigSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    name: joi.string().required(),
    type: joi.string().required(),
    slotLength: joi.number().integer().positive(),
    ads: joi.boolean(),
    totalAdsDuration: joi.number(),
    adsPerBreak: joi.number(),
    adDuration: joi.number(),
    adAfterPrograms: joi.number(),
    adAfterDuration: joi.number(),
    adBasedOn: joi.string().valid('programs', 'duration'),
    contentPromos: joi.boolean(),
    promosPerBreak: joi.number(),
    defaultAdCampaigns: joi.array().items(joi.string().regex(patterns.objectId)),
    categories: joi.array().items(joi.string().regex(patterns.objectId)),
    tags: joi.array().items(joi.string()),
});

const updateSlotConfigSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    name: joi.string(),
    type: joi.string(),
    slotLength: joi.number().integer().positive(),
    ads: joi.boolean(),
    totalAdsDuration: joi.number(),
    adsPerBreak: joi.number(),
    adDuration: joi.number(),
    adAfterPrograms: joi.number(),
    adAfterDuration: joi.number(),
    adBasedOn: joi.string().valid('programs', 'duration'),
    contentPromos: joi.boolean(),
    promosPerBreak: joi.number(),
    defaultAdCampaigns: joi.array().items(joi.string().regex(patterns.objectId)),
    categories: joi.array().items(joi.string().regex(patterns.objectId)),
    tags: joi.array().items(joi.string()),

});

const deleteSlotConfigSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    liveStreamId: joi.string().regex(patterns.objectId).required(),
});

module.exports = {
    getSlotsConfig: (req, res, cb) => validate(getSlotsConfigSchema, req, res, cb),
    addSlotConfig: (req, res, cb) => validate(addSlotConfigSchema, req, res, cb),
    updateSlotConfig: (req, res, cb) => validate(updateSlotConfigSchema, req, res, cb),
    deleteSlotConfig: (req, res, cb) => validate(deleteSlotConfigSchema, req, res, cb),
};
