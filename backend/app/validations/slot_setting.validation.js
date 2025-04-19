const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const getSlotsSettingSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
});
const getSlotSettingSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
});

const addSlotSettingSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
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

const updateSlotSettingSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
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

const deleteSlotSettingSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
});

module.exports = {
    getSlotsSetting: (req, res, cb) => validate(getSlotsSettingSchema, req, res, cb),
    getSlotSetting: (req, res, cb) => validate(getSlotSettingSchema, req, res, cb),
    addSlotSetting: (req, res, cb) => validate(addSlotSettingSchema, req, res, cb),
    updateSlotSetting: (req, res, cb) => validate(updateSlotSettingSchema, req, res, cb),
    deleteSlotSetting: (req, res, cb) => validate(deleteSlotSettingSchema, req, res, cb),
};
