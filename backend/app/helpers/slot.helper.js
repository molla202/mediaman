const async = require('async');
const Axios = require('axios');
const defaultAdCampaignDBO = require('../dbos/default_ad_campaign.dbo');
const liveStreamDBO = require('../dbos/live_stream.dbo');
const liveStreamError = require('../errors/live_stream.error');
const programDBO = require('../dbos/program.dbo');
const programError = require('../errors/program.error');
const assetDBO = require('../dbos/asset.dbo');
const assetError = require('../errors/asset.error');
const slotDBO = require('../dbos/slot.dbo');
const slotConfigDBO = require('../dbos/slot_config.dbo');
const slotConfigError = require('../errors/slot_config.error');
const slotTemplateDBO = require('../dbos/slot_template.dbo');
const slotSettingDBO = require('../dbos/slot_setting.dbo');
const slotError = require('../errors/slot.error');
const logger = require('../../logger');
const { msStringToDate } = require('../utils/date.util');
const { shuffle } = require('../utils/array.util');
const { ip, port } = require('../../config').runner;

const getAd = (campaignAds, ads, cb) => {
    let ad;
    if (campaignAds.length) {
        for (let k = 0; k < campaignAds.length; k++) {
            if (campaignAds[k].frequency_per_slot) {
                ad = campaignAds[k].asset;
                campaignAds[k].frequency_per_slot -= 1;
                break;
            }
        }
    }
    if (!ad) {
        ad = ads[Math.floor(Math.random() * ads.length)];
    }
    return ad;
};

const createNextSlot = (liveStreamId, cb) => {
    const sortBy = 'start_at';
    const order = 1;
    const timeNow = msStringToDate(Math.floor((new Date()).getTime()));
    const conditions = {
        live_stream: liveStreamId,
    };
    if (timeNow) {
        conditions.$and = [{
            start_at: {
                $lt: timeNow,
            },
        }, {
            end_at: {
                $gt: timeNow,
            },
        }];
    }

    const options = {};
    if (sortBy) {
        options.sort = {
            [sortBy]: order,
        };
    }
    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: liveStreamId,
            }, {
                configuration: 1,
                slot_configuration: 1,
                media_space: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding live stream.',
                    });
                } else if (result) {
                    next(null, result.media_space, result.configuration.slot_length || result.slot_configuration.slot_length);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (mediaSpace, slotDuration, next) => {
            slotDBO.find(conditions, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot.',
                    });
                } else if (result && result.length === 1) {
                    next(null, mediaSpace, slotDuration, result[0]);
                } else if (result && result.length >= 1) {
                    next({
                        error: slotError.nextSlotAlreadyExist,
                        message: 'Next slot already exist.',
                    });
                } else {
                    next({
                        error: slotError.slotDoesNotExist,
                        message: 'Unable create next slot! current slot does not exist.',
                    });
                }
            });
        }, (mediaSpace, slotDuration, currentSlot, next) => {
            console.log(slotDuration);
            const startAt = currentSlot.end_at;
            const endAt = msStringToDate(Math.floor(startAt.getTime()) + slotDuration * 1000);
            console.log(startAt, endAt);
            const doc = {
                live_stream: liveStreamId,
                name: `Slot ${new Date(startAt).getUTCHours()}:${new Date(startAt).getUTCMinutes()}`,
                start_at: startAt,
                end_at: endAt,
                media_space: mediaSpace,
            };
            slotDBO.save(doc, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.saveSlotFailed,
                        message: 'Error occurred while saving slot.',
                    });
                } else {
                    next(null, result);
                }
            });
        },
    ], (error, result) => {
        if (error) {
            console.log(error);
            cb(error);
        } else {
            cb(null, result);
        }
    });
};

