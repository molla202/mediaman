const async = require('async');
const Axios = require('axios');
const os = require('os');
const childProcess = require('child_process');
const CronJob = require('cron').CronJob;
const assetDBO = require('../dbos/asset.dbo');
const assetError = require('../errors/asset.error');
const mediaSpaceDBO = require('../dbos/media_space.dbo');
const mediaSpaceError = require('../errors/media_space.error');
const liveStreamDBO = require('../dbos/live_stream.dbo');
const liveStreamError = require('../errors/live_stream.error');
const userDBO = require('../dbos/user.dbo');
const userError = require('../errors/user.error');
const adCampaignHelper = require('../helpers/ad_campaign.helper');
const assetHelper = require('../helpers/asset.helper');
const configHelper = require('../helpers/config.helper');
const liveStreamHelper = require('../helpers/live_stream.helper');
const programHelper = require('../helpers/program.helper');
const slotHelper = require('../helpers/slot.helper');
const stringUtils = require('../utils/string.util');
const processJSONResponse = require('../utils/response.util');
const config = require('../../config');
const logger = require('../../logger');
const {
    DEFAULT_LIMIT,
    DEFAULT_SKIP,
} = require('../constants');

const getMediaSpaces = async (req, res) => {
    const {
        sortBy,
    } = req.query;
    let {
        skip,
        limit,
        order,
    } = req.query;

    skip = typeof skip === 'undefined' ? DEFAULT_SKIP : parseInt(skip);
    limit = typeof limit === 'undefined' ? DEFAULT_LIMIT * DEFAULT_LIMIT : parseInt(limit);
    order = typeof order === 'undefined' ? 'desc' : order;

    async.waterfall([
        (next) => {
            mediaSpaceDBO.find({}, {}, {
                skip,
                limit,
                sort: {
                    [sortBy]: order,
                },
            }, false, (error, mediaSpaces) => {
                if (error) {
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occured while fetching media spaces.',
                    });
                } else if (mediaSpaces && mediaSpaces.length > 0) {
                    next(null, mediaSpaces);
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'There are no media spaces available.',
                    });
                }
            });
        }, (mediaSpaces, next) => {
            mediaSpaceDBO.count({}, (error, count) => {
                if (error) {
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occured while fetching media spaces.',
                    });
                } else if (count) {
                    next(null, mediaSpaces, count);
                } else {
                    next(null, mediaSpaces, 0);
                }
            });
        }, (mediaSpaces, count, next) => {
            const totalCores = os.cpus().length - 2;
            const totalMemory = (os.totalmem() / (1024 ** 2)).toFixed(2);

            const availableMediaSpaceCores = totalCores - (count * config.mediaSpace.coreLimit);
            const availableMediaSpaceMemory = totalMemory - (count * config.mediaSpace.memoryLimitInMB);

            let slotsAvailable = 0;

            if (availableMediaSpaceCores / config.mediaSpace.coreLimit > availableMediaSpaceMemory / config.mediaSpace.memoryLimitInMB) {
                slotsAvailable = Math.floor(availableMediaSpaceCores / config.mediaSpace.coreLimit);
            } else {
                slotsAvailable = Math.floor(availableMediaSpaceMemory / config.mediaSpace.memoryLimitInMB);
            }

            if (slotsAvailable < 0) {
                slotsAvailable = 0;
            }

            next(null, {
                status: 200,
                result: {
                    list: mediaSpaces,
                    count,
                    slotsAvailable,
                },
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addMediaNodeUser = (req, res) => {
    const {
        bcAccountAddress,
        id,
    } = req.body;

    async.waterfall([
        (next) => {
            mediaSpaceDBO.find({}, {}, {
                created_at: 1,
            }, false, (error, result) => {
                if (error) {
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occured while finding media space.',
                    });
                } else if (result && result.length) {
                    next(null, result[0]);
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'Media space does not exist.',
                    });
                }
            });
        }, (mediaSpace, next) => {
            if (id && config.mediaSpace.id === id) {
                const url = `${config.flixnet.apiAddress}/omniflix/medianode/v1beta1/lease/${id}`;
                Axios({
                    method: 'GET',
                    url,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }).then((response) => {
                    next(null, mediaSpace, response.data);
                }).catch((error) => {
                    logger.error(`Error fetching data from OmniFlix network API: ${error}`);
                    next({
                        error: mediaSpaceError.failedToFetchData,
                        message: 'Failed to fetch data from OmniFlix network API.',
                    });
                });
            } else {
                next({
                    error: mediaSpaceError.mediaSpaceDoesNotExist,
                    message: 'Invalid media space id.',
                });
            }
        }, (mediaSpace, data, next) => {
            if (data.lease && data.lease.status === 'LEASE_STATUS_ACTIVE' && data.lease.expiry > Date.now() && data.lease.leasee === bcAccountAddress && data.lease.media_node_id === id) {
                next(null, mediaSpace, data.lease);
            } else {
                next({
                    error: mediaSpaceError.mediaSpaceDoesNotExist,
                    message: 'Invalid media space id or lease is expired.',
                });
            }
        }, (mediaSpace, lease, next) => {
            const otp = stringUtils.generateOTP(6);
            const authToken = `${bcAccountAddress.slice(-6)}${otp}`;
            const doc = {
                bc_account_address: bcAccountAddress,
                permissions: ['studio', 'runner', 'ipfs', 'streamer'],
                auth_token: authToken,
                fpc_enabled: true,
                is_admin: true,
                media_space_id: mediaSpace._id,
            };
            userDBO.findOneAndUpdate({
                bc_account_address: bcAccountAddress,
            }, doc, {
                new: true,
                upsert: true,
            }, false, (error, user) => {
                if (error) {
                    next({
                        error: userError.updateUserFailed,
                        message: 'Error occurred while finding or updating the user.',
                    });
                } else if (user) {
                    next(null, mediaSpace, lease, user);
                } else {
                    next({
                        error: userError.updateUserFailed,
                        message: 'Not able to update or create user.',
                    });
                }
            });
        }, (mediaSpace, lease, user, next) => {
            const updates = {
                lease: {
                    leasee: user._id,
                    start_time: lease.start_time,
                    expiry: lease.expiry,
                    status: lease.status,
                    leased_days: lease.leased_days,
                    last_settled_at: lease.last_settled_at,
                },
            };
            mediaSpaceDBO.findOneAndUpdate({
                _id: mediaSpace._id,
            }, updates, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    next({
                        error: mediaSpaceError.updateMediaSpaceFailed,
                        message: 'Error occurred while updating the media space.',
                    });
                } else if (result) {
                    next(null, user, result);
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'Media space does not exist.',
                    });
                }
            });
        }, (user, mediaSpace, next) => {
            liveStreamDBO.findOne({
                media_space: mediaSpace._id,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (result) {
                    next(null, user, mediaSpace, result);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (user, mediaSpace, liveStream, next) => {
            const updates = {};
            if (liveStream) {
                updates['configuration.fpc_config.stream_key'] = `${stringUtils.randomString(10)}`;
                updates['configuration.live_feed_config.stream_key'] = `${stringUtils.randomString(10)}`;
            } else {
                updates.name = 'Initial Live Stream';
                updates.media_space = mediaSpace._id;
                updates.created_by = user._id;
                updates.configuration = {
                    fpc_config: {
                        stream_url: `rtmp://localhost:1935/${mediaSpace.id}/live`,
                        stream_key: `${stringUtils.randomString(10)}`,
                    },
                    live_feed_config: {
                        stream_url: `rtmp://${config.server.ip}:1936/${mediaSpace.id}/live_feed`,
                        stream_key: `${stringUtils.randomString(10)}`,
                    },
                };
            }
            liveStreamDBO.findOneAndUpdate({
                media_space: mediaSpace._id,
            }, updates, {
                new: true,
                upsert: true,
            }, false, (error, result) => {
                if (error) {
                    next({
                        error: mediaSpaceError.updateMediaSpaceFailed,
                        message: 'Error occurred while updating or creating the live stream.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result: {
                            auth_token: user.auth_token,
                        },
                    });
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'Media space does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateMediaSpace = (req, res) => {
    const {
        media_space: mediaSpaceId,
    } = req.user;

    const {
        enableBroadcast,
    } = req.body;

    async.waterfall([
        (next) => {
            mediaSpaceDBO.findOne({
                _id: mediaSpaceId._id || mediaSpaceId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occurred while finding the media space.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'Media space does not exist.',
                    });
                }
            });
        }, (mediaSpace, next) => {
            mediaSpaceDBO.findOneAndUpdate({
                _id: mediaSpace._id,
            }, {
                $set: {
                    'configuration.broadcast_enabled': enableBroadcast,
                },
            }, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    next({
                        error: mediaSpaceError.updateMediaSpaceFailed,
                        message: 'Error occurred while updating the media space.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'Media space does not exist.',
                    });
                }
            });
        }, (mediaSpace, next) => {
            liveStreamDBO.updateMany({
                media_space: mediaSpace._id,
            }, {
                $set: {
                    'configuration.broadcast_enabled': enableBroadcast,
                },
            }, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result: {
                            message: 'Media space updated successfully.',
                        },
                    });
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};
const updateLeases = (existingUser, cb) => {
    async.waterfall([
        (next) => {
            const url = `${config.flixnet.apiAddress}/omniflix/medianode/v1beta1/lease/${config.mediaSpace.id}`;
            Axios({
                method: 'GET',
                url,
                headers: {
                    'Content-Type': 'application/json',
                },
            }, {
                'axios-retry': {
                    retries: 2,
                    retryDelay: (retryCount) => {
                        return retryCount * 1000;
                    },
                },
            }).then((response) => {
                if (response && response.data && response.data.lease) {
                    next(null, response.data.lease);
                } else {
                    next({
                        error: mediaSpaceError.failedToFetchData,
                        message: 'Invalid lease data.',
                    });
                }
            }).catch((error) => {
                logger.error(`Error fetching data from OmniFlix network API: ${error}`);
                if (error && error.response && error.response.data && error.response.data.code === 5) {
                    next(null, null);
                } else {
                    next({
                        error: mediaSpaceError.failedToFetchData,
                        message: 'Failed to fetch data from OmniFlix network API.',
                    });
                }
            });
        }, (lease, next) => {
            if (!lease) {
                next(null, null, null);
            } else {
                userDBO.findOne({
                    bc_account_address: lease.lessee,
                }, {}, {}, false, (error, user) => {
                    if (error) {
                        next({
                            error: userError.findUserFailed,
                            message: 'Error occurred while finding the user.',
                        });
                    } else if (user) {
                        next(null, lease, user);
                    } else {
                        if (existingUser) {
                            next(null, lease, null);
                        } else {
                            next({
                                error: userError.userDoesNotExist,
                                message: 'User does not exist.',
                            });
                        }
                    }
                });
            }
        }, (lease, user, next) => {
            if (!lease || !user) {
                mediaSpaceDBO.findOneAndUpdate({}, {
                    $unset: {
                        lease: '',
                    },
                }, {
                    new: true,
                }, false, (error, mediaSpace) => {
                    if (error) {
                        next({
                            error: mediaSpaceError.updateMediaSpaceFailed,
                            message: 'Error occurred while updating the media space.',
                        });
                    } else if (mediaSpace) {
                        next(null, mediaSpace, user);
                    } else {
                        next({
                            error: mediaSpaceError.mediaSpaceDoesNotExist,
                            message: 'Media space does not exist.',
                        });
                    }
                });
            } else {
                const expiry = new Date(lease.start_time).getTime() + (parseInt(lease.leased_hours) * 60 * 60 * 1000);
                const updates = {
                    'lease.expiry': lease.expiry,
                    'lease.status': lease.status,
                    'lease.last_settled_at': lease.last_settled_at,
                    'lease.leased_hours': lease.leased_hours,
                    'lease.start_time': lease.start_time,
                };
                if (expiry > Date.now()) {
                    updates['lease.expiry'] = expiry;
                    updates['lease.status'] = 'LEASE_STATUS_ACTIVE';
                } else {
                    updates['lease.expiry'] = expiry;
                    updates['lease.status'] = 'LEASE_STATUS_EXPIRED';
                }
                mediaSpaceDBO.findOneAndUpdate({
                    'lease.lessee': user._id,
                }, updates, {
                    new: true,
                }, false, (error, result) => {
                    if (error) {
                        next({
                            error: mediaSpaceError.updateMediaSpaceFailed,
                            message: 'Error occurred while updating the media space.',
                        });
                    } else if (result) {
                        next(null, result, user);
                    } else {
                        next({
                            error: mediaSpaceError.mediaSpaceDoesNotExist,
                            message: 'Media space does not exist.',
                        });
                    }
                });
            }
        }, (mediaSpace, user, next) => {
            if ((mediaSpace.lease && mediaSpace.lease.status === 'LEASE_STATUS_EXPIRED') || !mediaSpace.lease) {
                next(null, mediaSpace, user);
            } else {
                next({
                    error: mediaSpaceError.mediaSpaceIsActive,
                    message: 'Media space is active.',
                });
            }
        }, (mediaSpace, user, next) => {
            userDBO.deleteMany({
                media_space: mediaSpace._id,
            }, {}, (error, result) => {
                if (error) {
                    next({
                        error: userError.deleteUserFailed,
                        message: 'Error occurred while deleting the user.',
                    });
                } else if (result) {
                    next(null, mediaSpace, user);
                } else {
                    next({
                        error: userError.deleteUserFailed,
                        message: 'Error occurred while deleting the user.',
                    });
                }
            });
        }, (mediaSpace, user, next) => {
            if (user) {
                liveStreamHelper.stopLiveStreams(mediaSpace, user, (error) => {
                    if (error) {
                        next(error);
                    } else {
                        next(null, mediaSpace, user);
                    }
                });
            } else {
                childProcess.exec(`supervisorctl stop streamer-${mediaSpace.username}`, (error, stdout, stderr) => {
                    if (error) {
                        logger.error(error.message);
                    }
                    if (stderr) {
                        logger.error('stderr', stderr);
                    }
                    next(null, mediaSpace, user);
                });
            }
        }, (mediaSpace, user, next) => {
            if (user) {
                const fpcKey = stringUtils.randomString(10);
                const liveFeedKey = stringUtils.randomString(10);
                configHelper.updateStreamKeys(config.streamer.stream_keys_path, mediaSpace.username, mediaSpace.id, fpcKey, liveFeedKey, (error) => {
                    if (error) {
                        next(error);
                    } else {
                        next(null, mediaSpace);
                    }
                });
            } else {
                next(null, mediaSpace);
            }
        }, (mediaSpace, next) => {
            liveStreamDBO.deleteMany({
                media_space: mediaSpace._id,
            }, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while deleting the live stream.',
                    });
                } else if (result) {
                    next(null, mediaSpace);
                } else {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while deleting the live stream.',
                    });
                }
            });
        }, (mediaSpace, next) => {
            assetDBO.find({
                media_space: mediaSpace._id,
                is_default_asset: false,
            }, {}, {}, false, (error, assets) => {
                if (error) {
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding the assets.',
                    });
                } else if (assets && assets.length) {
                    next(null, mediaSpace, assets);
                } else {
                    next(null, mediaSpace, []);
                }
            });
        }, (mediaSpace, assets, next) => {
            async.forEachLimit(assets, 1, (asset, _next) => {
                assetHelper.deleteAsset(asset, (error) => {
                    if (error) {
                        _next({
                            error: assetError.deleteAssetFailed,
                            message: 'Error occurred while deleting the asset.',
                        });
                    } else {
                        _next(null);
                    }
                });
            }, (error) => {
                if (error) {
                    next({
                        error: assetError.deleteAssetFailed,
                        message: 'Error occurred while deleting the assets.',
                    });
                } else {
                    next(null, mediaSpace);
                }
            });
        }, (mediaSpace, next) => {
            assetDBO.deleteMany({
                is_default_asset: true,
            }, {}, (error) => {
                if (error) {
                    next({
                        error: assetError.deleteAssetFailed,
                        message: 'Error occurred while deleting the assets.',
                    });
                } else {
                    next(null, mediaSpace);
                }
            });
        }, (mediaSpace, next) => {
            assetHelper.deleteAssetCategoryAndDistribution(mediaSpace, (error) => {
                if (error) {
                    next(error);
                } else {
                    next(null, mediaSpace);
                }
            });
        }, (mediaSpace, next) => {
            slotHelper.deleteSlotsOfMediaSpace(mediaSpace, (error) => {
                if (error) {
                    next(error);
                } else {
                    next(null, mediaSpace);
                }
            });
        }, (mediaSpace, next) => {
            programHelper.deleteProgramsOfMediaSpace(mediaSpace, (error) => {
                if (error) {
                    next(error);
                } else {
                    next(null, mediaSpace);
                }
            });
        }, (mediaSpace, next) => {
            adCampaignHelper.deleteAdCampaignsOfMediaSpace(mediaSpace, (error) => {
                if (error) {
                    next(error);
                } else {
                    next(null, mediaSpace);
                }
            });
        },
    ], (error) => {
        if (error) {
            cb(error);
        } else {
            cb();
        }
    });
};

const updateMediaSpaceLeases = () => {
    console.log('Updating leases', config.mediaSpace.forLease);
    if (config.mediaSpace.forLease === 'true') {
        logger.info('Updating leases for media space job started');
        const job = new CronJob('*/10 * * * * *', () => {
            updateLeases(false,(error) => {
                if (error) {
                    logger.error(error.message);
                }
            });
        });
        job.start();
    }
};

updateMediaSpaceLeases();

module.exports = {
    getMediaSpaces,
    addMediaNodeUser,
    updateMediaSpace,
    updateLeases,
};
