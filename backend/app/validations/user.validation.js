const joi = require('@hapi/joi');
const {
    patterns,
    validate,
} = require('./common');

const connectBCAccountSchema = joi.object().keys({
    bcAccountAddress: joi.string().required(),
    mediaSpace: joi.string().regex(patterns.objectId),
});

const verifyBCAccountSchema = joi.object().keys({
    userId: joi.string().regex(patterns.objectId).required(),
    authCode: joi.number().required(),
    authToken: joi.string(),
    sign: joi.object().keys({
        signature: joi.string().required(),
        pub_key: joi.object().keys({
            type: joi.string().required(),
            value: joi.string().required(),
        }).required(),
    }).required(),
});

const refreshUserAccessTokenSchema = joi.object().keys({
    refreshToken: joi.string().required(),
});

const updateUserProfileDetailsSchema = joi.object().keys({
    emailAddress: joi.string().email({ tlds: { allow: false } }),
});

const addUserSchema = joi.object().keys({
    bcAccountAddress: joi.string().required(),
    permissions: joi.array().items(joi.string().valid('studio', 'runner', 'ipfs', 'streamer')).required(),
});

const updateUserSchema = joi.object().keys({
    id: joi.string().regex(patterns.objectId).required(),
    permissions: joi.array().items(joi.string().valid('studio', 'runner', 'ipfs', 'streamer')).required(),
});

const addMediaNodeUserSchema = joi.object().keys({
    bcAccountAddress: joi.string().required(),
    broadcastEnabled: joi.boolean().default(true),
});

module.exports = {
    allowFeeGrant: (req, res, cb) => cb(),
    generateRecapVideo: (req, res, cb) => cb(),
    getUserProfileDetails: (req, res, cb) => cb(),
    getUserClaimStatus: (req, res, cb) => cb(),
    updateUserProfileDetails: (req, res, cb) => validate(updateUserProfileDetailsSchema, req, res, cb),
    addUser: (req, res, cb) => validate(addUserSchema, req, res, cb),
    updateUser: (req, res, cb) => validate(updateUserSchema, req, res, cb),
    connectBCAccount: (req, res, cb) => validate(connectBCAccountSchema, req, res, cb),
    verifyBCAccount: (req, res, cb) => validate(verifyBCAccountSchema, req, res, cb),
    refreshUserAccessToken: (req, res, cb) => validate(refreshUserAccessTokenSchema, req, res, cb),
    addMediaNodeUser: (req, res, cb) => validate(addMediaNodeUserSchema, req, res, cb),
};
