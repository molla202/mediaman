const async = require('async');
const { ASC } = require('../constants');
const defaultAdCampaignDBO = require('../dbos/default_ad_campaign.dbo');
const adCampaignError = require('../errors/ad_compaign.error');
const processJSONResponse = require('../utils/response.util');
const logger = require('../../logger');

const getDefaultAdCampaigns = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        sortBy,
        order,
    } = req.query;
    const {
        liveStreamId,
    } = req.params;
    const conditions = {
        live_stream: liveStreamId,
        media_space: mediaSpace,
    };
    const options = {};
    if (sortBy) {
        options.sort = {
            [sortBy]: order || ASC,
        };
    }

    async.waterfall([
        (next) => {
            defaultAdCampaignDBO.find(conditions, {
                __v: 0,
                created_at: 0,
                updated_at: 0,
            }, options, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: adCampaignError.findAdCampaignsFailed,
                        message: 'Error occurred while finding the default ad campaigns.',
                    });
                } else {
                    next(null, {
                        status: 200,
                        result,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addDefaultAdCampaign = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
    } = req.params;
    const {
        asset,
        type,
        frequencyPerSlot,
        preferredPosition,
        startAt,
        endAt,
        frequency,
        repeat,
        position,
    } = req.body;
    async.waterfall([
        (next) => {
            const doc = {
                asset,
                type,
                live_stream: liveStreamId,
                added_by: _id,
                media_space: mediaSpace,
            };
            if (frequencyPerSlot) {
                doc.frequency_per_slot = frequencyPerSlot;
            }
            if (preferredPosition) {
                doc.preferred_postion = preferredPosition;
            }
            if (startAt) {
                doc.start_at = startAt;
            }
            if (endAt) {
                doc.end_at = endAt;
            }
            if (frequency !== undefined) {
                doc.frequency = frequency;
            }
            if (repeat !== undefined) {
                doc.repeat = repeat;
            }
            if (position) {
                doc.position = position;
            }
            defaultAdCampaignDBO.save(doc, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: adCampaignError.saveAdCampaignFailed,
                        message: 'Error occurred while saving the default ad_campaign.',
                    });
                } else {
                    result = result.toObject();
                    delete (result['created_at']);
                    delete (result['updated_at']);
                    delete (result.__v);

                    next(null, {
                        status: 201,
                        result,
                    });
                }
            });
        }], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateDefaultAdCampaign = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        id,
    } = req.params;
    const {
        asset,
        type,
        frequencyPerSlot,
        preferredPosition,
        startAt,
        endAt,
        frequency,
        repeat,
        position,
    } = req.body;

    const set = {};
    if (type) {
        set.type = type;
    }
    if (asset) {
        set.asset = asset;
    }
    if (frequencyPerSlot) {
        set.frequency_per_slot = frequencyPerSlot;
    }
    if (preferredPosition) {
        set.preferred_postion = preferredPosition;
    }
    if (startAt) {
        set.start_at = startAt;
    }
    if (endAt) {
        set.end_at = endAt;
    }
    if (frequency !== undefined) {
        set.frequency = frequency;
    }
    if (repeat !== undefined) {
        set.repeat = repeat;
    }
    if (position) {
        set.position = position;
    }
    async.waterfall([
        (next) => {
            defaultAdCampaignDBO.findOneAndUpdate({
                _id: id,
                live_stream: liveStreamId,
                media_space: mediaSpace,
            }, {
                $set: set,
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: adCampaignError.updateAdCampaignFailed,
                        message: 'Error occurred while updating the default ad_campaign.',
                    });
                } else if (result) {
                    delete (result['created_at']);
                    delete (result['updated_at']);
                    delete (result.__v);

                    next(null, {
                        status: 200,
                        result,
                    });
                } else {
                    logger.error(error);
                    next({
                        error: adCampaignError.adCampaignDoesNotExist,
                        message: 'default ad_campaign does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const deleteDefaultAdCampaign = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        id,
    } = req.params;

    async.waterfall([
        (next) => {
            defaultAdCampaignDBO.findOneAndDelete({
                _id: id,
                media_space: mediaSpace,
            }, {}, false, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: adCampaignError.deleteAdCampaignFailed,
                        message: 'Error occurred while deleting the default ad_campaign.',
                    });
                } else {
                    next(null, {
                        status: 200,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

module.exports = {
    getDefaultAdCampaigns,
    addDefaultAdCampaign,
    updateDefaultAdCampaign,
    deleteDefaultAdCampaign,
};
