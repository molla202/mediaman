const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const getSlotsSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    startAt: joi.date(),
    endAt: joi.date(),
    sortBy: joi.string(),
    order: joi.string().valid('asc', 'desc'),
});

const addSlotSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    name: joi.string().required(),
    type: joi.string(),
    startAt: joi.date().required().min(new Date()),
    endAt: joi.date().required().greater(joi.ref('startAt')),
});

const updateSlotSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
    name: joi.string(),
    type: joi.string(),
    startAt: joi.date().min(new Date()),
    endAt: joi.date(),
});

const deleteSlotSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
});

const pushSlotSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
});

const getSlotOverlaysSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
});

const addSlotOverlaySchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
    startAt: joi.date().required(),
    endAt: joi.date().required(),
    asset: joi.string().regex(patterns.objectId).required(),
    repeat: joi.number(),
    frequency: joi.number(),
    position: joi.string(),
});

const updateSlotOverlaySchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
    startAt: joi.date(),
    endAt: joi.date(),
    asset: joi.string().regex(patterns.objectId),
    repeat: joi.number(),
    frequency: joi.number(),
    position: joi.string(),
});

const deleteSlotOverlaySchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
});

const addSlotDynamicOverlaySchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
    repeat: joi.number().required(),
    frequency: joi.number().required(),
    position: joi.string(),
    asset: joi.string().regex(patterns.objectId).required(),
});

module.exports = {
    getSlots: (req, res, cb) => validate(getSlotsSchema, req, res, cb),
    addSlot: (req, res, cb) => validate(addSlotSchema, req, res, cb),
    updateSlot: (req, res, cb) => validate(updateSlotSchema, req, res, cb),
    deleteSlot: (req, res, cb) => validate(deleteSlotSchema, req, res, cb),
    pushSlot: (req, res, cb) => validate(pushSlotSchema, req, res, cb),
    pushNextSlot: (req, res, cb) => cb(),
    getSlotOverlays: (req, res, cb) => validate(getSlotOverlaysSchema, req, res, cb),
    addSlotOverlay: (req, res, cb) => validate(addSlotOverlaySchema, req, res, cb),
    updateSlotOverlay: (req, res, cb) => validate(updateSlotOverlaySchema, req, res, cb),
    deleteSlotOverlay: (req, res, cb) => validate(deleteSlotOverlaySchema, req, res, cb),
    addSlotDynamicOverlay: (req, res, cb) => validate(addSlotDynamicOverlaySchema, req, res, cb),
};
