const joi = require('@hapi/joi');
const { patterns, validate } = require('./common');

const addDefaultAdCampaignSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    asset: joi.string().regex(patterns.objectId).required(),
    type: joi.string().valid('ad', 'bug').required(),
    frequencyPerSlot: joi.number().min(1),
    preferredPosition: joi.string().valid('start', 'mid', 'end'),
});

const updateDefaultAdCampaignSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
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

const addDefaultAdCampaignBugSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    asset: joi.string().regex(patterns.objectId).required(),
    type: joi.string().valid('ad', 'bug').required(),
    startAt: joi.date().required(),
    repeat: joi.number(),
    frequency: joi.number(),
    position: joi.string(),
});

const deleteDefaultAdCampaignSchema = joi.object().keys({
    liveStreamId: joi.string().regex(patterns.objectId).required(),
    id: joi.string().regex(patterns.objectId).required(),
});

const addDefaultCampaign = (req, res, cb) => {
    if (req.body.type) {
        const type = req.body.type.toLowerCase();
        if (type === 'ad') {
            validate(addDefaultAdCampaignSchema, req, res, cb);
        } else if (type === 'bug') {
            validate(addDefaultAdCampaignBugSchema, req, res, cb);
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
    getDefaultAdCampaigns: (req, res, cb) => cb(),
    addDefaultAdCampaign: (req, res, cb) => addDefaultCampaign(req, res, cb),
    updateDefaultAdCampaign: (req, res, cb) => validate(updateDefaultAdCampaignSchema, req, res, cb),
    deleteDefaultAdCampaign: (req, res, cb) => validate(deleteDefaultAdCampaignSchema, req, res, cb),
};