const fillSlotWithPrograms = (liveStreamId, slot, cb) => {
    let mediaSpace;
    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: liveStreamId,
            }, {}, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding live stream.',
                    });
                } else if (result) {
                    if (result.slot_configuration && result.slot_configuration.content_auto_fill_enabled) {
                        mediaSpace = result.media_space._id || result.media_space;
                        next(null, result.slot_configuration);
                    } else {
                        next({
                            error: liveStreamError.autoFillContentNotEnabled,
                            message: 'auto fill not enabled.',
                        });
                    }
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'live stream does not exist.',
                    });
                }
            });
        }, (defaultSlotConfig, next) => {
            slotConfigDBO.findOne({
                name: slot.name,
                live_stream: liveStreamId,
            }, {
                name: 1,
                type: 1,
                slot_length: 1,
                ad_config: 1,
                content_config: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot configuration.',
                    });
                } else if (result) {
                    next(null, defaultSlotConfig, result);
                } else {
                    next(null, defaultSlotConfig, null);
                }
            });
        }, (defaultSlotConfig, currentSlotConfig, next) => {
            let contentConfig;
            if (currentSlotConfig && currentSlotConfig.content_config) {
                contentConfig = currentSlotConfig.content_config;
            } else {
                contentConfig = defaultSlotConfig.content_config;
            }
            const conditions = {
                type: 'video',
                'file.encode.status': 'COMPLETE',
                media_space: mediaSpace._id || mediaSpace,
            };
            if (contentConfig && contentConfig.categories && contentConfig.categories.length) {
                conditions.category = {
                    $in: contentConfig.categories,
                };
            }
            if (contentConfig && contentConfig.tags && contentConfig.tags.length) {
                conditions.tags = {
                    $elemMatch: { $in: contentConfig.tags },
                };
            }
            assetDBO.find(conditions, {}, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding assets.',
                    });
                } else {
                    console.log(conditions, result);
                    next(null, defaultSlotConfig, currentSlotConfig, result);
                }
            });
        }, (streamSlotConfig, slotConfig, assets, next) => {
            const fillerConditions = {
                type: 'video',
                'file.encode.status': 'COMPLETE',
                media_space: mediaSpace._id || mediaSpace,
            };
            if (streamSlotConfig.fillers && streamSlotConfig.fillers.categories && streamSlotConfig.fillers.categories.length) {
                fillerConditions.category = {
                    $in: streamSlotConfig.fillers.categories,
                };
                assetDBO.find(fillerConditions, {}, {}, true, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: assetError.findAssetFailed,
                            message: 'Error occurred while finding assets.',
                        });
                    } else if (result.length) {
                        next(null, streamSlotConfig, slotConfig, assets, result);
                    } else {
                        next(null, streamSlotConfig, slotConfig, assets, assets);
                    }
                });
            } else {
                next(null, streamSlotConfig, slotConfig, assets, assets);
            }
        }, (streamSlotConfig, slotConfig, assets, fillers, next) => {
            slotConfig = slotConfig || streamSlotConfig;
            const _programs = [];
            let timePeriod = slotConfig.slot_length;
            let startTime = slot.start_at;
            let _assets = shuffle(assets.slice());
            let _fillers = shuffle(fillers.slice());
            while (assets.length && timePeriod >= 1 && startTime < slot.end_at) {
                let asset;
                if (_assets.length === 0) {
                    _assets = shuffle(assets.slice());
                }
                if (_fillers.length === 0) {
                    _fillers = shuffle(fillers.slice());
                }
                if (timePeriod <= 3600) {
                    asset = _fillers[0];
                    _fillers.shift();
                } else {
                    asset = _assets[0];
                    _assets.shift();
                }
                const segments = asset.file.encode.segments;
                for (let i = 0; i < segments.length; i++) {
                    if (timePeriod <= 0) {
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
                        media_space: mediaSpace,
                        slot: slot._id,
                        start_at: startAt,
                        end_at: endAt,
                        asset: {
                            _: asset._id,
                            start_at: segStartAt,
                            end_at: segEndAt,
                        },
                        type: 'content',
                        segment_number: i,
                        is_dynamic: true,
                    });
                    startTime = endAt;
                }
            }
            next(null, _programs);
        }, (_programs, next) => {
            programDBO.insertMany(_programs, {
                $project: { __v: 0 },
                $sort: { start_at: 1 },
            }, true, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: programError.saveProgramFailed,
                        message: 'Error occurred while saving the programs.',
                    });
                } else {
                    next(null, result);
                }
            });
        },
    ], (error, result) => {
        if (error) {
            cb(error);
        } else {
            cb(null, result);
        }
    });
};

