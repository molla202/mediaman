const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const addAdCampaignSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
    asset: joi.string().regex(patterns.objectId).required(),
    type: joi.string().valid('ad', 'bug').required(),
    frequencyPerSlot: joi.number().min(1),
    preferredPosition: joi.string().valid('start', 'mid', 'end'),
});

const updateAdCampaignSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
    asset: joi.string().regex(patterns.objectId),
    type: joi.string().valid('ad', 'bug'),
    frequencyPerSlot: joi.number().min(1),
    preferredPosition: joi.string().valid('start', 'mid', 'end'),
    startAt: joi.date(),
    repeat: joi.number(),
    frequency: joi.number(),
    position: joi.string(),
});

const addAdCampaignBugSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
    asset: joi.string().regex(patterns.objectId).required(),
    type: joi.string().valid('ad', 'bug').required(),
    startAt: joi.date().required(),
    repeat: joi.number(),
    frequency: joi.number(),
    position: joi.string(),
});

const deleteAdCampaignSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    slotId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
});

const addCampaign = (req, res, cb) => {
    if (req.body.type) {
        const type = req.body.type.toLowerCase();
        if (type === 'ad') {
            validate(addAdCampaignSchema, req, res, cb);
        } else if (type === 'bug') {
            validate(addAdCampaignBugSchema, req, res, cb);
        } else {
            res.status(422).send({
                success: false,
                error: {
                    message: 'Invalid \'type\'.',
                },
            });
        }
    } else {
        res.status(422).send({
            success: false,
            error: {
                message: 'Field \'type\' is required.',
            },
        });
    }
};

module.exports = {
    getAdCampaigns: (req, res, cb) => cb(),
    addAdCampaign: (req, res, cb) => addCampaign(req, res, cb),
    updateAdCampaign: (req, res, cb) => validate(updateAdCampaignSchema, req, res, cb),
    deleteAdCampaign: (req, res, cb) => validate(deleteAdCampaignSchema, req, res, cb),
};
