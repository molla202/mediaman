const async = require('async');
const { ASC } = require('../constants');
const { omniflixStudio } = require('../../database');
const programDBO = require('../dbos/program.dbo');
const assetDBO = require('../dbos/asset.dbo');
const slotDBO = require('../dbos/slot.dbo');
const slotConfigDBO = require('../dbos/slot_config.dbo');
const liveStreamDBO = require('../dbos/live_stream.dbo');
const adCampaignDBO = require('../dbos/ad_compaign.dbo');
const adCampaignError = require('../errors/ad_compaign.error');
const assetError = require('../errors/asset.error');
const programError = require('../errors/program.error');
const slotError = require('../errors/slot.error');
const liveStreamError = require('../errors/live_stream.error');
const slotConfigError = require('../errors/slot_config.error');
const { validateAndUpdatePrograms } = require('../helpers/program.helper');
const slotHelper = require('../helpers/slot.helper');
const processJSONResponse = require('../utils/response.util');
const { stringToDate, msStringToDate } = require('../utils/date.util');
const { shuffle } = require('../utils/array.util');
const logger = require('../../logger');

const getPrograms = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        id,
    } = req.params;
    const {
        sortBy,
        order,
    } = req.query;
    let {
        startAt,
        endAt,
    } = req.query;

    const conditions = {
        live_stream: liveStreamId,
        slot: id,
        media_space: mediaSpace,
    };
    if (startAt) {
        startAt = stringToDate(startAt);
        conditions['start_at'] = {
            $gte: startAt,
        };
    }
    if (endAt) {
        endAt = stringToDate(endAt);
        conditions['end_at'] = {
            $lt: endAt,
        };
    }

    const options = {};
    if (sortBy) {
        options.sort = {
            [sortBy]: order || ASC,
        };
    } else {
        options.sort = {
            start_at: ASC,
        };
    }

    async.waterfall([
        (next) => {
            programDBO.find(conditions, {
                __v: 0,
                created_at: 0,
                updated_at: 0,
            }, options, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.findProgramFailed,
                        message: 'Error occurred while finding the programs.',
                    });
                } else {
                    next(null, result);
                }
            });
        }, (programs, next) => {
            slotDBO.findOne({
                _id: id,
                live_stream: liveStreamId,
            }, {
                overlays: 1,
                end_at: 1,
            }, {}, true, (error, slot) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot overlays.',
                    });
                } else if (slot) {
                    const _overlays = [];
                    const slotEndAt = new Date(slot.end_at);
                    if (slot.overlays) {
                        for (let j = 0; j < slot.overlays.length; j++) {
                            const overlay = slot.overlays[j];
                            let overlayStartAt = overlay.start_at;
                            let overlayEndAt = overlay.end_at;
                            let duration;
                            let name;
                            if (overlay.asset && overlay.asset.file) {
                                duration = overlay.asset.file.length;
                                name = overlay.asset.video.name;
                            } else {
                                continue;
                            }
                            _overlays.push({
                                _id: overlay._id,
                                name,
                                duration,
                                start_at: overlayStartAt,
                                end_at: overlayEndAt,
                            });
                            if (overlay && overlay.repeat) {
                                let newPts = new Date(overlayStartAt).getTime();
                                let frequency = overlay.frequency;
                                if (frequency) {
                                    while (frequency-- && (newPts + overlay.repeat * 60 * 1000) < slotEndAt.getTime()) {
                                        newPts += overlay.repeat * 60 * 1000;
                                        overlayStartAt = new Date(newPts);
                                        overlayEndAt = new Date(overlayStartAt.getTime() + (duration * 1000));
                                        _overlays.push({
                                            _id: overlay._id,
                                            name,
                                            duration,
                                            start_at: overlayStartAt,
                                            end_at: overlayEndAt,
                                        });
                                    }
                                } else {
                                    while ((newPts + overlay.repeat * 60 * 1000) < slotEndAt.getTime()) {
                                        newPts += overlay.repeat * 60 * 1000;
                                        overlayStartAt = new Date(newPts);
                                        overlayEndAt = new Date(overlayStartAt.getTime() + (duration * 1000));
                                        _overlays.push({
                                            _id: overlay._id,
                                            name,
                                            duration,
                                            start_at: overlayStartAt,
                                            end_at: overlayEndAt,
                                        });
                                    }
                                }
                            }
                        }
                    }
                    next(null, programs, _overlays);
                } else {
                    next({
                        error: slotError.slotDoesNotExist,
                        message: 'Slot does not exist.',
                    });
                }
            });
        }, (programs, _overlays, next) => {
            const _programs = [];
            for (let i = 0; i < programs.length; i++) {
                if (programs[i].asset && programs[i].asset._ && programs[i].asset._.file) {
                    for (const overlay of _overlays) {
                        if (new Date(programs[i].start_at) <= new Date(overlay.start_at) && new Date(overlay.start_at) < new Date(programs[i].end_at)) {
                            programs[i].overlays.push(overlay);
                        }
                    }
                    _programs.push(programs[i]);
                }
            }
            next(null, {
                status: 200,
                result: {
                    programs: _programs,
                    overlays: _overlays,
                },
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addProgram = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        id,
    } = req.params;
    let {
        startAt,
        endAt,
        asset,
    } = req.body;

    startAt = stringToDate(startAt);
    endAt = stringToDate(endAt);

    async.waterfall([
        (next) => {
            slotDBO.findOne({
                _id: id,
                live_stream: liveStreamId,
                media_space: mediaSpace,
            }, {
                start_at: 1,
                end_at: 1,
                name: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot.',
                    });
                } else if (result) {
                    next(null, result['start_at'], result['end_at'], result.name);
                } else {
                    next({
                        status: 404,
                        error: slotError.slotDoesNotExist,
                        message: 'Slot does not exist.',
                    });
                }
            });
        }, (_startAt, _endAt, slotName, next) => {
            slotDBO.findOne({
                live_stream: liveStreamId,
                media_space: mediaSpace,
                start_at: {
                    $gte: _endAt,
                },
            }, {
                slot_configuration: 1,
                start_at: 1,
                end_at: 1,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot.',
                    });
                } else if (result) {
                    next(null, _startAt, _endAt, slotName, result);
                } else {
                    next(null, _startAt, _endAt, slotName, null);
                }
            });
        }, (_startAt, _endAt, slotName, nextSlot, next) => {
            liveStreamDBO.findOne({
                _id: liveStreamId,
                media_space: mediaSpace,
            }, {
                slot_configuration: 1,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding live-stream.',
                    });
                } else if (result) {
                    next(null, _startAt, _endAt, slotName, nextSlot, result['slot_configuration']);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'liveStream Doesn\'t exist.',
                    });
                }
            });
        }, (_startAt, _endAt, slotName, nextSlot, streamSlotConfig, next) => {
            slotConfigDBO.findOne({
                name: slotName,
                live_stream: liveStreamId,
                media_space: mediaSpace,
            }, {
                name: 1,
                type: 1,
                slot_length: 1,
                ad_config: 1,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotConfigError.findSlotConfigFailed,
                        message: 'Error occurred while finding the slot configuration.',
                    });
                } else if (result) {
                    next(null, _startAt, _endAt, nextSlot, streamSlotConfig, result);
                } else {
                    logger.error(error);
                    next({
                        error: slotConfigError.slotConfigDoesNotExist,
                        message: 'slot configuration does not exist.',
                    });
                }
            });
        }, (_startAt, _endAt, nextSlot, streamSlotConfig, slotConfig, next) => {
            if (startAt < endAt && endAt > _startAt && startAt >= _startAt) {
                if (startAt < _endAt) {
                    next(null, streamSlotConfig, slotConfig, _endAt, nextSlot);
                } else if (nextSlot && nextSlot.start_at - startAt < 3 * 60 * 60 * 1000 && nextSlot.start_at > endAt) {
                    next(null, streamSlotConfig, slotConfig, _endAt, nextSlot);
                } else if (!nextSlot && _startAt - endAt < 3 * 60 * 60 * 1000) {
                    next(null, streamSlotConfig, slotConfig, _endAt, { start_at: endAt });
                } else {
                    next({
                        status: 400,
                        error: programError.invalidTimePeriod,
                        message: 'Invalid time period.',
                    });
                }
            } else {
                next({
                    status: 400,
                    error: programError.invalidTimePeriod,
                    message: 'Invalid time period.',
                });
            }
        }, (streamSlotConfig, slotConfig, slotEndAt, nextSlot, next) => {
            programDBO.findOne({
                live_stream: liveStreamId,
                slot: id,
                media_space: mediaSpace,
                $or: [{
                    $and: [{
                        start_at: {
                            $lte: startAt,
                        },
                    }, {
                        end_at: {
                            $gt: startAt,
                        },
                    }],
                }, {
                    $and: [{
                        start_at: {
                            $lt: endAt,
                        },
                    }, {
                        end_at: {
                            $gte: endAt,
                        },
                    }],
                }, {
                    $and: [{
                        start_at: {
                            $gt: startAt,
                        },
                    }, {
                        end_at: {
                            $lt: endAt,
                        },
                    }],
                }],
            }, {
                _id: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.findProgramFailed,
                        message: 'Error occurred while finding the program.',
                    });
                } else if (result) {
                    next({
                        status: 400,
                        error: programError.duplicateTimeSlot,
                        message: 'Duplicate time slot.',
                    });
                } else {
                    next(null, streamSlotConfig, slotConfig, slotEndAt, nextSlot);
                }
            });
        }, (streamSlotConfig, slotConfig, slotEndAt, nextSlot, next) => {
            programDBO.find({
                live_stream: liveStreamId,
                slot: id,
                media_space: mediaSpace,
            }, {}, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.findProgramFailed,
                        message: 'Error occurred while finding the program.',
                    });
                } else if (result && result.length) {
                    next(null, streamSlotConfig, slotConfig, result, slotEndAt, nextSlot);
                } else {
                    next(null, streamSlotConfig, slotConfig, [], slotEndAt, nextSlot);
                }
            });
        }, (streamSlotConfig, slotConfig, slotPrograms, slotEndAt, nextSlot, next) => {
            assetDBO.find({
                'file.encode.status': 'COMPLETE',
                media_space: mediaSpace,
            }, {
                __v: 0,
                updated_at: 0,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the assets.',
                    });
                } else if (result) {
                    const ads = result.filter(asset => asset.category && (asset.category.name === 'ads' || asset.category.name === 'ad'));
                    next(null, streamSlotConfig, slotConfig, slotPrograms, ads, slotEndAt, nextSlot);
                } else {
                    next({
                        error: assetError.assetDoesNotExist,
                        message: 'No assets found',
                    });
                }
            });
        }, (streamSlotConfig, slotConfig, slotPrograms, ads, slotEndAt, nextSlot, next) => {
            assetDBO.findOne({
                _id: asset.id,
                'file.encode.status': 'COMPLETE',
                media_space: mediaSpace,
            }, {
                __v: 0,
                updated_at: 0,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the assets.',
                    });
                } else if (result) {
                    next(null, streamSlotConfig, slotConfig, slotPrograms, ads, result, slotEndAt, nextSlot);
                } else {
                    next({
                        error: assetError.assetDoesNotExist,
                        message: 'No assets found with given id.',
                    });
                }
            });
        }, (streamSlotConfig, slotConfig, slotPrograms, ads, programAsset, slotEndAt, nextSlot, next) => {
            adCampaignDBO.find({
                live_stream: liveStreamId,
                slot: id,
                media_space: mediaSpace,
            }, {}, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: adCampaignError.findAdCampaignFailed,
                        message: 'Error occurred while finding the ad campaigns.',
                    });
                } else if (result && result.length) {
                    next(null, streamSlotConfig, slotConfig, slotPrograms, ads, programAsset, slotEndAt, nextSlot, result);
                } else {
                    if (slotConfig && slotConfig.ad_config && slotConfig.ad_config.default_ad_campaigns &&
                        slotConfig.ad_config.default_ad_campaigns.length) {
                        next(null, streamSlotConfig, slotConfig, slotPrograms, ads, programAsset, slotEndAt, nextSlot, slotConfig.default_ad_campaigns);
                    } else if (streamSlotConfig && streamSlotConfig.default_ad_campaigns && streamSlotConfig.default_ad_campaigns.length) {
                        next(null, streamSlotConfig, slotConfig, slotPrograms, ads, programAsset, slotEndAt, nextSlot, streamSlotConfig.default_ad_campaigns);
                    } else {
                        next(null, streamSlotConfig, slotConfig, slotPrograms, ads, programAsset, slotEndAt, nextSlot, []);
                    }
                }
            });
        }, (streamSlotConfig, slotConfig, slotPrograms, ads, programAsset, slotEndAt, nextSlot, campaigns, next) => {
            const allowedTime = msStringToDate(Math.floor((new Date(startAt)).getTime()) - (2 * 60 * 60 * 1000));
            const assetConditions = {
                'file.encode.status': 'COMPLETE',
                'video.video_type': 'tweet_video',
                'video.tweeted_at': { $gte: allowedTime },
                media_space: mediaSpace,
            };
            assetDBO.find(assetConditions, {
                __v: 0,
                updated_at: 0,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the assets.',
                    });
                } else {
                    if (result && result.length) {
                        next(null, streamSlotConfig, slotConfig, slotPrograms, ads, programAsset, slotEndAt, nextSlot, campaigns, result);
                    } else {
                        next(null, streamSlotConfig, slotConfig, slotPrograms, ads, programAsset, slotEndAt, nextSlot, campaigns, []);
                    }
                }
            });
        }, (streamSlotConfig, slotConfig, slotPrograms, ads, programAsset, slotEndAt, nextSlot, campaigns, contentPromos, next) => {
            let totalAdsDuration = 0;
            let programsBeforeAd = 0;
            let durationBeforeAd = 0;
            for (let i = 0; i < slotPrograms.length; i++) {
                if (slotPrograms[i].type === 'ad') {
                    totalAdsDuration += slotPrograms[i].asset.end_at - slotPrograms[i].asset.start_at;
                    durationBeforeAd = 0;
                    programsBeforeAd = 0;
                } else {
                    durationBeforeAd += slotPrograms[i].asset.end_at - slotPrograms[i].asset.start_at;
                    programsBeforeAd += 1;
                }
            }
            next(null, programAsset, totalAdsDuration, programsBeforeAd, durationBeforeAd, streamSlotConfig,
                slotConfig, ads, slotEndAt, nextSlot, campaigns, contentPromos);
        }, (programAsset, totalAdsDuration, programsBeforeAd, durationBeforeAd, streamSlotConfig, slotConfig, ads,
            slotEndAt, nextSlot, campaigns, contentPromos, next) => {
            let adConfig;
            if (slotConfig && slotConfig.ad_config) {
                adConfig = slotConfig.ad_config;
            } else if (streamSlotConfig) {
                adConfig = streamSlotConfig;
            }

            const _programs = [];
            const campaignAds = campaigns.filter(campaign => campaign.type && campaign.type === 'ad');
            let startTime = new Date(startAt);
            const segments = programAsset.file.encode.segments;
            if (nextSlot) {
                slotEndAt = nextSlot.start_at;
            }
            for (let i = 0; i < segments.length && startTime < slotEndAt; i++) {
                const segStartSec = segments[i].start_at;
                const segEndSec = segments[i].end_at;
                let segmentLength = segEndSec - segStartSec;
                if (segStartSec >= asset.endAt) {
                    break;
                }
                if (segments[i].end_at > asset.endAt) {
                    segmentLength = asset.endAt - segStartSec;
                }
                const segStartAt = startTime;
                const segEndAt = msStringToDate(Math.floor((segStartAt).getTime()) + segmentLength * 1000);
                _programs.push({
                    live_stream: liveStreamId,
                    slot: id,
                    start_at: segStartAt,
                    end_at: segEndAt,
                    asset: {
                        _: asset.id,
                        start_at: segStartSec,
                        end_at: segStartSec + segmentLength,
                    },
                    added_by: _id,
                    type: 'content',
                    segment_number: i,
                    is_dynamic: false,
                });
                startTime = segEndAt;
                durationBeforeAd += segmentLength;
                if (adConfig.ads && ads && ads.length && startTime < slotEndAt) {
                    if (adConfig.ad_based_on === 'duration') {
                        if (durationBeforeAd >= adConfig.ad_after.duration) {
                            durationBeforeAd = 0;
                            let adsDuration = 0;
                            let adsCount = 0;
                            let promosCount = 0;
                            while (adsCount < adConfig.no_ads_per_break) {
                                let ad;
                                if (campaignAds.length) {
                                    if (adsCount < campaignAds.length && campaignAds[adsCount].asset && campaignAds[adsCount].frequency_per_slot) {
                                        ad = campaignAds[adsCount].asset;
                                        campaignAds[adsCount].frequency_per_slot -= 1;
                                    } else {
                                        for (let k = 0; k < campaignAds.length; k++) {
                                            if (campaignAds[k].asset && campaignAds[k].asset && campaignAds[k].frequency_per_slot) {
                                                ad = campaignAds[k].asset;
                                                campaignAds[k].frequency_per_slot -= 1;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (!ad) {
                                    ad = ads[Math.floor(Math.random() * ads.length)];
                                }
                                const adEndAt = ad.file.length;
                                const startAt = startTime;
                                const endAt = msStringToDate(Math.floor((new Date(startTime)).getTime()) + adEndAt * 1000);
                                _programs.push({
                                    live_stream: liveStreamId,
                                    slot: id,
                                    start_at: startAt,
                                    end_at: endAt,
                                    asset: {
                                        _: ad._id,
                                        start_at: 0,
                                        end_at: adEndAt,
                                    },
                                    added_by: _id,
                                    type: 'ad',
                                    segment_number: 0,
                                    is_dynamic: true,
                                });
                                startTime = endAt;
                                adsDuration += adEndAt;
                                adsCount += 1;
                            }
                            totalAdsDuration += adsDuration;
                            if (adConfig.content_promos && contentPromos && contentPromos.length) {
                                while (promosCount < adConfig.promos_per_break && startTime < slotEndAt) {
                                    const promo = contentPromos[Math.floor(Math.random() * contentPromos.length)];

                                    const promoEndAt = promo.file.length;
                                    const startAt = startTime;
                                    const endAt = msStringToDate(Math.floor((new Date(startTime)).getTime()) + promoEndAt * 1000);
                                    _programs.push({
                                        live_stream: liveStreamId,
                                        slot: id,
                                        start_at: startAt,
                                        end_at: endAt,
                                        asset: {
                                            _: promo._id,
                                            start_at: 0,
                                            end_at: promoEndAt,
                                        },
                                        added_by: _id,
                                        type: 'ad',
                                        segment_number: 0,
                                        is_dynamic: true,
                                    });
                                    startTime = endAt;
                                    adsDuration += promoEndAt;
                                    promosCount += 1;
                                }
                            }
                        }
                    } else {
                        if (programsBeforeAd >= adConfig.ad_after.programs) {
                            programsBeforeAd = 0;
                            let adsDuration = 0;
                            let adsCount = 0;
                            let promosCount = 0;
                            while (adsCount < adConfig.no_ads_per_break) {
                                let ad;
                                if (campaignAds.length) {
                                    if (adsCount < campaignAds.length && campaignAds[adsCount].asset && campaignAds[adsCount].frequency_per_slot) {
                                        ad = campaignAds[adsCount].asset;
                                        campaignAds[adsCount].frequency_per_slot -= 1;
                                    } else {
                                        for (let k = 0; k < campaignAds.length; k++) {
                                            if (campaignAds[k].asset && campaignAds[k].asset && campaignAds[k].frequency_per_slot) {
                                                ad = campaignAds[k].asset;
                                                campaignAds[k].frequency_per_slot -= 1;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (!ad) {
                                    ad = ads[Math.floor(Math.random() * ads.length)];
                                }
                                const adEndAt = ad.file.length;
                                const startAt = startTime;
                                const endAt = msStringToDate(Math.floor((new Date(startTime)).getTime()) + adEndAt * 1000);
                                _programs.push({
                                    live_stream: liveStreamId,
                                    slot: id,
                                    start_at: startAt,
                                    end_at: endAt,
                                    asset: {
                                        _: ad._id,
                                        start_at: 0,
                                        end_at: adEndAt,
                                    },
                                    added_by: _id,
                                    type: 'ad',
                                    is_dynamic: true,
                                });
                                startTime = endAt;
                                adsDuration += adEndAt;
                                adsCount += 1;
                            }
                            totalAdsDuration += adsDuration;
                            if (adConfig.content_promos && contentPromos && contentPromos.length) {
                                while (promosCount < adConfig.promos_per_break && startTime < slotEndAt) {
                                    const promo = contentPromos[Math.floor(Math.random() * contentPromos.length)];

                                    const promoEndAt = promo.file.length;
                                    const startAt = startTime;
                                    const endAt = msStringToDate(Math.floor((new Date(startTime)).getTime()) + promoEndAt * 1000);
                                    _programs.push({
                                        live_stream: liveStreamId,
                                        slot: id,
                                        start_at: startAt,
                                        end_at: endAt,
                                        asset: {
                                            _: promo._id,
                                            start_at: 0,
                                            end_at: promoEndAt,
                                        },
                                        added_by: _id,
                                        type: 'ad',
                                        segment_number: 0,
                                        is_dynamic: true,
                                    });
                                    startTime = endAt;
                                    adsDuration += promoEndAt;
                                    promosCount += 1;
                                }
                            }
                        }
                    }
                }
            }
            next(null, _programs, slotEndAt);
        }, (_programs, slotEndAt, next) => {
            const _result = [];
            for (let i = 0; i < _programs.length; i++) {
                _programs[i].media_space = mediaSpace;
                programDBO.save(_programs[i], true, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: programError.saveProgramFailed,
                            message: 'Error occurred while saving the programs.',
                        });
                    } else {
                        result = result.toObject();
                        delete (result['created_at']);
                        delete (result['updated_at']);
                        delete (result.__v);
                        _result.push(result);
                        if (i === _programs.length - 1) {
                            _result.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
                            next(null, slotEndAt, _result);
                        }
                    }
                });
            }
        }, (slotEndAt, _result, next) => {
            slotDBO.findOneAndUpdate({
                _id: id,
                live_stream: liveStreamId,
                media_space: mediaSpace,
            }, {
                end_at: slotEndAt,
            }, {}, true, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.updateSlotFailed,
                        message: 'Error occurred while updating the slot.',
                    });
                } else {
                    slotHelper.pushSlot(id);
                    next(null, {
                        status: 201,
                        result: _result,
                    });
                }
            });
        }], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updatePrograms = (req, res) => {
    let session;

    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        id,
    } = req.params;
    const { programs } = req.body;

    const docs = [];
    for (let i = 0; i < programs.length; i++) {
        docs.push({
            live_stream: liveStreamId,
            slot: id,
            start_at: stringToDate(programs[i].startAt),
            end_at: stringToDate(programs[i].endAt),
            asset: {
                _: programs[i].asset.id,
                start_at: programs[i].asset.startAt,
                end_at: programs[i].asset.endAt,
            },
            added_by: _id,
            media_space: mediaSpace,
        });
    }

    async.waterfall([
        (next) => {
            slotDBO.findOne({
                _id: id,
                live_stream: liveStreamId,
                media_space: mediaSpace,
            }, {
                start_at: 1,
                end_at: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot.',
                    });
                } else if (result) {
                    next(null, result['start_at'], result['end_at']);
                } else {
                    next({
                        status: 404,
                        error: slotError.slotDoesNotExist,
                        message: 'Slot does not exist.',
                    });
                }
            });
        }, (_startAt, _endAt, next) => {
            omniflixStudio.startSession({}, (error, _session) => {
                if (error) {
                    logger.error(error);
                    next({
                        error,
                        message: 'Error occurred while starting session.',
                    });
                } else {
                    session = _session;
                    session.startTransaction();

                    next(null, _startAt, _endAt);
                }
            });
        }, (_startAt, _endAt, next) => {
            programDBO.deleteMany({
                live_stream: liveStreamId,
                slot: id,
                media_space: mediaSpace,
                start_at: {
                    $gte: docs[0].start_at,
                },
                end_at: {
                    $lte: docs[docs.length - 1].end_at,
                },
            }, {
                session,
            }, (error, res) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.deleteProgramsFailed,
                        message: 'Error occurred while deleting the programs.',
                    });
                } else {
                    next(null, _startAt, _endAt);
                }
            });
        }, (_startAt, _endAt, next) => {
            validateAndUpdatePrograms(docs, _startAt, _endAt, session, (error) => {
                if (error) {
                    session.abortTransaction()
                        .then(() => {
                            next(error);
                        })
                        .catch(error => {
                            logger.error(error);
                            next({
                                error: programError.abortChangesFailed,
                                message: 'Error occurred while aborting the db changes.',
                            });
                        });
                } else {
                    session.commitTransaction()
                        .then(_r => {
                            next(null, {
                                status: 200,
                            });
                        })
                        .catch(error => {
                            logger.error(error);
                            next({
                                error: programError.commitChangesFailed,
                                message: 'Error occurred while committing changes.',
                            });
                        });
                }
            });
        },
    ], (error, result) => {
        if (session) {
            session.endSession();
        }

        processJSONResponse(res, error, result);
    });
};