const deleteSlotsOfMediaSpace = (mediaSpace, cb) => {
    async.waterfall([
        (next) => {
            slotDBO.deleteMany({
                media_space: mediaSpace._id,
            }, {}, (error) => {
                if (error) {
                    next({
                        error: slotError.deleteSlotFailed,
                        message: 'Error occurred while deleting the slots.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            slotConfigDBO.deleteMany({
                media_space: mediaSpace._id,
            }, {}, (error) => {
                if (error) {
                    next({
                        error: slotError.deleteSlotFailed,
                        message: 'Error occurred while deleting the slot configurations.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            slotTemplateDBO.deleteMany({
                media_space: mediaSpace._id,
            }, {}, (error) => {
                if (error) {
                    next({
                        error: slotError.deleteSlotTemplateFailed,
                        message: 'Error occurred while deleting the slot templates.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            slotSettingDBO.deleteMany({
                media_space: mediaSpace._id,
            }, {}, (error) => {
                if (error) {
                    next({
                        error: slotError.deleteSlotSettingFailed,
                        message: 'Error occurred while deleting the slot settings.',
                    });
                } else {
                    next(null);
                }
            });
        },
    ], cb);
};

const pushSlot = (slotId, cb) => {
    let userId, liveStreamId, username;
    async.waterfall([
        (next) => {
            slotDBO.findOne({
                _id: slotId,
            }, {
                name: 1,
                type: 1,
                overlays: 1,
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
                    if (result.media_space && result.media_space.lease) {
                        userId = result.media_space.lease.lessee;
                    }
                    if (result.live_stream) {
                        liveStreamId = result.live_stream._id || result.live_stream;
                    }
                    if (result.media_space && result.media_space.username) {
                        username = result.media_space.username;
                    }
                    next(null, result);
                } else {
                    next({
                        status: 404,
                        error: slotError.slotDoesNotExist,
                        message: 'Slot does not exist.',
                    });
                }
            });
        }, (slot, next) => {
            programDBO.find({
                slot: slotId,
            }, {
                __v: 0,
                created_at: 0,
                updated_at: 0,
            }, {
                sort: {
                    start_at: 1,
                },
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.findProgramFailed,
                        message: 'Error occurred while finding the programs.',
                    });
                } else if (result.length) {
                    next(null, slot, result);
                } else {
                    next({
                        status: 404,
                        error: programError.programDoesNotExist,
                        message: 'Programs does not exist.',
                    });
                }
            });
        }, (slot, programs, next) => {
            assetDBO.find({
                'file.encode.status': 'COMPLETE',
                media_space: slot.media_space._id || slot.media_space,
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
                } else {
                    next(null, slot, programs, result);
                }
            });
        }, (slot, programs, assets, next) => {
            liveStreamDBO.findOne({
                _id: slot.live_stream._id || slot.live_stream,
                media_space: slot.media_space._id || slot.media_space,
            }, {
                slot_configuration: 1,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the liveStream.',
                    });
                } else if (result) {
                    next(null, result.slot_configuration, slot, programs, assets);
                } else {
                    logger.error(error);
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'liveStream does not exist.',
                    });
                }
            });
        }, (streamSlotConfig, slot, programs, assets, next) => {
            slotConfigDBO.findOne({
                name: slot.name,
                live_stream: slot.live_stream._id || slot.live_stream,
                media_space: slot.media_space._id || slot.media_space,
            }, {
                name: 1,
                type: 1,
                slot_length: 1,
                ad_config: 1,
                content_config: 1,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotConfigError.findSlotConfigFailed,
                        message: 'Error occurred while finding the slot configuration.',
                    });
                } else if (result) {
                    next(null, result, streamSlotConfig, slot, programs, assets);
                } else {
                    next(null, null, streamSlotConfig, slot, programs, assets);
                }
            });
        }, (slotConfig, streamSlotConfig, slot, programs, assets, next) => {
            if (slotConfig) {
                next(null, slotConfig, streamSlotConfig, slot, programs, assets);
            } else if (slot.live_stream && slot.live_stream.slot_configuration) {
                const doc = {
                    name: slot.name,
                    live_stream: slot.live_stream._id || slot.live_stream,
                    media_space: slot.media_space._id || slot.media_space,
                    type: 'mixed',
                    slot_length: slot.live_stream.slot_configuration.slot_length,
                    ad_config: slot.live_stream.slot_configuration.ad_config,
                    content_config: slot.live_stream.slot_configuration.content_config,
                };
                slotConfigDBO.save(doc, false, (error, result) => {
                    if (error) {
                        logger.error(error.message);
                        next({
                            error: slotConfigError.saveSlotConfigFailed,
                            message: 'Error occurred while saving the slot configuration.',
                        });
                    } else {
                        next(null, result, streamSlotConfig, slot, programs, assets);
                    }
                });
            } else {
                next({
                    error: slotConfigError.slotConfigDoesNotExist,
                    message: 'Slot configuration does not exist.',
                });
            }
        }, (slotConfig, streamSlotConfig, slot, programs, assets, next) => {
            defaultAdCampaignDBO.find({
                live_stream: slot.live_stream._id || slot.live_stream,
                type: 'bug',
                media_space: slot.media_space._id || slot.media_space,
            }, {}, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next(null, slotConfig, streamSlotConfig, slot, programs, assets, []);
                } else if (result && result.length) {
                    next(null, slotConfig, streamSlotConfig, slot, programs, assets, result);
                } else {
                    next(null, slotConfig, streamSlotConfig, slot, programs, assets, []);
                }
            });
        }, (slotConfig, streamSlotConfig, slot, programs, assets, defaultOverlays, next) => {
            if (!slotConfig && streamSlotConfig) {
                slotConfig = streamSlotConfig;
            }

            let fillerAssets = [];
            if (slotConfig.fillers && slotConfig.fillers.categories) {
                const fillerCategories = [];
                for (const catg of slotConfig.fillers.categories) {
                    fillerCategories.push(catg.name);
                }
                fillerAssets = assets.filter(asset => asset.category && fillerCategories.includes(asset.category.name));
                fillerAssets = shuffle(fillerAssets);
            }
            if (fillerAssets.length === 0) {
                const musicAssets = assets.filter(asset => asset.category && asset.category.name === 'music');
                const scenes = assets.filter(asset => asset.category && (asset.category.name === 'scene' || asset.category.name === 'scenes'));
                if (musicAssets && musicAssets.length) {
                    fillerAssets = shuffle(musicAssets);
                } else {
                    fillerAssets = shuffle(scenes);
                }
            }
            const _slot = {
                name: slot.name,
                type: slot.type,
                startAt: slot.start_at,
                endAt: slot.end_at,
                programs: [],
                overlays: [],
            };
            const fillers = [];
            let totalDuration = 0;
            for (let i = 0; i < programs.length; i++) {
                let isAd = false;
                if (programs[i].type === 'ad') {
                    isAd = true;
                }
                if (totalDuration < slotConfig.slot_length && programs[i] && programs[i].asset && programs[i].asset._) {
                    const programDuration = programs[i].asset.end_at - programs[i].asset.start_at;
                    let programCategory;
                    if (programs[i].asset._.category) {
                        programCategory = programs[i].asset._.category.name.toLowerCase();
                    }
                    _slot.programs.push({
                        startAt: msStringToDate(Math.floor((slot.start_at).getTime()) + totalDuration * 1000),
                        endAt: msStringToDate(Math.floor((slot.start_at).getTime()) + (totalDuration + programDuration) * 1000),
                        asset: {
                            name: programs[i].asset._.video.name || programs[i].asset._.name,
                            id: programs[i].asset._._id,
                            category: programCategory,
                            path: programs[i].asset._.file.encode.path,
                            duration: programDuration,
                            startAt: programs[i].asset.start_at,
                            endAt: programs[i].asset.end_at,
                            isAd,
                            thumbnail: programs[i].asset._.thumbnail ? programs[i].asset._.thumbnail.horizontal : null,
                        },
                    });
                    totalDuration += programDuration;
                } else {
                    if (totalDuration < slotConfig.slot_length && programs[i].asset && fillerAssets.length) {
                        let fillDuration = programs[i].asset.end_at - programs[i].asset.start_at;
                        while (fillDuration > 0) {
                            const filler = fillerAssets[Math.floor(Math.random() * fillerAssets.length)];
                            let fillerCategory;
                            if (filler.category) {
                                fillerCategory = filler.category.name.toLowerCase();
                            }
                            let assetEndAt;
                            if (filler.file.length > fillDuration) {
                                assetEndAt = fillDuration;
                            } else {
                                assetEndAt = filler.file.length;
                            }
                            _slot.programs.push({
                                startAt: msStringToDate(Math.floor((slot.start_at).getTime()) + totalDuration * 1000),
                                endAt: msStringToDate(Math.floor((slot.start_at).getTime()) + (totalDuration + assetEndAt) * 1000),
                                asset: {
                                    name: filler.video.name || filler.name,
                                    id: filler._id,
                                    category: fillerCategory,
                                    path: filler.file.encode.path,
                                    duration: assetEndAt,
                                    startAt: 0,
                                    endAt: assetEndAt,
                                    isAd,
                                    thumbnail: filler.thumbnail ? filler.thumbnail.horizontal : null,
                                },
                            });
                            fillDuration -= assetEndAt;
                            totalDuration += programs[i].asset.end_at - programs[i].asset.start_at;
                        }
                    }
                }
            }

            const slotEndAt = new Date(slot.end_at);
            if (slot.overlays && slot.overlays.length) {
                for (let j = 0; j < slot.overlays.length; j++) {
                    const overlay = slot.overlays[j];
                    if (overlay.asset) {
                        const pts = [];
                        pts.push(overlay.start_at);
                        if (overlay && overlay.repeat) {
                            let newPts = new Date(overlay.start_at).getTime();
                            let frequency = overlay.frequency;
                            if (frequency) {
                                while (frequency-- && (newPts + overlay.repeat * 60 * 1000) < slotEndAt.getTime()) {
                                    newPts += overlay.repeat * 60 * 1000;
                                    pts.push(new Date(newPts));
                                }
                            } else {
                                while ((newPts + overlay.repeat * 60 * 1000) < slotEndAt.getTime()) {
                                    newPts += overlay.repeat * 60 * 1000;
                                    pts.push(new Date(newPts));
                                }
                            }
                        }
                        _slot.overlays.push({
                            file: overlay.asset.file.download.path + '/' + overlay.asset.file.name,
                            pts,
                            position: {
                                x: 0,
                                y: 0,
                            },
                        });
                    }
                }
            } else {
                for (let k = 0; k < defaultOverlays.length; k++) {
                    const overlay = defaultOverlays[k];
                    if (overlay.asset) {
                        const pts = [];
                        const overlayStartAt = new Date(slot.start_at).getTime() + (k + 1) * 60 * 1000;
                        pts.push(new Date(overlayStartAt));
                        if (overlay && overlay.repeat) {
                            let newPts = new Date(overlayStartAt).getTime();
                            let frequency = overlay.frequency;
                            if (frequency) {
                                while (frequency-- && (newPts + overlay.repeat * 60 * 1000) < slotEndAt.getTime()) {
                                    newPts += overlay.repeat * 60 * 1000;
                                    pts.push(new Date(newPts));
                                }
                            } else {
                                while ((newPts + overlay.repeat * 60 * 1000) < slotEndAt.getTime()) {
                                    newPts += overlay.repeat * 60 * 1000;
                                    pts.push(new Date(newPts));
                                }
                            }
                        }
                        _slot.overlays.push({
                            file: overlay.asset.file.download.path + '/' + overlay.asset.file.name,
                            pts,
                            position: {
                                x: 0,
                                y: 0,
                            },
                        });
                    }
                }
            }
            while (totalDuration < slotConfig.slot_length && fillerAssets.length) {
                const fillerAsset = fillerAssets[Math.floor(Math.random() * fillerAssets.length)];
                let endAt;
                if (totalDuration + fillerAsset.file.length > slotConfig.slot_length) {
                    endAt = slotConfig.slot_length - totalDuration;
                } else {
                    endAt = fillerAsset.file.length;
                }
                if (slotConfig.slot_length - totalDuration < 1) {
                    break;
                }
                const programStartAt = msStringToDate(Math.floor((slot.start_at).getTime()) + totalDuration * 1000);
                const programEndAt = msStringToDate(Math.floor((slot.start_at).getTime()) + (totalDuration + endAt) * 1000);

                fillers.push({
                    live_stream: slot.live_stream._id || slot.live_stream,
                    slot: slotId,
                    media_space: slot.media_space._id || slot.media_space,
                    start_at: programStartAt,
                    end_at: programEndAt,
                    asset: {
                        _: fillerAsset._id,
                        start_at: 0,
                        end_at: endAt,
                    },
                    type: 'content',
                    is_dynamic: true,
                });

                _slot.programs.push({
                    startAt: programStartAt,
                    endAt: programEndAt,
                    asset: {
                        name: fillerAsset.video.name || fillerAsset.name,
                        id: fillerAsset._id,
                        category: fillerAsset.category.name,
                        path: fillerAsset.file.encode.path,
                        duration: endAt,
                        startAt: 0,
                        endAt,
                        isAd: false,
                        thumbnail: fillerAsset.thumbnail ? fillerAsset.thumbnail.horizontal : null,
                    },
                });
                totalDuration += endAt;
            }
            next(null, _slot, fillers);
        }, (_slot, fillers, next) => {
            if (fillers.length) {
                programDBO.insertMany(fillers, {}, false, (error) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: programError.updateProgramFailed,
                            message: 'Error occurred while updating the programs.',
                        });
                    } else {
                        next(null, _slot);
                    }
                });
            } else {
                next(null, _slot);
            }
        }, (_slot, next) => {
            const url = `http://${ip}:${port}/live-streams/users/${userId}/streams/${liveStreamId}/generate-playlist`;
            const data = {
                date: _slot.startAt,
                slot: _slot,
                username,
            };
            Axios({
                method: 'post',
                url,
                data,
            }).then(() => {
                next(null, _slot);
            }).catch((error) => {
                logger.error(error);
                next({
                    error: slotError.requestRunnerFailed,
                    message: 'Error occurred while requesting the runner.',
                });
            });
        }, (_slot, next) => {
            slotDBO.findOneAndUpdate({
                _id: slotId,
            }, {
                $set: {
                    push_at: new Date(),
                    play_out: _slot.programs,
                },
            }, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.updateSlotFailed,
                        message: 'Error occurred while updating the slot.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            programDBO.updateMany({
                slot: slotId,
            }, {
                $set: {
                    push_at: new Date(),
                },
            }, {}, false, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: programError.updateProgramFailed,
                        message: 'Error occurred while updating the programs.',
                    });
                } else {
                    next(null);
                }
            });
        },
    ], (error) => {
        if (error) {
            logger.error(error.message, error);
            cb(error);
        } else {
            cb(null);
        }
    });
};

