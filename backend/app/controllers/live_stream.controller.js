const async = require('async');
const Axios = require('axios');
const childProcess = require('child_process');
const CronJob = require('cron').CronJob;
const ws = require('ws');
const {
    DESC,
    DEFAULT_SKIP,
    DEFAULT_LIMIT,
    VIDEO_LINK_EXPIRE_MINUTES,
} = require('../constants');
const { md5 } = require('../../config');
const usersDBO = require('../dbos/user.dbo');
const userErrors = require('../errors/user.error');
const liveStreamDBO = require('../dbos/live_stream.dbo');
const liveStreamError = require('../errors/live_stream.error');
const mediaSpaceDBO = require('../dbos/media_space.dbo');
const mediaSpaceError = require('../errors/media_space.error');
const manageMsErrors = require('../errors/manage_ms.error');
const configHelper = require('../helpers/config.helper');
const liveStreamHelper = require('../helpers/live_stream.helper');
const slotHelper = require('../helpers/slot.helper');
const processJSONResponse = require('../utils/response.util');
const { generateSecurePathHash } = require('../utils/auth.util');
const config = require('../../config');
const stringUtils = require('../utils/string.util');
const { ip, port, publicAddress } = config.runner;
const logger = require('../../logger');

const wsServer = new ws.Server({ port: config.ws.port });
const connectedClients = new Map();

