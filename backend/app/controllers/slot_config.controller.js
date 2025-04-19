const async = require('async');
const slotConfigDBO = require('../dbos/slot_config.dbo');
const slotConfigError = require('../errors/slot_config.error');
const processJSONResponse = require('../utils/response.util');
const logger = require('../../logger');

const getSlotsConfig = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
    } = req.params;

    const conditions = {
        live_stream: liveStreamId,
        media_space: mediaSpace,
    };
    const options = {};

    async.waterfall([
        (next) => {
            slotConfigDBO.find(conditions, {
                __v: 0,
                created_at: 0,
                updated_at: 0,
            }, options, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotConfigError.findSlotConfigFailed,
                        message: 'Error occurred while finding slots configuration.',
                    });
                } else {
                    delete (result['updated_at']);
                    delete (result['created_at']);
                    delete (result.__v);

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

const addSlotConfig = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
    } = req.params;

    const {
        name,
        type,
        slotLength,
        ads,
        totalAdsDuration,
        adsPerBreak,
        adDuration,
        adAfterPrograms,
        adAfterDuration,
        adBasedOn,
        contentPromos,
        promosPerBreak,
        defaultAdCampaigns,
        categories,
        tags,
    } = req.body;

    const doc = {
        live_stream: liveStreamId,
        media_space: mediaSpace,
    };

    if (name) {
        doc.name = name;
    }
    if (type) {
        doc.type = type;
    }
    if (slotLength !== undefined) {
        doc.slot_length = slotLength;
    }
    if (ads !== undefined) {
        doc['ad_config.ads'] = ads;
    }
    if (totalAdsDuration !== undefined) {
        doc['ad_config.total_ads_duration'] = totalAdsDuration;
    }
    if (adsPerBreak) {
        doc['ad_config.no_ads_per_break'] = adsPerBreak;
    }
    if (adDuration !== undefined) {
        doc['ad_config.ad_duration'] = adDuration;
    }
    if (adAfterPrograms !== undefined) {
        doc['ad_config.ad_after.programs'] = adAfterPrograms;
    }
    if (adAfterDuration !== undefined) {
        doc['ad_config.ad_after.duration'] = adAfterDuration;
    }
    if (adBasedOn) {
        doc['ad_config.ad_based_on'] = adBasedOn;
    }
    if (contentPromos !== undefined) {
        doc['ad_config.content_promos'] = contentPromos;
    }
    if (promosPerBreak !== undefined) {
        doc['ad_config.promos_per_break'] = promosPerBreak;
    }
    if (defaultAdCampaigns) {
        doc['ad_config.default_ad_campaigns'] = defaultAdCampaigns;
    }
    if (categories) {
        doc['content_config.categories'] = categories;
    }
    if (tags) {
        doc['content_config.tags'] = tags;
    }

    async.waterfall([
        (next) => {
            slotConfigDBO.save(doc, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotConfigError.saveSlotConfigFailed,
                        message: 'Error occurred while saving slot configuration.',
                    });
                } else {
                    delete (result['updated_at']);
                    delete (result['created_at']);
                    delete (result.__v);

                    next(null, {
                        status: 201,
                        result,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateSlotConfig = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        id,
    } = req.params;

    const conditions = {
        _id: id,
        live_stream: liveStreamId,
        media_space: mediaSpace,
    };
    const {
        name,
        type,
        slotLength,
        ads,
        totalAdsDuration,
        adDuration,
        adsPerBreak,
        adAfterPrograms,
        adAfterDuration,
        adBasedOn,
        contentPromos,
        promosPerBreak,
        defaultAdCampaigns,
        categories,
        tags,
    } = req.body;
    const set = {};
    if (name) {
        set.name = name;
    }
    if (type) {
        set.type = type;
    }
    if (slotLength) {
        set.slot_length = slotLength;
    }
    if (ads !== undefined) {
        set['ad_config.ads'] = ads;
    }
    if (totalAdsDuration !== undefined) {
        set['ad_config.total_ads_duration'] = totalAdsDuration;
    }
    if (adDuration !== undefined) {
        set['ad_config.ad_duration'] = adDuration;
    }
    if (adsPerBreak) {
        set['ad_config.no_ads_per_break'] = adsPerBreak;
    }
    if (adAfterPrograms !== undefined) {
        set['ad_config.ad_after.programs'] = adAfterPrograms;
    }
    if (adAfterDuration !== undefined) {
        set['ad_config.ad_after.duration'] = adAfterDuration;
    }
    if (adBasedOn) {
        set['ad_config.ad_based_on'] = adBasedOn;
    }
    if (contentPromos !== undefined) {
        set['ad_config.content_promos'] = contentPromos;
    }
    if (promosPerBreak !== undefined) {
        set['ad_config.promos_per_break'] = promosPerBreak;
    }
    if (defaultAdCampaigns) {
        set['ad_config.default_ad_campaigns'] = defaultAdCampaigns;
    }
    if (categories) {
        set['content_config.categories'] = categories;
    }
    if (tags) {
        set['content_config.tags'] = tags;
    }

    async.waterfall([
        (next) => {
            slotConfigDBO.findOneAndUpdate(conditions,
                {
                    $set: set,
                }, {
                    new: true,
                }, true, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: slotConfigError.updateSlotConfigFailed,
                            message: 'Error occurred while updating slot configuration.',
                        });
                    } else if (result) {
                        delete (result['updated_at']);
                        delete (result['created_at']);
                        delete (result.__v);
                        next(null, {
                            status: 200,
                            result,
                        });
                    } else {
                        logger.error(error);
                        next({
                            error: slotConfigError.slotConfigDoesNotExist,
                            message: 'slot configuration does not exist.',
                        });
                    }
                });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const deleteSlotConfig = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        id,
    } = req.params;

    async.waterfall([
        (next) => {
            slotConfigDBO.findOneAndDelete({
                _id: id,
                media_space: mediaSpace,
            }, {}, false, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotConfigError.deleteSlotConfigFailed,
                        message: 'Error occurred while deleting the slot config.',
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
    getSlotsConfig,
    addSlotConfig,
    updateSlotConfig,
    deleteSlotConfig,
};