const createAndPushSlot = (liveStreamId, cb) => {
    const sortBy = 'start_at';
    const order = 1;
    const timeNow = new Date();
    console.log('timeNow', timeNow);
    const conditions = {
        live_stream: liveStreamId,
    };
    if (timeNow) {
        conditions.$and = [{
            start_at: {
                $lt: timeNow,
            },
        }, {
            end_at: {
                $gt: timeNow,
            },
        }];
    }

    const options = {};
    if (sortBy) {
        options.sort = {
            [sortBy]: order,
        };
    }
    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: liveStreamId,
            }, {
                configuration: 1,
                slot_configuration: 1,
                media_space: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding live stream.',
                    });
                } else if (result) {
                    let slotDuration = 0;
                    if (result.slot_configuration) {
                        slotDuration = result.slot_configuration.slot_length;
                    } else {
                        slotDuration = result.configuration.slot_length;
                    }
                    next(null, result.media_space, slotDuration || 3600);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (mediaSpace, slotDuration, next) => {
            slotDBO.find(conditions, {}, {}, false, (error, result) => {
                console.log('result', result);
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot.',
                    });
                } else if (result && result.length === 1) {
                    next(null, mediaSpace, slotDuration, result[0]);
                } else {
                    next(null, mediaSpace, slotDuration, null);
                }
            });
        }, (mediaSpace, slotDuration, currentSlot, next) => {
            if (currentSlot) {
                if (currentSlot.end_at > timeNow) {
                    next(null, currentSlot);
                } else {
                    const startAt = timeNow;
                    const endAt = msStringToDate(Math.floor(startAt.getTime()) + slotDuration * 1000);
                    console.log(startAt, endAt);
                    const doc = {
                        live_stream: liveStreamId,
                        name: `Slot ${new Date(startAt).getUTCHours()}:${new Date(startAt).getUTCMinutes()}`,
                        start_at: startAt,
                        end_at: endAt,
                        media_space: mediaSpace,
                    };
                    slotDBO.save(doc, false, (error, result) => {
                        if (error) {
                            logger.error(error);
                            next({
                                error: slotError.saveSlotFailed,
                                message: 'Error occurred while saving slot.',
                            });
                        } else {
                            next(null, result);
                        }
                    });
                }
            } else {
                const startAt = timeNow;
                const endAt = msStringToDate(Math.floor(startAt.getTime()) + slotDuration * 1000);
                console.log(startAt, endAt);
                const doc = {
                    live_stream: liveStreamId,
                    name: `Slot ${new Date(startAt).getUTCHours()}:${new Date(startAt).getUTCMinutes()}`,
                    start_at: startAt,
                    end_at: endAt,
                    media_space: mediaSpace,
                };
                slotDBO.save(doc, false, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: slotError.saveSlotFailed,
                            message: 'Error occurred while saving slot.',
                        });
                    } else {
                        next(null, result);
                    }
                });
            }
        }, (slot, next) => {
            if (slot && slot.play_out && slot.play_out.length) {
                shufflePrograms(liveStreamId, slot, (error) => {
                    if (error) {
                        next(error);
                    } else {
                        next(null, slot);
                    }
                });
            } else {
                fillSlotWithPrograms(liveStreamId, slot, (error) => {
                    if (error) {
                        next(error);
                    } else {
                        next(null, slot);
                    }
                });
            }
        }, (slot, next) => {
            pushSlot(slot._id, (error) => {
                if (error) {
                    next(error);
                } else {
                    next(null);
                }
            });
        },
    ], (error) => {
        if (error) {
            console.log(error);
            cb(error);
        } else {
            cb(null);
        }
    });
};

const shufflePrograms = (liveStreamId, slot, cb) => {
    async.waterfall([
        (next) => {
            programDBO.deleteMany({
                slot: slot._id,
                live_stream: liveStreamId,
            }, {}, (error) => {
                if (error) {
                    next({
                        error: programError.deleteProgramFailed,
                        message: 'Error occurred while deleting the programs.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            slotDBO.findOneAndUpdate({
                _id: slot._id,
            }, {
                $set: {
                    play_out: [],
                },
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: slotError.updateSlotFailed,
                        message: 'Error occurred while updating the slot.',
                    });
                } else if (result) {
                    next(null);
                } else {
                    next({
                        error: slotError.slotDoesNotExist,
                        message: 'Slot does not exist.',
                    });
                }
            });
        }, (next) => {
            fillSlotWithPrograms(liveStreamId, slot, (error) => {
                if (error) {
                    next(error);
                } else {
                    next(null);
                }
            });
        },
    ], cb);
};

module.exports = {
    getAd,
    createNextSlot,
    fillSlotWithPrograms,
    deleteSlotsOfMediaSpace,
    pushSlot,
    createAndPushSlot,
};