wsServer.on('connection', (ws) => {
    let data;
    ws.on('message', (message) => {
        try {
            data = JSON.parse(message);
            console.log(data);
        } catch (error) {
            console.error('Error parsing message:', error);
            return;
        }

        if (data && data.bcAccountAddress !== undefined && data.liveStream !== undefined && data.mediaSpace !== undefined) {
            connectedClients.set(data.bcAccountAddress, {
                ws: ws,
                liveStream: data.liveStream,
                mediaSpace: data.mediaSpace,
            });
        }
    });

    ws.on('close', () => {
        if (data && data.bcAccountAddress !== undefined) {
            connectedClients.delete(data.bcAccountAddress);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

wsServer.on('error', (error) => {
    console.error('WebSocket server error:', error);
});

const getLiveStreams = (req, res) => {
    const user = req.user;
    const {
        status,
        sortBy,
        liveFeed,
    } = req.query;
    let {
        total,
        skip,
        limit,
        order,
    } = req.query;

    total = total ? total.toLowerCase() === 'true' : false;
    skip = typeof skip === 'undefined' ? DEFAULT_SKIP : parseInt(skip);
    limit = typeof limit === 'undefined' ? DEFAULT_LIMIT * DEFAULT_LIMIT : parseInt(limit);

    async.waterfall([
        (next) => {
            const conditions = {
                media_space: user.media_space,
            };
            if (status) {
                conditions.status = status;
            }
            if (liveFeed !== undefined) {
                if (liveFeed === 'true') {
                    conditions.playing_live_feed = true;
                } else if (liveFeed === 'false') {
                    conditions.playing_live_feed = false;
                }
            }
            const options = {};
            if (sortBy) {
                order = order || DESC;

                if (sortBy === 'current_views') {
                    options.sort = {
                        'views.current': order,
                    };
                } else {
                    options.sort = {
                        [sortBy]: order,
                    };
                }
            }
            if (!total) {
                options.skip = skip;
                options.limit = limit;
            }

            liveStreamDBO.find(conditions, {
                created_by: 1,
                previews: 1,
                name: 1,
                image_url: 1,
                default: 1,
                configuration: 1,
                status: 1,
                views: 1,
                playing_live_feed: 1,
            }, options, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamsFailed,
                        message: 'Error occurred while finding the live streams.',
                    });
                } else {
                    next(null, conditions, result);
                }
            });
        }, (conditions, liveStreams, next) => {
            if (!total) {
                liveStreamDBO.count(conditions, (error, count) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: liveStreamError.countLiveStreamsFailed,
                            message: 'Error occurred while finding the live streams count.',
                        });
                    } else {
                        next(null, {
                            status: 200,
                            result: {
                                list: liveStreams,
                                total: count,
                            },
                        });
                    }
                });
            } else {
                next(null, {
                    status: 200,
                    result: {
                        list: liveStreams,
                    },
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateLiveStream = (req, res) => {
    const user = req.user;
    const {
        id,
    } = req.params;
    const {
        _default,
        streamQuality,
        status,
        streamTimeZone,
        streamDestinations,
        inStreamConfig,
        revokeBroadcastStreamKeys,
        revokeLiveStreamKeys,
        autoFillEnabled,
        fillerCategories,
        fillerTags,
        contentConfigCategories,
        contentConfigTags,
        imageURL,
        name,
        description,
    } = req.body;

    const set = {};
    if (typeof _default !== 'undefined') {
        set.default = _default;
    }
    if (streamQuality) {
        set['configuration.stream_quality'] = streamQuality;
    }
    if (status) {
        set.status = status;
    }
    if (streamQuality) {
        set['configuration.stream_quality'] = streamQuality;
    }
    if (streamTimeZone) {
        set['configuration.stream_timezone'] = streamTimeZone;
    }
    if (streamDestinations) {
        set['configuration.stream_destinations'] = streamDestinations;
    }
    if (inStreamConfig) {
        if (inStreamConfig.adsEnabled !== undefined) {
            set['configuration.in_stream_config.ads_enabled'] = inStreamConfig.adsEnabled;
        }
        if (inStreamConfig.logoEnabled !== undefined) {
            set['configuration.in_stream_config.logo_enabled'] = inStreamConfig.logoEnabled;
        }
        if (inStreamConfig.watermarkEnabled !== undefined) {
            set['configuration.in_stream_config.watermark_enabled'] = inStreamConfig.watermarkEnabled;
        }
        if (inStreamConfig.textScrollEnabled !== undefined) {
            set['configuration.in_stream_config.text_scroll_enabled'] = inStreamConfig.textScrollEnabled;
        }
        if (inStreamConfig.streamLogoEnabled !== undefined) {
            set['configuration.in_stream_config.stream_logo_enabled'] = inStreamConfig.streamLogoEnabled;
        }
        if (inStreamConfig.showTimeCode !== undefined) {
            set['configuration.in_stream_config.show_time_code'] = inStreamConfig.showTimeCode;
        }
    }
    if (autoFillEnabled !== undefined) {
        set['slot_configuration.content_auto_fill_enabled'] = autoFillEnabled;
    }
    if (fillerCategories) {
        set['slot_configuration.fillers.categories'] = fillerCategories;
    }
    if (fillerTags) {
        set['slot_configuration.fillers.tags'] = fillerTags;
    }
    if (contentConfigCategories) {
        set['slot_configuration.content_config.categories'] = contentConfigCategories;
    }
    if (contentConfigTags) {
        set['slot_configuration.content_config.tags'] = contentConfigTags;
    }
    if (revokeBroadcastStreamKeys) {
        set['configuration.broadcast_config.stream_key'] = stringUtils.randomString(10);
    }
    if (revokeLiveStreamKeys) {
        set['configuration.live_feed_config.stream_key'] = stringUtils.randomString(10);
    }
    if (imageURL) {
        set.image_url = imageURL;
    }
    if (name) {
        set.name = name;
    }
    if (description) {
        set.description = description;
    }

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: id,
                media_space: user.media_space,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (result) {
                    next(null);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: id,
                media_space: user.media_space,
            }, {
                $set: set,
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (result) {
                    result.username = result.media_space.username;
                    if (result.username === 'main') {
                        result.username = 'ubuntu';
                    }
                    next(null, result);
                } else {
                    next(null, {
                        status: 404,
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (streamDetails, next) => {
            try {
                const { rtmpPath, rtmpConfigDetails, nginxConfigDetails } = configHelper.configureRTMPandNGINXSettings(streamDetails);
                configHelper.rtmpConfig(rtmpPath, rtmpConfigDetails, streamDetails.configuration.broadcast_enabled, (error) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: liveStreamError.createRtmpFileFailed,
                            message: 'Error occurred while creating rtmp config.',
                            info: error,
                        });
                    } else {
                        next(null, streamDetails, nginxConfigDetails);
                    }
                });
            } catch (error) {
                next({
                    error: liveStreamError.updateLiveStreamFailed,
                    message: 'Error occurred while updating the live stream.',
                    info: error,
                });
            }
        }, (streamDetails, nginxConfigDetails, next) => {
            configHelper.nginxConfig(config.nginx.path, nginxConfigDetails, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.createNginxFileFailed,
                        message: 'Error occurred while creating nginx config.',
                    });
                } else {
                    next(null, streamDetails);
                }
            });
        }, (streamDetails, next) => {
            configHelper.updateStreamKeys(config.streamer.stream_keys_path, streamDetails.media_space.username, streamDetails.media_space.id, streamDetails.configuration.broadcast_config.stream_key, streamDetails.configuration.live_feed_config.stream_key, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.updateStreamKeysFailed,
                        message: 'Error occurred while updating the stream keys.',
                    });
                } else {
                    next(null, streamDetails);
                }
            });
        }, (streamDetails, next) => {
            childProcess.exec('nginx -s reload', (err, stdout, stderr) => {
                if (err) {
                    next({
                        error: manageMsErrors.reloadFailed,
                        message: 'Error occurred while reloading NGINX',
                        info: `${err.message}`,
                    });
                } else if (stderr) {
                    next({
                        error: manageMsErrors.reloadFailed,
                        message: 'Error occurred while reloading NGINX',
                        info: `${stderr}`,
                    });
                } else {
                    next(null, {
                        status: 200,
                        result: streamDetails,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addLiveStream = (req, res) => {
    const user = req.user;
    const {
        name,
        imageURL,
        description,
    } = req.body;

    async.waterfall([
        (next) => {
            mediaSpaceDBO.findOne({
                _id: user.media_space,
            }, {
                username: 1,
            }, {}, true, (error, mediaSpace) => {
                if (error) {
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occurred while finding the media space.',
                    });
                } else if (mediaSpace) {
                    next(null, mediaSpace);
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'Media space does not exist.',
                    });
                }
            });
        }, (mediaSpace, next) => {
            const doc = {
                name,
                created_by: user._id,
                configuration: {
                    broadcast_config: {
                        stream_url: `rtmp://localhost:1935/${mediaSpace.id}/broadcast`,
                        stream_key: stringUtils.randomString(10),
                    },
                    live_feed_config: {
                        stream_url: `rtmp://${config.server.ip}:${config.nginx.rtmpPort}/${mediaSpace.id}/live_feed`,
                        stream_key: stringUtils.randomString(10),
                    },
                    broadcast_enabled: mediaSpace.broadcast_enabled,
                },
                media_space: mediaSpace._id,
                username: mediaSpace.username,
            };
            if (imageURL) {
                doc.image_url = imageURL;
            }
            if (description) {
                doc.description = description;
            }

            liveStreamDBO.save(doc,
                true, (error, result) => {
                    if (error) {
                        logger.error(error);
                        console.log(error);
                        next({
                            error: liveStreamError.createLiveStreamBroadcastFailed,
                            message: 'Error occurred while creating live stream.',
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

const addLiveStreamDestination = (req, res) => {
    const {
        id,
    } = req.params;

    const {
        name,
        url,
        key,
        streamId,
        tvType,
        username,
    } = req.body;

    const set = {
        name,
        key,
    };
    if (username) {
        set.username = username;
    }

    async.waterfall([
        (next) => {
            if (name === 'OmniFlixTV') {
                if (!streamId) {
                    next({
                        error: liveStreamError.omniflixTvStreamIdRequired,
                        message: 'For type OmniFlixTV, stream_id is required.',
                    });
                } else {
                    set.stream_id = streamId;
                    if (tvType) {
                        set.tv_type = tvType;
                    }
                    next(null);
                }
            } else {
                if (!url) {
                    next({
                        error: liveStreamError.urlRequired,
                        message: 'For type other than OmniFlixTV, url is required.',
                    });
                } else {
                    set.url = url;
                    next(null);
                }
            }
        }, (next) => {
            liveStreamDBO.findOne({
                _id: id,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (liveStream, next) => {
            const streamDestinations = liveStream.configuration.stream_destinations || [];
            if (name === 'OmniFlixTV') {
                const isAlreadyAdded = streamDestinations.some(destination => destination.name === name && destination.stream_id === streamId && destination.key === key);
                if (isAlreadyAdded) {
                    next({
                        error: liveStreamError.destinationAlreadyExists,
                        message: 'Destination already exists. Please update the destination instead.',
                    });
                } else {
                    next(null);
                }
            } else {
                const isAlreadyAdded = streamDestinations.some(destination => destination.name === name && destination.url === url && destination.key === key);
                if (isAlreadyAdded) {
                    next({
                        error: liveStreamError.destinationAlreadyExists,
                        message: 'Destination already exists. Please update the destination instead.',
                    });
                } else {
                    next(null);
                }
            }
        }, (next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: id,
            }, {
                $push: {
                    'configuration.stream_destinations': set,
                },
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result,
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

const getLiveStreamDestination = (req, res) => {
    const {
        id,
        destinationId,
    } = req.params;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: id,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (result) {
                    const streamDestinations = result.configuration.stream_destinations || [];
                    const destination = streamDestinations.find(destination => destination._id.toString() === destinationId);
                    if (destination) {
                        next(null, {
                            status: 200,
                            result: destination,
                        });
                    } else {
                        next({
                            error: liveStreamError.destinationDoesNotExist,
                            message: 'Destination does not exist.',
                        });
                    }
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

const deleteLiveStreamDestination = (req, res) => {
    const {
        id,
        destinationId,
    } = req.params;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: id,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (liveStream, next) => {
            const streamDestinations = liveStream.configuration.stream_destinations || [];
            const index = streamDestinations.findIndex(destination => destination._id.toString() === destinationId);
            if (index === -1) {
                next({
                    error: liveStreamError.destinationDoesNotExist,
                    message: 'Destination does not exist.',
                });
            } else {
                next(null, liveStream, streamDestinations[index]);
            }
        }, (liveStream, destination, next) => {
            if (destination.name === 'OmniFlixTV' && destination.enabled) {
                liveStreamHelper.updateStudioLiveStreamDestinationStop(liveStream, destination, (error) => {
                    if (error) {
                        next(error);
                    } else {
                        next(null);
                    }
                });
            } else {
                next(null);
            }
        }, (next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: id,
                'configuration.stream_destinations': {
                    $elemMatch: {
                        _id: destinationId,
                    },
                },
            }, {
                $pull: {
                    'configuration.stream_destinations': {
                        _id: destinationId,
                    },
                },
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result,
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

const updateLiveStreamDestination = (req, res) => {
    const {
        id,
        destinationId,
    } = req.params;

    const {
        url,
        key,
        streamId,
        tvType,
        enabled,
        username,
    } = req.body;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: id,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (liveStream, next) => {
            const streamDestinations = liveStream.configuration.stream_destinations || [];
            const index = streamDestinations.findIndex(destination => destination._id.toString() === destinationId);
            if (index === -1) {
                next({
                    error: liveStreamError.destinationDoesNotExist,
                    message: 'Destination does not exist.',
                });
            } else {
                const destination = streamDestinations[index];
                if (destination.name === 'OmniFlixTV') {
                    if (streamId) {
                        const alreadyExists = streamDestinations.findIndex(dest => dest.stream_id === streamId);
                        if (alreadyExists !== -1 && alreadyExists !== index) {
                            next({
                                error: liveStreamError.destinationAlreadyExists,
                                message: 'Destination already exists. Please update the destination instead.',
                            });
                        } else {
                            const updates = {
                                $set: {
                                    'configuration.stream_destinations.$[elem].stream_id': streamId,
                                },
                            };
                            if (tvType) {
                                updates.$set['configuration.stream_destinations.$[elem].tv_type'] = tvType;
                            }
                            if (key) {
                                updates.$set['configuration.stream_destinations.$[elem].key'] = key;
                            }
                            if (enabled !== undefined && enabled !== null) {
                                updates.$set['configuration.stream_destinations.$[elem].enabled'] = enabled;
                            }
                            if (username) {
                                updates.$set['configuration.stream_destinations.$[elem].username'] = username;
                            }
                            next(null, updates);
                        }
                    } else {
                        const updates = {
                            $set: {},
                        };
                        if (tvType) {
                            updates.$set['configuration.stream_destinations.$[elem].tv_type'] = tvType;
                        }
                        if (key) {
                            updates.$set['configuration.stream_destinations.$[elem].key'] = key;
                        }
                        if (enabled !== undefined && enabled !== null) {
                            updates.$set['configuration.stream_destinations.$[elem].enabled'] = enabled;
                        }
                        if (username) {
                            updates.$set['configuration.stream_destinations.$[elem].username'] = username;
                        }
                        next(null, updates);
                    }
                } else {
                    if (key && url) {
                        const alreadyExists = streamDestinations.findIndex(dest => dest.url === url && dest.key === key && dest.name === destination.name);
                        if (alreadyExists !== -1 && alreadyExists !== index) {
                            next({
                                error: liveStreamError.destinationAlreadyExists,
                                message: 'Destination already exists. Please update the destination instead.',
                            });
                        } else {
                            const updates = {
                                $set: {
                                    'configuration.stream_destinations.$[elem].url': url,
                                    'configuration.stream_destinations.$[elem].key': key,
                                },
                            };
                            if (enabled !== undefined && enabled !== null) {
                                updates.$set['configuration.stream_destinations.$[elem].enabled'] = enabled;
                            }
                            if (username) {
                                updates.$set['configuration.stream_destinations.$[elem].username'] = username;
                            }
                            next(null, updates);
                        }
                    } else if (url) {
                        const alreadyExists = streamDestinations.findIndex(dest => dest.url === url && dest.key === destination.key && dest.name === destination.name);
                        if (alreadyExists !== -1 && alreadyExists !== index) {
                            next({
                                error: liveStreamError.destinationAlreadyExists,
                                message: 'Destination already exists. Please update the destination instead.',
                            });
                        } else {
                            const updates = {
                                $set: {
                                    'configuration.stream_destinations.$[elem].url': url,
                                },
                            };
                            if (enabled !== undefined && enabled !== null) {
                                updates.$set['configuration.stream_destinations.$[elem].enabled'] = enabled;
                            }
                            if (username) {
                                updates.$set['configuration.stream_destinations.$[elem].username'] = username;
                            }
                            next(null, updates);
                        }
                    } else if (key) {
                        const alreadyExists = streamDestinations.findIndex(dest => dest.key === key && dest.url === destination.url && dest.name === destination.name);
                        if (alreadyExists !== -1 && alreadyExists !== index) {
                            next({
                                error: liveStreamError.destinationAlreadyExists,
                                message: 'Destination already exists. Please update the destination instead.',
                            });
                        } else {
                            const updates = {
                                $set: {
                                    'configuration.stream_destinations.$[elem].key': key,
                                },
                            };
                            if (enabled !== undefined && enabled !== null) {
                                updates.$set['configuration.stream_destinations.$[elem].enabled'] = enabled;
                            }
                            if (username) {
                                updates.$set['configuration.stream_destinations.$[elem].username'] = username;
                            }
                            next(null, updates);
                        }
                    } else {
                        const updates = {
                            $set: {},
                        };
                        if (enabled !== undefined && enabled !== null) {
                            updates.$set['configuration.stream_destinations.$[elem].enabled'] = enabled;
                        }
                        if (username) {
                            updates.$set['configuration.stream_destinations.$[elem].username'] = username;
                        }
                        next(null, updates);
                    }
                }
            }
        }, (updates, next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: id,
                'configuration.stream_destinations._id': destinationId,
            }, updates, {
                arrayFilters: [{
                    'elem._id': destinationId,
                }],
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (result) {
                    next(null, {
                        status: 201,
                        result,
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

const updateRunnerLiveStream = (req, res) => {
    const {
        id,
    } = req.params;

    const {
        status,
        playingLiveFeed,
        broadcastConfig,
        liveFeedConfig,
    } = req.body;

    const set = {};
    if (playingLiveFeed !== undefined) {
        set.playing_live_feed = playingLiveFeed;
    }
    if (status) {
        set.status = status;
    }
    if (broadcastConfig) {
        set['configuration.broadcast_config'] = broadcastConfig;
    }
    if (liveFeedConfig) {
        set['configuration.live_feed_config'] = liveFeedConfig;
    }

    async.waterfall([
        (next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: id,
            }, {
                $set: set,
            }, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    console.log(error);
                    logger.error(error);
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result,
                    });
                } else {
                    next(null, {
                        status: 404,
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

const getRunnerLiveStreams = (req, res) => {
    const { status } = req.query;
    const {
        _id,
        username,
        is_admin: isAdmin,
    } = req.user;

    async.waterfall([
        (next) => {
            const conditions = {};
            if (status) {
                conditions.status = status.toUpperCase();
            }
            if (!isAdmin) {
                conditions.$or = [{
                    created_by: _id,
                }, {
                    'created_by.username': username,
                }];
            }

            liveStreamDBO.find(conditions, {
                name: 1,
                image_url: 1,
                default: 1,
                configuration: 1,
                status: 1,
                playing_live_feed: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamsFailed,
                        message: 'Error occurred while finding the live streams.',
                    });
                } else {
                    next(null, result);
                }
            });
        }, (streams, next) => {
            const _streams = [];
            for (const stream of streams) {
                if (stream.configuration && stream.configuration.broadcastConfig && stream.configuration.broadcastConfig.stream_key) {
                    stream.view_link = `https://${publicAddress}/live/${stream.configuration.broadcastConfig.stream_key}.m3u8`;
                }
                _streams.push(stream);
            }
            next(null, {
                status: 200,
                result: _streams,
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getLiveStreamConfig = (req, res) => {
    const {
        id,
    } = req.params;
    async.waterfall([
        (next) => {
            const conditions = {
                _id: id,
            };

            liveStreamDBO.findOne(conditions, {
                name: 1,
                configuration: 1,
                playing_live_feed: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result,
                    });
                } else {
                    logger.error(error);
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

const startLiveStream = (req, res) => {
    const {
        id,
    } = req.params;
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;

    let isContentAutoFillEnabled = false;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: id,
                media_space: mediaSpace,
            }, {
                _id: 1,
                configuration: 1,
                media_space: 1,
                slot_configuration: 1,
            }, {}, true, (error, streamDetails) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (streamDetails) {
                    const streamConfigData = {
                        configuration: streamDetails.configuration,
                        username: streamDetails.media_space.username,
                        media_space: streamDetails.media_space,
                    };
                    if (streamDetails.extra_destinations && streamDetails.extra_destinations.length > 0) {
                        streamConfigData.extra_destinations = streamDetails.extra_destinations;
                    }
                    if (streamDetails.slot_configuration && streamDetails.slot_configuration.content_auto_fill_enabled) {
                        isContentAutoFillEnabled = true;
                    }
                    next(null, streamConfigData);
                } else {
                    next({
                        status: 404,
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (streamConfigData, next) => {
            const { rtmpPath, rtmpConfigDetails, nginxConfigDetails } = configHelper.configureRTMPandNGINXSettings(streamConfigData);
            configHelper.rtmpConfig(rtmpPath, rtmpConfigDetails, streamConfigData.configuration.broadcast_enabled, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.createRtmpFileFailed,
                        message: 'Error occurred while creating rtmp config.',
                        info: error,
                    });
                } else {
                    next(null, streamConfigData, nginxConfigDetails);
                }
            });
        }, (streamConfigData, nginxConfigDetails, next) => {
            configHelper.nginxConfig(config.nginx.path, nginxConfigDetails, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.createNginxFileFailed,
                        message: 'Error occurred while creating nginx config.',
                    });
                } else {
                    next(null, streamConfigData);
                }
            });
        }, (streamConfigData, next) => {
            configHelper.updateStreamKeys(config.streamer.stream_keys_path, streamConfigData.media_space.username, streamConfigData.media_space.id, streamConfigData.configuration.broadcast_config.stream_key, streamConfigData.configuration.live_feed_config.stream_key, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.updateStreamKeysFailed,
                        message: 'Error occurred while updating the stream keys.',
                    });
                } else {
                    next(null, streamConfigData);
                }
            });
        }, (streamConfigData, next) => {
            childProcess.exec('nginx -s reload', (err, stdout, stderr) => {
                if (err) {
                    next({
                        error: manageMsErrors.reloadFailed,
                        message: 'Error occurred while reloading NGINX',
                        info: `${err.message}`,
                    });
                } else if (stderr) {
                    next({
                        error: manageMsErrors.reloadFailed,
                        message: 'Error occurred while reloading NGINX',
                        info: `${stderr}`,
                    });
                } else {
                    next(null, streamConfigData);
                }
            });
        }, (streamConfigData, next) => {
            if (isContentAutoFillEnabled) {
                slotHelper.createAndPushSlot(id, (error) => {
                    if (error) {
                        next(error);
                    } else {
                        next(null, streamConfigData);
                    }
                });
            } else {
                next(null, streamConfigData);
            }
        }, (streamConfigData, next) => {
            const startStreamUrl = `http://${ip}:${port}/live-streams/users/${_id}/streams/${id}/start`;
            Axios({
                method: 'post',
                url: startStreamUrl,
                data: streamConfigData,
            }).then((res) => {
                if (res.data && res.data.success) {
                    next(null);
                } else {
                    logger.error(res.data);
                    let msg = 'Error occurred while starting the stream.';
                    if (res.data.error && res.data.error.message) {
                        msg = res.data.error.message;
                    }
                    next({
                        error: liveStreamError.requestRunnerFailed,
                        message: msg,
                    });
                }
            }).catch((error) => {
                logger.error(error.message);
                next({
                    error: liveStreamError.requestRunnerFailed,
                    message: 'Error occurred while requesting the runner.',
                });
            });
        }, (next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: id,
            }, {
                $set: {
                    status: 'LIVE',
                    'configuration.broadcast_state': 'running',
                },
            }, {
                new: true,
            }, true, (error, streamStartResult) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (streamStartResult) {
                    next(null, streamStartResult);
                } else {
                    next(null, {
                        status: 404,
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (streamStartResult, next) => {
            liveStreamHelper.createNewLiveStreamInStudio(streamStartResult, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next(error);
                } else {
                    next(null, result);
                }
            });
        }, (streamStartResult, next) => {
            liveStreamHelper.updateStudioLiveStreamStart(streamStartResult, false, null, (error) => {
                if (error) {
                    logger.error(error);
                    next(error);
                } else {
                    next(null, streamStartResult);
                }
            });
        }, (streamStartResult, next) => {
            liveStreamHelper.updateLiveStreamDestinationsToStudio(streamStartResult, (error) => {
                if (error) {
                    logger.error(error);
                }
                next(null, {
                    status: 200,
                });
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const stopLiveStream = (req, res) => {
    const {
        id,
    } = req.params;
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: id,
                media_space: mediaSpace,
            }, {
                _id: 1,
                configuration: 1,
                media_space: 1,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (result) {
                    const data = {
                        username: result.media_space.username,
                    };
                    next(null, data);
                } else {
                    next({
                        status: 404,
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (data, next) => {
            const url = `http://${ip}:${port}/live-streams/users/${_id}/streams/${id}/stop`;
            Axios({
                method: 'post',
                url,
                data,
            }).then(() => {
                next(null);
            }).catch((error) => {
                logger.error(error);
                next({
                    error: liveStreamError.requestRunnerFailed,
                    message: 'Error occurred while requesting the runner.',
                });
            });
        }, (next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: id,
            }, {
                $set: {
                    status: 'ENDED',
                    'configuration.broadcast_state': 'stopped',
                },
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next(null, {
                        status: 404,
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (liveStream, next) => {
            liveStreamHelper.updateStudioLiveStreamStop(liveStream, (error) => {
                if (error) {
                    next(error);
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

const updateLiveStreamLiveText = (req, res) => {
    const {
        id,
    } = req.params;
    const {
        text,
    } = req.body;
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: id,
                media_space: mediaSpace,
            }, {
                $set: {
                    'configuration.stream_live_text': text,
                },
            }, {
                new: true,
            }, false, (error, result) => {
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
            const url = `http://${ip}:${port}/live-streams/users/${_id}/streams/${id}/live-text`;
            const data = {
                text,
            };
            Axios({
                method: 'post',
                url,
                data,
            }).then(() => {
                next(null, {
                    status: 200,
                });
            }).catch((error) => {
                logger.error(error);
                next({
                    error: liveStreamError.requestRunnerFailed,
                    message: 'Error occurred while requesting the runner.',
                });
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getLiveStreamStatus = (req, res) => {
    const {
        id,
    } = req.params;
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: id,
                media_space: mediaSpace,
            }, {}, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        status: 404,
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (liveStream, next) => {
            const url = `http://${ip}:${port}/live-streams/users/${_id}/streams/${id}/status`;
            Axios({
                method: 'get',
                url,
            }).then((response) => {
                if (response && response.data && response.data.success) {
                    if (response.data.status === 'running') {
                        next(null, {
                            status: 'active',
                            stream: response.data.stream,
                        }, liveStream);
                    } else {
                        next(null, {
                            status: 'inactive',
                        }, liveStream);
                    }
                } else {
                    next(null, {
                        status: 'inactive',
                    }, liveStream);
                }
            }).catch((error) => {
                logger.error(error);
                next(null, {
                    status: 'inactive',
                    message: error.message,
                }, liveStream);
            });
        }, (data, liveStream, next) => {
            let liveFeedStatus = {};
            liveStreamHelper.getLiveFeedStatus(liveStream.media_space.username, (error, result) => {
                if (error) {
                    logger.error(error);
                    liveFeedStatus = {
                        status: 'inactive',
                        message: error.message,
                    };
                } else {
                    if (result) {
                        liveFeedStatus = {
                            status: 'active',
                        };
                    } else {
                        liveFeedStatus = {
                            status: 'inactive',
                        };
                    }
                }
                next(null, data, liveFeedStatus);
            });
        }, (broadcastStatus, liveFeedStatus, next) => {
            next(null, {
                status: 200,
                result: {
                    broadcast_status: broadcastStatus,
                    live_feed_status: liveFeedStatus,
                },
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getLiveStreamWatchUrl = (req, res) => {
    const { id } = req.params;
    const { ip } = req.query;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: id,
            }, {
                configuration: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamsFailed,
                        message: 'Error occurred while finding the live streams.',
                    });
                } else {
                    next(null, result);
                }
            });
        }, (stream, next) => {
            const expiresTimestamp = new Date(Date.now() + (1000 * 60 * VIDEO_LINK_EXPIRE_MINUTES)).getTime();
            const expires = String(Math.round(expiresTimestamp / 1000));
            const token = generateSecurePathHash(expires, ip, md5.secret);
            if (publicAddress && stream.configuration && stream.configuration.broadcast_config &&
                stream.configuration.broadcast_config.stream_key) {
                next(null, {
                    status: 200,
                    result: {
                        streamUrl: `https://${publicAddress}/stream/${id}/${token}/${expires}/${stream.configuration.broadcast_config.stream_key}.m3u8`,
                    },
                });
            } else {
                next({
                    error: liveStreamError.streamUrlFetchFailed,
                    message: 'Error occurred while fetching the live stream url.',
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateDestinationsFromStudio = (req, res) => {
    const { id } = req.params;
    const {
        destinations,
    } = req.body;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: id,
            }, {}, {}, true, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        status: 404,
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (liveStream, next) => {
            const liveStreamDestinations = liveStream.configuration.stream_destinations || [];
            const uniqueDestinations = destinations.filter(dest => {
                return !liveStreamDestinations.some(lsDest => {
                    if (dest.name === 'OmniFlixTV') {
                        return lsDest.name === dest.name && lsDest.stream_id === dest.stream_id && lsDest.key === dest.key;
                    } else {
                        return lsDest.name === dest.name && lsDest.url === dest.url && lsDest.key === dest.key;
                    }
                });
            });
            next(null, liveStream, uniqueDestinations);
        }, (liveStream, uniqueDestinations, next) => {
            if (uniqueDestinations.length > 0) {
                liveStreamDBO.findOneAndUpdate({
                    _id: id,
                }, {
                    $push: {
                        'configuration.stream_destinations': {
                            $each: uniqueDestinations,
                        },
                    },
                }, {
                    new: true,
                }, true, (error, result) => {
                    if (error) {
                        logger.error(error.message);
                        next({
                            error: liveStreamError.updateLiveStreamFailed,
                            message: 'Error occurred while updating the live stream.',
                        });
                    } else if (result) {
                        next(null, {
                            status: 200,
                            result,
                        });
                    } else {
                        next({
                            error: liveStreamError.liveStreamDoesNotExist,
                            message: 'Live stream does not exist.',
                        });
                    }
                });
            } else {
                next(null, {
                    status: 200,
                    result: liveStream,
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const switchToLive = (req, res) => {
    let { username } = req.params;
    const {
        broadcast_key: broadcastKey,
    } = req.body;

    if (username === 'ubuntu') {
        username = 'main';
    }

    async.waterfall([
        (next) => {
            mediaSpaceDBO.findOne({
                username,
            }, {}, {}, false, (error, mediaSpace) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occurred while finding the media space.',
                    });
                } else if (mediaSpace) {
                    next(null, mediaSpace);
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'Media space does not exist.',
                    });
                }
            });
        }, (mediaSpace, next) => {
            liveStreamDBO.findOne({
                media_space: mediaSpace._id,
                'configuration.broadcast_config.stream_key': broadcastKey,
            }, {}, {}, true, (error, liveStream) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (liveStream) {
                    next(null, liveStream);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (liveStream, next) => {
            const liveFeedUrl = `live_feed/${liveStream.media_space.id}`;
            const url = `http://${ip}:${port}/live-streams/details?stream_url=${encodeURIComponent(liveFeedUrl)}`;
            console.log('url', url);
            Axios({
                method: 'get',
                url,
            }).then((response) => {
                if (response && response.data && response.data.success) {
                    const bitRate = response.data.result;
                    if (bitRate > 0) {
                        next(null, liveStream, bitRate);
                    } else {
                        next(null, liveStream, null);
                    }
                } else {
                    next(null, liveStream, null);
                }
            }).catch((error) => {
                logger.error('Error occurred while getting the live stream bit rate.', error);
                next(null, liveStream, null);
            });
        }, (liveStream, bitRate, next) => {
            const destinations = liveStream.configuration.stream_destinations || [];
            const liveFeedDestinations = destinations.filter(destination => destination.type === 'live_feed') || [];
            if (liveStream.status === 'ENDED' || liveFeedDestinations.length === 0) {
                liveStreamHelper.createNewLiveStreamInStudio(liveStream, true, (error, result) => {
                    if (error) {
                        logger.error('Error occurred while creating live stream in studio.', error);
                    }
                    next(null, result, bitRate);
                });
            } else {
                next(null, liveStream, bitRate);
            }
        }, (liveStream, bitRate, next) => {
            liveStreamHelper.updateStudioLiveStreamStart(liveStream, true, bitRate, (error) => {
                if (error) {
                    logger.error('Error occurred while updating the live stream start.', error);
                }
                next(null, liveStream);
            });
        }, (liveStream, next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: liveStream._id,
            }, {
                $set: {
                    status: 'LIVE',
                },
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (liveStream, next) => {
            liveStreamHelper.updateLiveStreamDestinationsToStudio(liveStream, (error) => {
                if (error) {
                    logger.error(error);
                }
                next(null, {
                    status: 200,
                });
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const switchToBroadcast = (req, res) => {
    let { username } = req.params;
    const {
        playback_id: playbackId,
        broadcast_key: broadcastKey,
    } = req.body;

    if (username === 'ubuntu') {
        username = 'main';
    }

    async.waterfall([
        (next) => {
            mediaSpaceDBO.findOne({
                username,
            }, {}, {}, false, (error, mediaSpace) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occurred while finding the media space.',
                    });
                } else if (mediaSpace) {
                    next(null, mediaSpace);
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'Media space does not exist.',
                    });
                }
            });
        }, (mediaSpace, next) => {
            liveStreamDBO.findOne({
                media_space: mediaSpace._id,
                'configuration.broadcast_config.stream_key': broadcastKey,
            }, {}, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (result) {
                    next(null, mediaSpace, result);
                } else {
                    next({
                        status: 404,
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (mediaSpace, liveStream, next) => {
            if (playbackId) {
                const playbackPath = `/${playbackId}/${broadcastKey}1.m3u8`;
                const updates = {
                    $set: {
                        status: 'LIVE',
                        playback_path: playbackPath,
                    },
                };
                if (liveStream.configuration.broadcast_state === 'stopped') {
                    updates.$set.status = 'ENDED';
                }

                liveStreamDBO.findOneAndUpdate({
                    media_space: mediaSpace._id,
                    'configuration.broadcast_config.stream_key': broadcastKey,
                }, updates, {
                    new: true,
                }, true, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: liveStreamError.updateLiveStreamFailed,
                            message: 'Error occurred while updating the live stream.',
                        });
                    } else if (result) {
                        next(null, result);
                    } else {
                        next({
                            status: 404,
                            error: liveStreamError.liveStreamDoesNotExist,
                            message: 'Live stream does not exist.',
                        });
                    }
                });
            } else {
                next(null, liveStream);
            }
        }, (liveStream, next) => {
            liveStreamHelper.updateStudioLiveStreamStart(liveStream, false, null, (error) => {
                if (error) {
                    logger.error(error);
                }
                next(null, {
                    status: 200,
                });
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const stopStream = (req, res) => {
    let { username } = req.params;
    const {
        playback_id: playbackId,
        broadcast_key: broadcastKey,
    } = req.body;

    if (username === 'ubuntu') {
        username = 'main';
    }

    async.waterfall([
        (next) => {
            mediaSpaceDBO.findOne({
                username,
            }, {}, {}, false, (error, mediaSpace) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occurred while finding the media space.',
                    });
                } else if (mediaSpace) {
                    next(null, mediaSpace);
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'Media space does not exist.',
                    });
                }
            });
        }, (mediaSpace, next) => {
            const playbackPath = `/${playbackId}/${broadcastKey}1.m3u8`;
            const updates = {
                $set: {
                    status: 'ENDED',
                    playback_path: playbackPath,
                },
            };

            liveStreamDBO.findOneAndUpdate({
                media_space: mediaSpace._id,
                'configuration.broadcast_config.stream_key': broadcastKey,
            }, updates, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        status: 404,
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (liveStream, next) => {
            liveStreamHelper.updateStudioLiveStreamStop(liveStream, (error) => {
                if (error) {
                    logger.error(error);
                }
                next(null, {
                    status: 200,
                });
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const sendLiveStreamStatus = (bcAccountAddress, liveStreamId, mediaSpaceId, ws) => {
    async.waterfall([
        (next) => {
            usersDBO.findOne({
                media_space: mediaSpaceId,
                bc_account_address: bcAccountAddress,
            }, {
                _id: 1,
            }, {}, false, (error, user) => {
                if (error) {
                    logger.error('Error finding user:', error);
                    next({
                        error: userErrors.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (user) {
                    next(null, user);
                } else {
                    next({
                        error: userErrors.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (user, next) => {
            liveStreamDBO.findOne({
                _id: liveStreamId,
                media_space: mediaSpaceId,
            }, {}, {}, true, (error, liveStream) => {
                if (error) {
                    logger.error('Error finding live stream:', error);
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (liveStream) {
                    next(null, user, liveStream);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (user, liveStream, next) => {
            const url = `http://${ip}:${port}/live-streams/users/${user._id}/streams/${liveStream._id}/status`;
            Axios({
                method: 'get',
                url,
            }).then((response) => {
                if (response && response.data && response.data.success) {
                    if (response.data.status === 'running') {
                        next(null, {
                            status: 'active',
                            stream: response.data.stream,
                        }, liveStream);
                    } else {
                        next(null, {
                            status: 'inactive',
                        }, liveStream);
                    }
                } else {
                    next(null, {
                        status: 'inactive',
                    }, liveStream);
                }
            }).catch((error) => {
                logger.error(error);
                next(null, {
                    status: 'inactive',
                    message: error.message,
                }, liveStream);
            });
        }, (data, liveStream, next) => {
            let liveFeedStatus = {};
            liveStreamHelper.getLiveFeedStatus(liveStream.media_space.username, (error, result) => {
                if (error) {
                    logger.error(error);
                    liveFeedStatus = {
                        status: 'inactive',
                        message: error.message,
                    };
                } else {
                    if (result) {
                        liveFeedStatus = {
                            status: 'active',
                        };
                    } else {
                        liveFeedStatus = {
                            status: 'inactive',
                        };
                    }
                }
                next(null, data, liveFeedStatus, liveStream);
            });
        }, (broadcastStatus, liveFeedStatus, liveStream, next) => {
            if (liveFeedStatus.status === 'active') {
                const liveFeedUrl = `live_feed/${liveStream.media_space.id}`;
                const url = `http://${ip}:${port}/live-streams/details?stream_url=${encodeURIComponent(liveFeedUrl)}`;
                Axios({
                    method: 'get',
                    url,
                }).then((response) => {
                    if (response && response.data && response.data.success) {
                        try {
                            const bitRate = parseInt(response.data.result);
                            if (bitRate > 0) {
                                liveFeedStatus.bitRate = bitRate;
                            }
                        } catch (error) {
                            logger.error(error);
                            liveFeedStatus.bitRate = null;
                        }
                        next(null, broadcastStatus, liveFeedStatus, liveStream);
                    } else {
                        next(null, broadcastStatus, liveFeedStatus, liveStream);
                    }
                }).catch((error) => {
                    logger.error(error);
                    next(null, broadcastStatus, liveFeedStatus, liveStream);
                });
            } else {
                next(null, broadcastStatus, liveFeedStatus, liveStream);
            }
        }, (broadcastStatus, liveFeedStatus, liveStream, next) => {
            if (liveFeedStatus.status === 'active') {
                liveStreamHelper.updateStudioLiveStreamStart(liveStream, true, liveFeedStatus.bitRate, (error) => {
                    if (error) {
                        logger.error(error);
                    }
                });
            } else if (broadcastStatus.status === 'active') {
                liveStreamHelper.updateStudioLiveStreamStart(liveStream, false, null, (error) => {
                    if (error) {
                        logger.error(error);
                    }
                });
            }
            if (ws) {
                ws.send(JSON.stringify({
                    broadcast_status: broadcastStatus,
                    live_feed_status: liveFeedStatus,
                }));
            }
        },
    ], (error) => {
        logger.error(error);
    });
};

const broadcastLiveStreamUpdate = () => {
    async.waterfall([
        (next) => {
            const conditions = {
                broadcast_enabled: true,
            };
            if (config.mediaSpace.forLease === 'true') {
                conditions['lease.status'] = 'LEASE_STATUS_ACTIVE';
                conditions['lease.expiry'] = {
                    $gt: new Date(),
                };
            }
            mediaSpaceDBO.find(conditions, {}, {}, false, (error, mediaSpaces) => {
                if (error) {
                    logger.error('Error finding active media spaces:', error);
                } else if (mediaSpaces && mediaSpaces.length > 0) {
                    next(null, mediaSpaces);
                } else {
                    next('No active media spaces found');
                }
            });
        }, (mediaSpaces, next) => {
            const mediaSpaceIds = mediaSpaces.map((mediaSpace) => mediaSpace._id);
            liveStreamDBO.find({
                media_space: {
                    $in: mediaSpaceIds,
                },
                'slot_configuration.content_auto_fill_enabled': true,
                'configuration.broadcast_enabled': true,
                'configuration.broadcast_state': 'running',
            }, {}, {
                updated_at: 1,
            }, true, (error, liveStreams) => {
                if (error) {
                    logger.error('Error finding active live streams:', error);
                } else if (liveStreams && liveStreams.length > 0) {
                    next(null, liveStreams);
                } else {
                    next('No media spaces with live streams found');
                }
            });
        }, (liveStreams, next) => {
            const completedMediaSpaces = [];
            async.forEachLimit(liveStreams, 1, (liveStream, cb) => {
                if (!liveStream.media_space) {
                    cb();
                } else if (completedMediaSpaces.includes(liveStream.media_space._id)) {
                    cb();
                } else {
                    liveStreamHelper.startLiveStream(liveStream, (error) => {
                        if (error) {
                            logger.error('Error starting live stream:', error);
                        }
                        completedMediaSpaces.push(liveStream.media_space._id);
                        cb();
                    });
                }
            }, (_) => {
                next();
            });
        },
    ], (error) => {
        if (error) {
            logger.error(error);
        } else {
            logger.info('Live stream started successfully');
        }
    });
};

const triggerLiveStreamUpdate = () => {
    async.waterfall([
        (next) => {
            const conditions = {};
            if (config.mediaSpace.forLease === 'true') {
                conditions['lease.status'] = 'LEASE_STATUS_ACTIVE';
                conditions['lease.expiry'] = {
                    $gt: new Date(),
                };
            }
            mediaSpaceDBO.find(conditions, {}, {}, false, (error, mediaSpaces) => {
                if (error) {
                    logger.error(error.message);
                    next(error);
                } else if (mediaSpaces && mediaSpaces.length > 0) {
                    next(null, mediaSpaces);
                } else {
                    next('No media spaces found');
                }
            });
        }, (mediaSpaces, next) => {
            const mediaSpaceIds = mediaSpaces.map((mediaSpace) => mediaSpace._id);
            const liveStreams = [];
            async.each(mediaSpaceIds, (id, callback) => {
                liveStreamDBO.findOne({
                    media_space: id,
                    status: 'LIVE',
                }, (error, liveStream) => {
                    if (error) {
                        callback(error);
                    } else if (liveStream) {
                        liveStreams.push({
                            mediaSpaceId: id,
                            liveStreamId: liveStream._id,
                        });
                        callback(null);
                    } else {
                        callback(null);
                    }
                });
            }, (error) => {
                if (error) {
                    next(error);
                } else {
                    next(null, liveStreams);
                }
            });
        }, (liveStreams, next) => {
            const finalLiveStreams = [];
            async.forEachLimit(liveStreams, 1, (liveStream, cb) => {
                usersDBO.findOne({
                    media_space: liveStream.mediaSpaceId,
                    is_admin: true,
                }, {}, {}, false, (error, user) => {
                    if (error) {
                        cb(error);
                    } else {
                        finalLiveStreams.push({
                            mediaSpaceId: liveStream.mediaSpaceId,
                            liveStreamId: liveStream.liveStreamId,
                            bcAccountAddress: user.bc_account_address,
                        });
                        cb();
                    }
                });
            }, (error) => {
                if (error) {
                    logger.error(error);
                } else {
                    next(null, finalLiveStreams);
                }
            });
        }, (finalLiveStreams, next) => {
            console.log('finalLiveStreams', finalLiveStreams);
            async.forEachLimit(finalLiveStreams, 1, (liveStream, cb) => {
                sendLiveStreamStatus(liveStream.bcAccountAddress, liveStream.liveStreamId, liveStream.mediaSpaceId, null);
                cb();
            }, (error) => {
                if (error) {
                    logger.error(error);
                } else {
                    next(null);
                }
            });
        },
    ], (error) => {
        if (error) {
            logger.error(error);
        }
    });
};

const startLiveStreamCronJob = () => {
    logger.info('Starting live stream cron job');
    const job = new CronJob('*/12 * * * * *', () => {
        const keys = Array.from(connectedClients.keys());
        keys.forEach((key) => {
            const data = connectedClients.get(key);
            if (data) {
                sendLiveStreamStatus(key, data.liveStream, data.mediaSpace, data.ws);
            }
        });
        if (keys.length === 0) {
            triggerLiveStreamUpdate();
        }
    });
    job.start();
    const streamStartJob = new CronJob('0 */2 * * * *', () => {
        broadcastLiveStreamUpdate();
    });
    streamStartJob.start();
};

startLiveStreamCronJob();

module.exports = {
    getLiveStreams,
    addLiveStream,
    updateLiveStream,

    getLiveStreamDestination,
    addLiveStreamDestination,
    deleteLiveStreamDestination,
    updateLiveStreamDestination,

    getLiveStreamConfig,

    updateRunnerLiveStream,
    getRunnerLiveStreams,
    updateLiveStreamLiveText,

    updateDestinationsFromStudio,

    startLiveStream,
    stopLiveStream,
    getLiveStreamStatus,
    getLiveStreamWatchUrl,

    switchToLive,
    switchToBroadcast,
    stopStream,
};
