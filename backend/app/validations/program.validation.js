const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const getProgramsSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
    startAt: joi.date(),
    endAt: joi.date(),
    sortBy: joi.string(),
    order: joi.string().valid('asc', 'desc'),
});

const addProgramSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
    startAt: joi.date().required(),
    endAt: joi.date().required(),
    type: joi.string().valid('content', 'ad'),
    asset: joi.object().keys({
        id: joi.string().regex(patterns.objectId).required(),
        startAt: joi.number().min(0).required(),
        endAt: joi.number().min(0).required(),
    }),
});

const updateProgramSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
    startAt: joi.date(),
    endAt: joi.date(),
    type: joi.string().valid('content', 'ad'),
    asset: joi.object().keys({
        id: joi.string().regex(patterns.objectId),
        startAt: joi.number().min(0),
        endAt: joi.number().min(0),
    }),
});

const updateProgramsSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
    programs: joi.array().items(joi.object().keys({
        startAt: joi.date().required(),
        endAt: joi.date().required(),
        asset: joi.object().keys({
            id: joi.string().regex(patterns.objectId).required(),
            startAt: joi.number().min(0).required(),
            endAt: joi.number().min(0).required(),
        }).required(),
    })).required(),
});

const addProgramOverlaySchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
    startAt: joi.date().required(),
    endAt: joi.date().required(),
    asset: joi.string().regex(patterns.objectId).required(),
});

const updateProgramOverlaySchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
    programId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
    startAt: joi.date(),
    endAt: joi.date(),
    asset: joi.string().regex(patterns.objectId),
});

const deleteProgramSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
});

const deleteProgramOverlaySchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
    programId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
});

const getLiveStreamProgramsSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    startAt: joi.date(),
    endAt: joi.date(),
});

const fillProgramsSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
    append: joi.boolean(),
    type: joi.string().valid('video'),
    categories: joi.array().items(joi.string().regex(patterns.objectId)),
    genres: joi.array().items(joi.string().regex(patterns.objectId)),
    timePeriod: joi.number().min(0).max(10800),
    tags: joi.object().keys({
        include: joi.array().items(joi.string()),
        exclude: joi.array().items(joi.string()),
    }),
});

const clearProgramsSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
});
module.exports = {
    getPrograms: (req, res, cb) => validate(getProgramsSchema, req, res, cb),
    addProgram: (req, res, cb) => validate(addProgramSchema, req, res, cb),
    updatePrograms: (req, res, cb) => validate(updateProgramsSchema, req, res, cb),
    updateProgram: (req, res, cb) => validate(updateProgramSchema, req, res, cb),
    deleteProgram: (req, res, cb) => validate(deleteProgramSchema, req, res, cb),
    addProgramOverlay: (req, res, cb) => validate(addProgramOverlaySchema, req, res, cb),
    updateProgramOverlay: (req, res, cb) => validate(updateProgramOverlaySchema, req, res, cb),
    deleteProgramOverlay: (req, res, cb) => validate(deleteProgramOverlaySchema, req, res, cb),
    getLiveStreamPrograms: (req, res, cb) => validate(getLiveStreamProgramsSchema, req, res, cb),
    fillPrograms: (req, res, cb) => validate(fillProgramsSchema, req, res, cb),
    clearPrograms: (req, res, cb) => validate(clearProgramsSchema, req, res, cb),
};
