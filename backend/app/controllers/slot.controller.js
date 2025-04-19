const Axios = require('axios');
const async = require('async');
const { ASC } = require('../constants');
const { slotDuration } = require('../../config');
const slotDBO = require('../dbos/slot.dbo');
const programDBO = require('../dbos/program.dbo');
const programError = require('../errors/program.error');
const liveStreamDBO = require('../dbos/live_stream.dbo');
const slotConfigDBO = require('../dbos/slot_config.dbo');
const slotConfigError = require('../errors/slot_config.error');
const defaultAdCampaignDBO = require('../dbos/default_ad_campaign.dbo');
const assetDBO = require('../dbos/asset.dbo');
const slotError = require('../errors/slot.error');
const assetError = require('../errors/asset.error');
const liveStreamError = require('../errors/live_stream.error');
const processJSONResponse = require('../utils/response.util');
const { stringToDate, msStringToDate } = require('../utils/date.util');
const { shuffle } = require('../utils/array.util');
const { ip, port } = require('../../config/index').runner;
const { createNextSlot, fillSlotWithPrograms } = require('../helpers/slot.helper');
const logger = require('../../logger');

const getSlots = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
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
        live_stream: id,
        media_space: mediaSpace,
    };
    if (startAt) {
        startAt = msStringToDate(startAt);
        conditions['start_at'] = {
            $gte: startAt,
        };
    }
    if (endAt) {
        endAt = msStringToDate(endAt);
        conditions['end_at'] = {
            $lt: endAt,
        };
    }

    const options = {};
    if (sortBy) {
        options.sort = {
            [sortBy]: order || ASC,
        };
    }

    async.waterfall([
        (next) => {
            slotDBO.find(conditions, {
                __v: 0,
                play_out: 0,
                overlays: 0,
                created_at: 0,
                updated_at: 0,
            }, options, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slots.',
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

const addSlot = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        id,
    } = req.params;
    const {
        name,
        type,
        startAt,
        endAt,
    } = req.body;
    const doc = {
        live_stream: id,
        media_space: mediaSpace,
        start_at: stringToDate(startAt),
        end_at: stringToDate(endAt),
    };

    if (name) {
        doc.name = name;
    }
    if (type) {
        doc.type = type;
    }

    async.waterfall([
        (next) => {
            if (startAt && endAt) {
                if (new Date(startAt) < new Date(endAt) && new Date(endAt) - new Date(startAt) <= 3 * 60 * 60 * 1000 && new Date(endAt) - new Date(startAt) >= 1 * 60 * 60 * 1000) {
                    next(null);
                } else {
                    next({
                        status: 400,
                        error: slotError.invalidTimePeriod,
                        message: 'Invalid time period. Start time must be before end time and duration must be between 1 and 3 hours.',
                    });
                }
            } else {
                next({
                    status: 400,
                    error: slotError.invalidTimePeriod,
                    message: 'Invalid time period. Start time and end time are required.',
                });
            }
        }, (next) => {
            liveStreamDBO.findOne({
                _id: id,
                media_space: mediaSpace,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (result) {
                    next(null);
                } else {
                    next({
                        status: 404,
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (next) => {
            slotDBO.findOne({
                live_stream: id,
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
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot.',
                    });
                } else if (result) {
                    next({
                        status: 400,
                        error: slotError.duplicateTimeSlot,
                        message: 'Duplicate time slot.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            slotDBO.save(doc, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.saveSlotFailed,
                        message: 'Error occurred while saving the slot.',
                    });
                } else {
                    result = result.toObject();
                    delete (result['created_at']);
                    delete (result['updated_at']);
                    delete (result['play_out']);
                    delete (result.overlays);
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

const updateSlot = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        id,
    } = req.params;
    const { name } = req.body;
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
    if (name) {
        set.name = name;
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
                    next(null, startAt || result['start_at'], endAt || result['end_at']);
                } else {
                    next({
                        status: 404,
                        error: slotError.slotDoesNotExist,
                        message: 'Slot does not exist.',
                    });
                }
            });
        }, (_startAt, _endAt, next) => {
            if (new Date(_startAt) < new Date(_endAt) && new Date(_endAt) - new Date(_startAt) <= 3 * 60 * 60 * 1000 && new Date(_endAt) - new Date(_startAt) >= 1 * 60 * 60 * 1000) {
                next(null, _startAt, _endAt);
            } else {
                next({
                    status: 400,
                    error: slotError.invalidTimePeriod,
                    message: 'Invalid time period. Start time must be before end time and duration must be between 1 and 3 hours.',
                });
            }
        }, (_startAt, _endAt, next) => {
            slotDBO.findOne({
                _id: {
                    $ne: id,
                },
                live_stream: liveStreamId,
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
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot.',
                    });
                } else if (result) {
                    next({
                        status: 400,
                        error: slotError.duplicateTimeSlot,
                        message: 'Duplicate time slot.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            slotDBO.findOneAndUpdate({
                _id: id,
                live_stream: liveStreamId,
                media_space: mediaSpace,
            }, {
                $set: set,
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
                    delete (result['created_at']);
                    delete (result['updated_at']);
                    delete (result['play_out']);
                    delete (result.overlays);
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

const deleteSlot = (req, res) => {
    const {
        liveStreamId,
        id,
    } = req.params;
    const {
        media_space: mediaSpace,
    } = req.user;

    async.waterfall([
        (next) => {
            slotDBO.findOneAndDelete({
                _id: id,
                live_stream: liveStreamId,
                media_space: mediaSpace,
            }, {}, false, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.deleteSlotFailed,
                        message: 'Error occurred while deleting the slot.',
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

const pushSlot = (req, res) => {
    const {
        liveStreamId,
        id,
    } = req.params;
    const {
        _id,
        username,
        media_space: mediaSpace,
    } = req.user;

    async.waterfall([
        (next) => {
            slotDBO.findOne({
                _id: id,
                live_stream: liveStreamId,
                media_space: mediaSpace,
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
                live_stream: liveStreamId,
                slot: id,
                media_space: mediaSpace,
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
                } else {
                    next(null, slot, programs, result);
                }
            });
        }, (slot, programs, assets, next) => {
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
                live_stream: liveStreamId,
                media_space: mediaSpace,
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
                    logger.error(error);
                    next({
                        error: slotConfigError.slotConfigDoesNotExist,
                        message: 'slot configuration does not exist.',
                    });
                }
            });
        }, (slotConfig, streamSlotConfig, slot, programs, assets, next) => {
            defaultAdCampaignDBO.find({
                live_stream: liveStreamId,
                type: 'bug',
                media_space: mediaSpace,
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
                    live_stream: liveStreamId,
                    slot: id,
                    media_space: mediaSpace,
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
                programDBO.insertMany(fillers, {}, false, (error, result) => {
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
            const url = `http://${ip}:${port}/live-streams/users/${_id}/streams/${liveStreamId}/generate-playlist`;
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
                _id: id,
                media_space: mediaSpace,
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
                slot: id,
                media_space: mediaSpace,
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
                    next(null, {
                        status: 200,
                    });
                }
            });
        }], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const pushNextSlot = (req, res) => {
    const {
        id,
    } = req.params;
    const { _id, username, media_space: mediaSpace } = req.user;
    const sortBy = 'start_at';
    const order = 1;
    let timeNow = Math.floor((new Date()).getTime());
    const timeSlotEnd = msStringToDate(timeNow + slotDuration * 1000);
    const conditions = {
        live_stream: id,
        media_space: mediaSpace,
    };
    if (timeNow) {
        timeNow = msStringToDate(timeNow);
        conditions.$and = [{
            start_at: { $gte: timeNow },
        }, {
            start_at: { $lte: timeSlotEnd },
        }];
    }

    const options = {};
    if (sortBy) {
        options.sort = {
            [sortBy]: order || ASC,
        };
    }
    async.waterfall([
        (next) => {
            slotDBO.find(conditions, {
                __v: 0,
                created_at: 0,
                updated_at: 0,
            }, options, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slots.',
                    });
                } else if (result && result.length) {
                    next(null, result[0]);
                } else {
                    logger.info('next slot not exist .. creating next slot ..');
                    createNextSlot(id, (error, slot) => {
                        if (error) {
                            logger.error(error);
                            next(error);
                        } else {
                            next(null, slot);
                        }
                    });
                }
            });
        }, (slot, next) => {
            programDBO.find({
                live_stream: id,
                slot: slot._id,
                media_space: mediaSpace,
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
                        error: slotError.findProgramsFailed,
                        message: 'Error occurred while finding the programs.',
                    });
                } else if (result.length) {
                    next(null, slot, result);
                } else {
                    logger.info('Programs are not exist. Auto filling programs ..');
                    fillSlotWithPrograms(id, slot, (error, programs) => {
                        if (error) {
                            logger.error(error);
                            next(error);
                        } else {
                            next(null, slot, programs);
                        }
                    });
                }
            });
        }, (slot, programs, next) => {
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
                } else {
                    next(null, slot, programs, result);
                }
            });
        }, (slot, programs, assets, next) => {
            liveStreamDBO.findOne({
                _id: id,
                media_space: mediaSpace,
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
                    next(null, null, slot, programs, assets);
                }
            });
        }, (streamSlotConfig, slot, programs, assets, next) => {
            slotConfigDBO.findOne({
                name: slot.name,
                live_stream: id,
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
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot configuration.',
                    });
                } else if (result) {
                    next(null, result, streamSlotConfig, slot, programs, assets);
                } else {
                    next(null, null, streamSlotConfig, slot, programs, assets);
                }
            });
        }, (slotConfig, streamSlotConfig, slot, programs, assets, next) => {
            defaultAdCampaignDBO.find({
                live_stream: id,
                type: 'bug',
                media_space: mediaSpace,
            }, {}, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next(null, ip, port, slotConfig, streamSlotConfig, slot, programs, assets, []);
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
            if (slotConfig.fillers && slotConfig.fillers.tags) {
                for (const asset in assets) {
                    if (asset.tags && asset.tags.some(el => slotConfig.filler.tags.includes(el)) && !fillerAssets.includes(asset)) {
                        fillerAssets.push(asset);
                    }
                }
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
                    if (programs[i].asset._.category && programs[i].asset._.category.name) {
                        programCategory = programs[i].asset._.category.name.toLowerCase();
                    }
                    let _name;
                    if (programs[i].asset._.video && programs[i].asset._.video.name) {
                        _name = programs[i].asset._.video.name;
                    } else {
                        _name = programs[i].asset._.name || 'Program';
                    }
                    let _path;
                    if (programs[i].asset._.file && programs[i].asset._.file.encode && programs[i].asset._.file.encode.path) {
                        _path = programs[i].asset._.file.encode.path;
                    } else {
                        break;
                    }
                    _slot.programs.push({
                        startAt: msStringToDate(Math.floor((slot.start_at).getTime()) + totalDuration * 1000),
                        endAt: msStringToDate(Math.floor((slot.start_at).getTime()) + (totalDuration + programDuration) * 1000),
                        asset: {
                            name: _name,
                            id: programs[i].asset._._id,
                            category: programCategory,
                            path: _path,
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
                                    name: filler.video.name,
                                    id: filler._id,
                                    category: filler.category.name,
                                    path: filler.file.encode.path,
                                    duration: filler.file.length,
                                    startAt: 0,
                                    endAt: assetEndAt,
                                    isAd: false,
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
                    live_stream: id,
                    slot: slot._id,
                    media_space: mediaSpace,
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
                        name: fillerAsset.video.name,
                        id: fillerAsset._id,
                        category: fillerAsset.category.name,
                        path: fillerAsset.file.encode.path,
                        duration: fillerAsset.file.length,
                        startAt: 0,
                        endAt,
                        isAd: false,
                        thumbnail: fillerAsset.thumbnail ? fillerAsset.thumbnail.horizontal : null,
                    },
                });
                totalDuration += endAt;
            }
            next(null, slot, _slot, fillers);
        }, (slot, _slot, fillers, next) => {
            if (fillers.length) {
                programDBO.insertMany(fillers, {}, false, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: programError.updateProgramFailed,
                            message: 'Error occurred while updating the programs.',
                        });
                    } else {
                        next(null, slot, _slot);
                    }
                });
            } else {
                next(null, slot, _slot);
            }
        }, (slot, _slot, next) => {
            const url = `http://${ip}:${port}/live-streams/users/${_id}/streams/${id}/generate-playlist`;
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
                next(null, slot, _slot);
            }).catch((error) => {
                logger.error(error);
                next({
                    error: slotError.requestRunnerFailed,
                    message: 'Error occurred while requesting the runner.',
                });
            });
        }, (slot, _slot, next) => {
            slotDBO.findOneAndUpdate({
                _id: slot._id,
                media_space: mediaSpace,
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
                    next(null, slot);
                }
            });
        }, (slot, next) => {
            programDBO.updateMany({
                slot: slot._id,
                media_space: mediaSpace,
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

const getSlotOverlays = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        id,
    } = req.params;

    async.waterfall([
        (next) => {
            slotDBO.findOne({
                _id: id,
                live_stream: liveStreamId,
                media_space: mediaSpace,
            }, {
                overlays: 1,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot overlays.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result,
                    });
                } else {
                    logger.error(error);
                    next({
                        error: slotError.slotDoesNotExist,
                        message: 'slot overlays does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addSlotOverlay = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        id,
    } = req.params;
    const {
        startAt,
        endAt,
        asset,
        repeat,
        frequency,
        position,
    } = req.body;
    const doc = {
        start_at: stringToDate(startAt),
        end_at: stringToDate(endAt),
        asset: asset,
    };

    if (repeat) {
        doc.repeat = repeat;
    }
    if (frequency) {
        doc.frequency = frequency;
    }
    if (position) {
        doc.position = position;
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
            if (startAt < endAt &&
                (startAt >= _startAt && startAt <= _endAt) &&
                (endAt >= _startAt && endAt <= _endAt)) {
                next(null);
            } else {
                next({
                    status: 400,
                    error: slotError.invalidTimePeriod,
                    message: 'Invalid time period.',
                });
            }
        }, (next) => {
            slotDBO.findOneAndUpdate({
                _id: id,
                live_stream: liveStreamId,
                media_space: mediaSpace,
            }, {
                $addToSet: {
                    overlays: doc,
                },
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.updateProgramFailed,
                        message: 'Error occurred while updating the slot.',
                    });
                } else {
                    delete (result['created_at']);
                    delete (result['updated_at']);
                    delete (result.__v);
                    delete (result['play_out']);

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

const updateSlotOverlay = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        slotId,
        id,
    } = req.params;
    const { asset } = req.body;
    let {
        startAt,
        endAt,
        repeat,
        frequency,
        position,
    } = req.body;

    const set = {};
    if (asset) {
        set['overlays.$.asset'] = asset;
    }
    if (startAt) {
        startAt = stringToDate(startAt);
        set['overlays.$.start_at'] = startAt;
    }
    if (endAt) {
        endAt = stringToDate(endAt);
        set['overlays.$.end_at'] = endAt;
    }
    if (repeat) {
        set['overlays.$.repeat'] = repeat;
    }
    if (frequency) {
        set['overlays.$.frequency'] = frequency;
    }
    if (position) {
        set['overlays.$.position'] = position;
    }

    async.waterfall([
        (next) => {
            slotDBO.findOne({
                _id: slotId,
                live_stream: liveStreamId,
                'overlays._id': id,
                media_space: mediaSpace,
            }, {
                start_at: 1,
                end_at: 1,
                'overlays.$': 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: slotError.findSlotFailed,
                        message: 'Error occurred while finding the slot.',
                    });
                } else if (result) {
                    next(null, result.start_at, result.end_at,
                        startAt || result.overlays[0]['start_at'], endAt || result.overlays[0]['end_at']);
                } else {
                    next({
                        status: 404,
                        error: slotError.slotDoesNotExist,
                        message: 'Slot does not exist.',
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
                    error: slotError.invalidTimePeriod,
                    message: 'Invalid time period.',
                });
            }
        }, (next) => {
            slotDBO.findOneAndUpdate({
                _id: slotId,
                live_stream: liveStreamId,
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
                        error: slotError.updateSlotFailed,
                        message: 'Error occurred while updating the slot.',
                    });
                } else {
                    delete (result['created_at']);
                    delete (result['updated_at']);
                    delete (result.__v);
                    delete (result['play_out']);

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

const deleteSlotOverlay = (req, res) => {
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
            slotDBO.findOneAndUpdate({
                _id: slotId,
                live_stream: liveStreamId,
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
                        error: slotError.deleteSlotFailed,
                        message: 'Error occurred while deleting the slot overlay.',
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

const addSlotDynamicOverlay = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
        id,
    } = req.params;
    let {
        asset,
        repeat,
        frequency,
        position,
    } = req.body;
    const doc = {
        asset: asset,
    };

    if (position) {
        doc.position = position;
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
            assetDBO.findOne({
                _id: asset,
                media_space: mediaSpace,
            }, {
                'file.length': 1,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the asset.',
                    });
                } else if (result && result.file && result.file.length) {
                    next(null, _startAt, _endAt, result.file.length);
                } else {
                    next({
                        status: 404,
                        error: assetError.assetDoesNotExist,
                        message: 'Asset does not exist.',
                    });
                }
            });
        }, (_startAt, _endAt, overlayLength, next) => {
            let startAt = _startAt;
            let endAt = new Date(Math.floor(startAt.getTime()) + (1000 * overlayLength));
            doc.start_at = startAt.toISOString();
            doc.end_at = endAt.toISOString();
            while (frequency-- && endAt <= _endAt) {
                slotDBO.findOneAndUpdate({
                    _id: id,
                    live_stream: liveStreamId,
                    media_space: mediaSpace,
                }, {
                    $addToSet: {
                        overlays: doc,
                    },
                }, {
                    new: true,
                }, false, (error, _) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: slotError.updateProgramFailed,
                            message: 'Error occurred while updating the slot.',
                        });
                    }
                });
                startAt = new Date(Math.floor(startAt.getTime()) + (1000 * repeat * 60));
                endAt = new Date(Math.floor(startAt.getTime()) + (1000 * overlayLength));
            }
            next(null, {
                status: 201,
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

module.exports = {
    getSlots,
    addSlot,
    updateSlot,
    deleteSlot,
    pushSlot,
    pushNextSlot,

    getSlotOverlays,
    addSlotOverlay,
    updateSlotOverlay,
    deleteSlotOverlay,

    addSlotDynamicOverlay,
};