const updateProgram = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        slotId,
        id,
    } = req.params;
    const {
        asset,
        slot,
    } = req.body;
    let {
        startAt,
        endAt,
    } = req.body;

    const set = {};
    if (startAt) {
        startAt = stringToDate(startAt);
        set['start_at'] = startAt;
    }
    if (endAt) {
        endAt = stringToDate(endAt);
        set['end_at'] = endAt;
    }
    if (asset) {
        set.asset = {};
        if (asset.id) {
            set.asset._ = asset.id;
        }
        if (asset.startAt) {
            set.asset['start_at'] = asset.startAt;
        }
        if (asset.endAt) {
            set.asset['end_at'] = asset.endAt;
        }
    }
    if (slot) {
        set.slot = slot;
    }

    async.waterfall([
        (next) => {
            slotDBO.findOne({
                _id: slotId,
                live_stream: liveStreamId,
                media_space: mediaSpace,
            }, {
                start_at: 1,
                end_at: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot.',
                    });
                } else if (result) {
                    next(null, result['start_at'], result['end_at']);
                } else {
                    next({
                        status: 404,
                        error: slotError.slotDoesNotExist,
                        message: 'Slot does not exist.',
                    });
                }
            });
        }, (_startAt, _endAt, next) => {
            programDBO.findOne({
                _id: id,
                live_stream: liveStreamId,
                slot: slotId,
                media_space: mediaSpace,
            }, {
                start_at: 1,
                end_at: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.findProgramFailed,
                        message: 'Error occurred while finding the program.',
                    });
                } else if (result) {
                    next(null, _startAt, _endAt, startAt || result['start_at'], endAt || result['end_at']);
                } else {
                    next({
                        status: 404,
                        error: programError.programDoesNotExist,
                        message: 'Program does not exist.',
                    });
                }
            });
        }, (slotStartAt, slotEndAt, _startAt, _endAt, next) => {
            if (_startAt < _endAt &&
                (_startAt >= slotStartAt && _startAt <= slotEndAt) &&
                (_endAt >= slotStartAt)) {
                next(null, _startAt, _endAt);
            } else {
                next({
                    status: 400,
                    error: programError.invalidTimePeriod,
                    message: 'Invalid time period.',
                });
            }
        }, (_startAt, _endAt, next) => {
            programDBO.findOne({
                _id: {
                    $ne: id,
                },
                live_stream: liveStreamId,
                slot: slotId,
                media_space: mediaSpace,
                $or: [{
                    $and: [{
                        start_at: {
                            $lte: _startAt,
                        },
                    }, {
                        end_at: {
                            $gt: _startAt,
                        },
                    }],
                }, {
                    $and: [{
                        start_at: {
                            $lt: _endAt,
                        },
                    }, {
                        end_at: {
                            $gte: _endAt,
                        },
                    }],
                }, {
                    $and: [{
                        start_at: {
                            $gt: _startAt,
                        },
                    }, {
                        end_at: {
                            $lt: _endAt,
                        },
                    }],
                }],
            }, {
                _id: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.findProgramFailed,
                        message: 'Error occurred while finding the program.',
                    });
                } else if (result) {
                    next({
                        status: 400,
                        error: programError.duplicateTimeSlot,
                        message: 'Duplicate time slot.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            programDBO.findOneAndUpdate({
                _id: id,
                live_stream: liveStreamId,
                slot: slotId,
                media_space: mediaSpace,
            }, {
                $set: set,
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.updateProgramFailed,
                        message: 'Error occurred while updating the program.',
                    });
                } else {
                    delete (result['created_at']);
                    delete (result['updated_at']);
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

const deleteProgram = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        slotId,
        id,
    } = req.params;

    async.waterfall([
        (next) => {
            programDBO.findOne({
                _id: id,
                live_stream: liveStreamId,
                slot: slotId,
                media_space: mediaSpace,
            }, {
                start_at: 1,
                end_at: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.findProgramFailed,
                        message: 'Error occurred while finding the program.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        error: programError.programDoesNotExist,
                        message: 'Program does not exist.',
                    });
                }
            });
        }, (program, next) => {
            programDBO.find({
                live_stream: liveStreamId,
                slot: slotId,
                start_at: { $gte: program.end_at },
                media_space: mediaSpace,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.findProgramFailed,
                        message: 'Error occurred while finding the programs.',
                    });
                } else {
                    next(null, program, result);
                }
            });
        }, (program, programs, next) => {
            let programStartAt = program.start_at;
            const _programs = [];
            for (const _program of programs) {
                const programDuration = _program.asset.end_at - _program.asset.start_at;
                const programEndAt = msStringToDate(Math.floor((programStartAt).getTime()) + programDuration * 1000);
                _programs.push({
                    _id: _program._id,
                    live_stream: liveStreamId,
                    slot: slotId,
                    start_at: programStartAt,
                    end_at: programEndAt,
                    asset: {
                        _: _program.asset._._id,
                        start_at: _program.asset.start_at,
                        end_at: _program.asset.end_at,
                    },
                    type: _program.type,
                    is_dynamic: _program.is_dynamic,
                });
                programStartAt = programEndAt;
            }
            next(null, program, _programs);
        }, (program, programs, next) => {
            programDBO.deleteMany({
                live_stream: liveStreamId,
                slot: slotId,
                start_at: { $gte: program.start_at },
                media_space: mediaSpace,
            }, {}, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.deleteProgramsFailed,
                        message: 'Error occurred while deleting the programs.',
                    });
                } else {
                    next(null, programs);
                }
            });
        }, (programs, next) => {
            if (programs.length) {
                programDBO.insertMany(programs, {}, false, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: programError.updateProgramFailed,
                            message: 'Error occurred while updating the programs.',
                        });
                    } else {
                        next(null, {
                            status: 200,
                        });
                    }
                });
            } else {
                next(null, {
                    status: 200,
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addProgramOverlay = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        slotId,
        id,
    } = req.params;
    let {
        startAt,
        endAt,
        asset,
    } = req.body;

    startAt = stringToDate(startAt);
    endAt = stringToDate(endAt);

    async.waterfall([
        (next) => {
            programDBO.findOne({
                _id: id,
                live_stream: liveStreamId,
                slot: slotId,
                media_space: mediaSpace,
            }, {
                start_at: 1,
                end_at: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.findProgramFailed,
                        message: 'Error occurred while finding the program.',
                    });
                } else if (result) {
                    next(null, result['start_at'], result['end_at']);
                } else {
                    next({
                        status: 404,
                        error: programError.programDoesNotExist,
                        message: 'Program does not exist.',
                    });
                }
            });
        }, (_startAt, _endAt, next) => {
            if (startAt < endAt &&
                (startAt >= _startAt && startAt <= _endAt) &&
                (endAt >= _startAt && endAt <= _endAt)) {
                next(null);
            } else {
                next({
                    status: 400,
                    error: programError.invalidTimePeriod,
                    message: 'Invalid time period.',
                });
            }
        }, (next) => {
            assetDBO.findOne({
                _id: asset,
                media_space: mediaSpace,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the asset.',
                    });
                } else if (result) {
                    next(null);
                } else {
                    next({
                        status: 404,
                        error: assetError.assetDoesNotExist,
                        message: 'Asset does not exist.',
                    });
                }
            });
        }, (next) => {
            programDBO.findOneAndUpdate({
                _id: id,
                live_stream: liveStreamId,
                slot: slotId,
                media_space: mediaSpace,
            }, {
                $addToSet: {
                    overlays: {
                        start_at: startAt,
                        end_at: endAt,
                        asset,
                    },
                },
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.updateProgramFailed,
                        message: 'Error occurred while updating the program.',
                    });
                } else {
                    delete (result['created_at']);
                    delete (result['updated_at']);
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

const updateProgramOverlay = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        slotId,
        programId,
        id,
    } = req.params;
    const {
        asset,
        startAt,
        endAt,
    } = req.body;

    const set = {};
    if (asset) {
        set['overlays.$.asset'] = asset;
    }
    if (startAt) {
        set['overlays.$.start_at'] = stringToDate(startAt);
    }
    if (endAt) {
        set['overlays.$.end_at'] = stringToDate(endAt);
    }

    async.waterfall([
        (next) => {
            if (asset) {
                assetDBO.findOne({
                    _id: asset,
                    media_space: mediaSpace,
                }, {}, {}, false, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: assetError.findAssetFailed,
                            message: 'Error occurred while finding the asset.',
                        });
                    } else if (result) {
                        next(null);
                    } else {
                        next({
                            status: 404,
                            error: assetError.assetDoesNotExist,
                            message: 'Asset does not exist.',
                        });
                    }
                });
            } else {
                next(null);
            }
        }, (next) => {
            programDBO.findOne({
                _id: programId,
                live_stream: liveStreamId,
                slot: slotId,
                'overlays._id': id,
                media_space: mediaSpace,
            }, {
                start_at: 1,
                end_at: 1,
                'overlays.$': 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    return next({
                        error: programError.findProgramFailed,
                        message: 'Error occurred while finding the program.',
                    });
                } else if (result) {
                    const overlay = result.overlays[0];
                    const programStartAt = result.start_at;
                    const programEndAt = result.end_at;
                    const _startAt = startAt ? stringToDate(startAt) : overlay.start_at;
                    const _endAt = endAt ? stringToDate(endAt) : overlay.end_at;
                    next(null, programStartAt, programEndAt, _startAt, _endAt);
                } else {
                    next({
                        status: 404,
                        error: programError.programDoesNotExist,
                        message: 'Program does not exist.',
                    });
                }
            });
        }, (programStartAt, programEndAt, _startAt, _endAt, next) => {
            if (_startAt < _endAt &&
                (_startAt >= programStartAt && _startAt <= programEndAt) &&
                (_endAt >= programStartAt && _endAt <= programEndAt)) {
                next(null);
            } else {
                next({
                    status: 400,
                    error: programError.invalidTimePeriod,
                    message: 'Invalid time period.',
                });
            }
        }, (next) => {
            programDBO.findOneAndUpdate({
                _id: programId,
                live_stream: liveStreamId,
                slot: slotId,
                'overlays._id': id,
                media_space: mediaSpace,
            }, {
                $set: set,
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.updateProgramFailed,
                        message: 'Error occurred while updating the program.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result,
                    });
                } else {
                    next({
                        status: 404,
                        error: programError.programDoesNotExist,
                        message: 'Program does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const deleteProgramOverlay = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        slotId,
        programId,
        id,
    } = req.params;

    async.waterfall([
        (next) => {
            programDBO.findOneAndUpdate({
                _id: programId,
                live_stream: liveStreamId,
                slot: slotId,
                'overlays._id': id,
                media_space: mediaSpace,
            }, {
                $pull: {
                    overlays: {
                        _id: id,
                    },
                },
            }, {
                new: true,
            }, false, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.updateProgramFailed,
                        message: 'Error occurred while updating the program.',
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

const getLiveStreamPrograms = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        id,
    } = req.params;
    let {
        startAt,
        endAt,
    } = req.query;

    const conditions = {
        live_stream: id,
        media_space: mediaSpace,
    };
    if (startAt) {
        startAt = stringToDate(startAt);
        conditions['start_at'] = {
            $gte: startAt,
        };
    }
    if (endAt) {
        endAt = stringToDate(endAt);
        conditions['end_at'] = {
            $lt: endAt,
        };
    }

    async.waterfall([
        (next) => {
            programDBO.find(conditions, {
                __v: 0,
                created_at: 0,
                updated_at: 0,
            }, {
                sort: {
                    start_at: ASC,
                },
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.findProgramFailed,
                        message: 'Error occurred while finding the programs.',
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

const fillPrograms = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        id,
    } = req.params;
    const {
        categories,
        genres,
        tags,
    } = req.body;
    let {
        timePeriod,
    } = req.body;
    const {
        append,
    } = req.query;
    async.waterfall([
        (next) => {
            slotDBO.findOne({
                _id: id,
                live_stream: liveStreamId,
            }, {
                __v: 0,
                created_at: 0,
                updated_at: 0,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot.',
                    });
                } else if (result) {
                    if (new Date(result.end_at) > new Date()) {
                        next(null, result);
                    } else {
                        next({
                            error: slotError.invalidTimePeriod,
                            message: 'Cannot program past slot.',
                        });
                    }
                } else {
                    next({
                        status: 404,
                        error: slotError.slotDoesNotExist,
                        message: 'Slot does not exist.',
                    });
                }
            });
        }, (slot, next) => {
            const assetConditions = {
                'file.encode.status': 'COMPLETE',
                media_space: mediaSpace,
            };
            if (categories && categories.length) {
                assetConditions.category = {
                    $in: categories,
                };
            }
            if (genres && genres.length) {
                assetConditions.genre = {
                    $in: genres,
                };
            }
            if (tags && (tags.include || tags.exclude)) {
                assetConditions.tags = {};
                if (tags.include && tags.include.length) {
                    assetConditions.tags.$in = tags.include;
                }
                if (tags.exclude && tags.exclude.length) {
                    assetConditions.tags.$nin = tags.exclude;
                }
            }
            assetDBO.find(assetConditions, {
                __v: 0,
                updated_at: 0,
            }, {
                $sort: {
                    created_at: -1,
                },
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the assets.',
                    });
                } else if (result && result.length) {
                    const _assets = [];
                    let _fillerAssets = [];
                    if (categories && categories.length) {
                        let categoriesCount = 0;
                        for (const category of categories) {
                            categoriesCount += 1;
                            const filteredAssets = result.filter(asset => asset.category && asset.category._id.toString() === category);
                            if (categoriesCount < categories.length && filteredAssets && filteredAssets.length) {
                                _assets.push(filteredAssets[Math.floor(Math.random() * filteredAssets.length)]);
                            } else if (filteredAssets && filteredAssets.length) {
                                _fillerAssets = _fillerAssets.concat(filteredAssets);
                            }
                        }
                        next(null, slot, _assets, _fillerAssets);
                    } else {
                        next(null, slot, result, result);
                    }
                } else {
                    next({
                        error: assetError.assetDoesNotExist,
                        message: 'No assets found with given configuration.',
                    });
                }
            });
        }, (slot, assets, _fillerAssets, next) => {
            liveStreamDBO.findOne({
                _id: liveStreamId,
                media_space: mediaSpace,
            }, {
                slot_configuration: 1,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding live-stream.',
                    });
                } else if (result) {
                    next(null, result.slot_configuration, slot, assets, _fillerAssets);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'liveStream Doesn\'t exist.',
                    });
                }
            });
        }, (streamSlotConfig, slot, assets, _fillerAssets, next) => {
            slotConfigDBO.findOne({
                name: slot.name,
                live_stream: liveStreamId,
                media_space: mediaSpace,
            }, {
                name: 1,
                type: 1,
                slot_length: 1,
                ad_config: 1,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotConfigError.findSlotConfigFailed,
                        message: 'Error occurred while finding the slot configuration.',
                    });
                } else if (result) {
                    next(null, result, streamSlotConfig, slot, assets, _fillerAssets);
                } else {
                    next(null, null, streamSlotConfig, slot, assets, _fillerAssets);
                }
            });
        }, (slotConfig, streamSlotConfig, slot, assets, _fillerAssets, next) => {
            const assetConditions = {
                'file.encode.status': 'COMPLETE',
                media_space: mediaSpace,
            };
            assetDBO.find(assetConditions, {
                __v: 0,
                updated_at: 0,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the assets.',
                    });
                } else {
                    const ads = result.filter(asset => asset.category && (asset.category.name === 'ads' || asset.category.name === 'ad'));
                    next(null, slotConfig, streamSlotConfig, slot, assets, _fillerAssets, ads);
                }
            });
        }, (slotConfig, streamSlotConfig, slot, assets, _fillerAssets, ads, next) => {
            if (!append) {
                programDBO.deleteMany({ slot: id, media_space: mediaSpace }, {}, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: programError.deleteProgramFailed,
                            message: 'Error occurred while deleting the programs.',
                        });
                    } else if (result) {
                        next(null, slotConfig, streamSlotConfig, slot.start_at, 0, slot, assets, _fillerAssets, ads);
                    } else {
                        next({
                            status: 500,
                            error: programError.deleteProgramFailed,
                            message: 'Error occurred while deleting programs.',
                        });
                    }
                });
            } else {
                programDBO.find({
                    slot: id,
                    media_space: mediaSpace,
                }, {
                    start_at: 1,
                    end_at: 1,
                    'asset.start_at': 1,
                    'asset.end_at': 1,
                }, {
                    sort: { start_at: -1 },
                }, false, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: programError.findProgramFailed,
                            message: 'Error occurred while finding the programs.',
                        });
                    } else if (result.length) {
                        let duration = 0;
                        for (let i = 0; i < result.length; i++) {
                            duration += result[i].asset.end_at - result[i].asset.start_at;
                        }
                        next(null, slotConfig, streamSlotConfig, result[0].end_at, duration, slot, assets, _fillerAssets, ads);
                    } else {
                        next(null, slotConfig, streamSlotConfig, slot.start_at, 0, slot, assets, _fillerAssets, ads);
                    }
                });
            }
        }, (slotConfig, streamSlotConfig, startTime, duration, slot, assets, _fillerAssets, ads, next) => {
            adCampaignDBO.find({
                live_stream: liveStreamId,
                slot: id,
                media_space: mediaSpace,
            }, {}, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: adCampaignError.findAdCampaignFailed,
                        message: 'Error occurred while finding the ad campaigns.',
                    });
                } else if (result && result.length) {
                    next(null, slotConfig, streamSlotConfig, startTime, duration, slot, assets, _fillerAssets, ads, result);
                } else {
                    if (slotConfig && slotConfig.ad_config && slotConfig.ad_config.default_ad_campaigns &&
                        slotConfig.ad_config.default_ad_campaigns.length) {
                        next(null, slotConfig, streamSlotConfig, startTime, duration, slot, assets, _fillerAssets, ads, slotConfig.ad_config.default_ad_campaigns);
                    } else if (streamSlotConfig && streamSlotConfig.default_ad_campaigns && streamSlotConfig.default_ad_campaigns.length) {
                        next(null, slotConfig, streamSlotConfig, startTime, duration, slot, assets, _fillerAssets, ads, streamSlotConfig.default_ad_campaigns);
                    } else {
                        next(null, slotConfig, streamSlotConfig, startTime, duration, slot, assets, _fillerAssets, ads, []);
                    }
                }
            });
        }, (slotConfig, streamSlotConfig, startTime, duration, slot, assets, _fillerAssets, ads, campaigns, next) => {
            const allowedTime = msStringToDate(Math.floor((new Date(slot.start_at)).getTime()) - (2 * 60 * 60 * 1000));
            const assetConditions = {
                'file.encode.status': 'COMPLETE',
                'video.video_type': 'tweet_video',
                'video.tweeted_at': { $gte: allowedTime },
                media_space: mediaSpace,
            };
            console.log(allowedTime);
            assetDBO.find(assetConditions, {
                __v: 0,
                updated_at: 0,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the assets.',
                    });
                } else {
                    if (result && result.length) {
                        next(null, slotConfig, streamSlotConfig, startTime, duration, slot, assets, _fillerAssets, ads, campaigns, result);
                    } else {
                        next(null, slotConfig, streamSlotConfig, startTime, duration, slot, assets, _fillerAssets, ads, campaigns, []);
                    }
                }
            });
        },
        (slotConfig, streamSlotConfig, startTime, duration, slot, assets, _fillerAssets, ads, campaigns, contentPromos, next) => {
            let adConfig;
            if (slotConfig && slotConfig.ad_config) {
                adConfig = slotConfig.ad_config;
            } else if (streamSlotConfig) {
                adConfig = streamSlotConfig;
                slotConfig = streamSlotConfig;
            }
            const campaignAds = campaigns.filter(campaign => campaign.type && campaign.type === 'ad');
            const _programs = [];
            if (!timePeriod) {
                timePeriod = slotConfig.slot_length;
            }
            let durationBeforeAd = 0;
            let programsBeforeAd = 0;
            let totalAdsDuration = 0;
            let totalPromosDuration = 0;
            let programAssetCount = 0;
            let _fillers = shuffle(_fillerAssets.slice());
            while ((assets.length || _fillerAssets.length) && timePeriod >= 1 && startTime < slot.end_at) {
                if (_fillers.length === 0) {
                    _fillers = shuffle(_fillerAssets.slice());
                }
                let asset;
                if (programAssetCount < assets.length) {
                    asset = assets[programAssetCount];
                    programAssetCount += 1;
                } else {
                    asset = _fillers[0];
                    _fillers.shift();
                }
                if (!asset) {
                    break;
                }
                const segments = asset.file.encode.segments;
                for (let i = 0; i < segments.length; i++) {
                    if (timePeriod <= 0) {
                        break;
                    }
                    if (startTime >= slot.end_at) {
                        break;
                    }
                    const segStartAt = segments[i].start_at;
                    let segEndAt = segments[i].end_at;
                    const segDuration = segEndAt - segStartAt;
                    segEndAt = segDuration < timePeriod ? segEndAt : segStartAt + timePeriod;
                    timePeriod -= (segEndAt - segStartAt);
                    const startAt = startTime;
                    const endAt = msStringToDate(Math.floor((new Date(startTime)).getTime()) + (segEndAt - segStartAt) * 1000);
                    _programs.push({
                        live_stream: slot.live_stream,
                        slot: id,
                        media_space: mediaSpace,
                        start_at: startAt,
                        end_at: endAt,
                        asset: {
                            _: asset._id,
                            start_at: segStartAt,
                            end_at: segEndAt,
                        },
                        added_by: _id,
                        type: 'content',
                        segment_number: i,
                        is_dynamic: true,
                    });
                    startTime = endAt;
                    durationBeforeAd += segEndAt - segStartAt;
                    if (adConfig && adConfig.ads && ads && ads.length && startTime < slot.end_at) {
                        if (adConfig.ad_based_on === 'duration') {
                            if (durationBeforeAd >= adConfig.ad_after.duration) {
                                durationBeforeAd = 0;
                                let adsDuration = 0;
                                let adsCount = 0;
                                let promosCount = 0;
                                let promosDuration = 0;
                                while (timePeriod >= 1 && adsCount < adConfig.no_ads_per_break) {
                                    let ad;
                                    if (campaignAds.length) {
                                        if (adsCount < campaignAds.length && campaignAds[adsCount].asset && campaignAds[adsCount].frequency_per_slot) {
                                            ad = campaignAds[adsCount].asset;
                                            campaignAds[adsCount].frequency_per_slot -= 1;
                                        } else {
                                            for (let k = 0; k < campaignAds.length; k++) {
                                                if (campaignAds[k].asset && campaignAds[k].asset && campaignAds[k].frequency_per_slot) {
                                                    ad = campaignAds[k].asset;
                                                    campaignAds[k].frequency_per_slot -= 1;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                    if (!ad) {
                                        ad = ads[Math.floor(Math.random() * ads.length)];
                                    }
                                    let adEndAt = ad.file.length;
                                    if (adEndAt > timePeriod) {
                                        adEndAt = timePeriod;
                                    }
                                    const startAt = startTime;
                                    const endAt = msStringToDate(Math.floor((new Date(startTime)).getTime()) + adEndAt * 1000);
                                    _programs.push({
                                        live_stream: slot.live_stream,
                                        slot: id,
                                        media_space: mediaSpace,
                                        start_at: startAt,
                                        end_at: endAt,
                                        asset: {
                                            _: ad._id,
                                            start_at: 0,
                                            end_at: adEndAt,
                                        },
                                        added_by: _id,
                                        type: 'ad',
                                        segment_number: 0,
                                        is_dynamic: true,
                                    });
                                    startTime = endAt;
                                    timePeriod -= adEndAt;
                                    adsDuration += adEndAt;
                                    adsCount += 1;
                                }
                                if (adConfig.content_promos && contentPromos && contentPromos.length) {
                                    while (timePeriod >= 1 && promosCount < adConfig.promos_per_break) {
                                        const promo = contentPromos[Math.floor(Math.random() * contentPromos.length)];
                                        const promoEndAt = promo.file.length;
                                        const startAt = startTime;
                                        const endAt = msStringToDate(Math.floor((new Date(startTime)).getTime()) + promoEndAt * 1000);
                                        _programs.push({
                                            live_stream: slot.live_stream,
                                            slot: id,
                                            media_space: mediaSpace,
                                            start_at: startAt,
                                            end_at: endAt,
                                            asset: {
                                                _: promo._id,
                                                start_at: 0,
                                                end_at: promoEndAt,
                                            },
                                            added_by: _id,
                                            type: 'ad',
                                            is_dynamic: true,
                                        });
                                        startTime = endAt;
                                        timePeriod -= promoEndAt;
                                        promosDuration += promoEndAt;
                                        promosCount += 1;
                                    }
                                }
                                totalAdsDuration += adsDuration;
                                totalPromosDuration += promosDuration;
                            }
                        } else {
                            if (programsBeforeAd >= adConfig.ad_after.programs) {
                                programsBeforeAd = 0;
                                let adsDuration = 0;
                                let adsCount = 0;
                                let promosCount = 0;
                                let promosDuration = 0;
                                while (timePeriod >= 1 && adsCount < adConfig.no_ads_per_break) {
                                    let ad;
                                    if (campaignAds.length) {
                                        if (adsCount < campaignAds.length && campaignAds[adsCount].asset && campaignAds[adsCount].frequency_per_slot) {
                                            ad = campaignAds[adsCount].asset;
                                            campaignAds[adsCount].frequency_per_slot -= 1;
                                        } else {
                                            for (let k = 0; k < campaignAds.length; k++) {
                                                if (campaignAds[k].asset && campaignAds[k].asset && campaignAds[k].frequency_per_slot) {
                                                    ad = campaignAds[k].asset;
                                                    campaignAds[k].frequency_per_slot -= 1;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                    if (!ad) {
                                        ad = ads[Math.floor(Math.random() * ads.length)];
                                    }
                                    let adEndAt = ad.file.length;
                                    if (adEndAt > timePeriod) {
                                        adEndAt = timePeriod;
                                    }
                                    const startAt = startTime;
                                    const endAt = msStringToDate(Math.floor((new Date(startTime)).getTime()) + adEndAt * 1000);
                                    _programs.push({
                                        live_stream: slot.live_stream,
                                        slot: id,
                                        media_space: mediaSpace,
                                        start_at: startAt,
                                        end_at: endAt,
                                        asset: {
                                            _: ad._id,
                                            start_at: 0,
                                            end_at: adEndAt,
                                        },
                                        added_by: _id,
                                        type: 'ad',
                                        is_dynamic: true,
                                    });
                                    startTime = endAt;
                                    timePeriod -= adEndAt;
                                    adsDuration += adEndAt;
                                    adsCount += 1;
                                }
                                if (adConfig.content_promos && contentPromos && contentPromos.length) {
                                    while (timePeriod >= 1 && promosCount < adConfig.promos_per_break) {
                                        const promo = contentPromos[Math.floor(Math.random() * contentPromos.length)];
                                        const promoEndAt = promo.file.length;
                                        const startAt = startTime;
                                        const endAt = msStringToDate(Math.floor((new Date(startTime)).getTime()) + promoEndAt * 1000);
                                        _programs.push({
                                            live_stream: slot.live_stream,
                                            slot: id,
                                            media_space: mediaSpace,
                                            start_at: startAt,
                                            end_at: endAt,
                                            asset: {
                                                _: promo._id,
                                                start_at: 0,
                                                end_at: promoEndAt,
                                            },
                                            added_by: _id,
                                            type: 'ad',
                                            is_dynamic: true,
                                        });
                                        startTime = endAt;
                                        timePeriod -= promoEndAt;
                                        promosDuration += promoEndAt;
                                        promosCount += 1;
                                    }
                                }
                                totalAdsDuration += adsDuration;
                                totalPromosDuration += promosDuration;
                            }
                        }
                    }
                }
                programsBeforeAd += 1;
            }
            console.log('total ads duraion: ', totalAdsDuration);
            console.log('total_promos_duration', totalPromosDuration);

            next(null, _programs);
        }, (_programs, next) => {
            programDBO.insertMany(_programs, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.saveProgramFailed,
                        message: 'Error occurred while saving the programs.',
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

const clearPrograms = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        id,
    } = req.params;

    const conditions = {
        live_stream: liveStreamId,
        slot: id,
        media_space: mediaSpace,
    };
    async.waterfall([
        (next) => {
            programDBO.deleteMany(conditions, {}, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.deleteProgramsFailed,
                        message: 'Error occurred while deleting the programs.',
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
    getPrograms,
    addProgram,
    updatePrograms,
    updateProgram,
    deleteProgram,

    addProgramOverlay,
    updateProgramOverlay,
    deleteProgramOverlay,

    getLiveStreamPrograms,
    fillPrograms,
    clearPrograms,
};
