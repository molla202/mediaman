const async = require('async');
const Axios = require('axios');
const fs = require('fs');
const liveStreamDBO = require('../dbos/live_stream.dbo');
const mediaSpaceDBO = require('../dbos/media_space.dbo');
const slotDBO = require('../dbos/slot.dbo');
const programDBO = require('../dbos/program.dbo');
const assetDBO = require('../dbos/asset.dbo');
const defaultAdCampaignDBO = require('../dbos/default_ad_campaign.dbo');
const slotConfigDBO = require('../dbos/slot_config.dbo');
const liveStreamError = require('../errors/live_stream.error');
const mediaSpaceError = require('../errors/media_space.error');
const slotError = require('../errors/slot.error');
const programError = require('../errors/program.error');
const assetError = require('../errors/asset.error');
const slotHelper = require('./slot.helper');
const configHelper = require('./config.helper');
const config = require('../../config');
const stringUtils = require('../utils/string.util');
const { msStringToDate } = require('../utils/date.util');
const { shuffle } = require('../utils/array.util');
const { ip, port } = require('../../config/index').runner;
const logger = require('../../logger');

const getLiveFeedStatus = (username, cb) => {
    async.waterfall([
        (next) => {
            if (username === 'main') {
                username = 'ubuntu';
            }
            const configPath = `/home/${username}/streamer/config.json`;
            fs.readFile(configPath, 'utf8', (error, data) => {
                if (error) {
                    next({
                        error: liveStreamError.configReadFailed,
                        message: error.message,
                    });
                } else {
                    try {
                        const parsedConfig = JSON.parse(data);
                        if (Object.prototype.hasOwnProperty.call(parsedConfig, 'playing_live_feed')) {
                            next(null, parsedConfig.playing_live_feed);
                        } else {
                            next({
                                error: liveStreamError.configReadFailed,
                                message: 'playing_live_feed key not found in config file',
                            });
                        }
                    } catch (parseError) {
                        next({
                            error: liveStreamError.configReadFailed,
                            message: 'Failed to parse config file: ' + parseError.message,
                        });
                    }
                }
            });
        },
    ], (error, result) => {
        cb(error, result);
    });
};

const createLiveStream = (user, mediaSpaceId, randomDigits, cb) => {
    const broadcastStreamKey = stringUtils.randomString(10);
    const liveFeedStreamKey = stringUtils.randomString(10);
    const ip = config.server.ip;
    const doc = {
        name: user.username,
        created_by: user._id,
        configuration: {
            broadcast_config: {
                stream_url: `rtmp://localhost:1935/${randomDigits}/broadcast`,
                stream_key: broadcastStreamKey,
            },
            live_feed_config: {
                stream_url: `rtmp://${ip}:${config.nginx.rtmpPort}/${randomDigits}/live_feed`,
                stream_key: liveFeedStreamKey,
            },
            broadcast_enabled: true,
        },
        media_space: mediaSpaceId,
    };

    async.waterfall([
        (next) => {
            mediaSpaceDBO.findOne({
                _id: mediaSpaceId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occurred while finding media space.',
                    });
                } else if (result) {
                    doc.configuration.broadcast_enabled = result.broadcast_enabled;
                    next(null);
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'Media space does not exist.',
                    });
                }
            });
        }, (next) => {
            liveStreamDBO.save(doc, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.saveLiveStreamFailed,
                        message: 'Error occurred while saving live stream.',
                    });
                } else if (result) {
                    next(null, broadcastStreamKey, liveFeedStreamKey);
                } else {
                    next({
                        error: liveStreamError.saveLiveStreamFailed,
                        message: 'Failed to save live stream.',
                    });
                }
            });
        },
    ], (error, result) => {
        cb(error, result);
    });
};

const updateStudioLiveStreamStart = (liveStream, isLiveFeed, bitRate, cb) => {
    const playbackPath = liveStream.playback_path;
    async.waterfall([
        (next) => {
            const destinations = liveStream.configuration.stream_destinations || [];
            const connectedChannels = liveStream.configuration.connected_channels || [];
            const omniFlixTVDestinations = destinations.filter(destination => destination.name === 'OmniFlixTV' && destination.enabled) || [];
            const nonOmniFlixEnabledDestinations = destinations.filter(destination => destination.name !== 'OmniFlixTV' && destination.enabled)
                .map(destination => ({
                    url: destination.url,
                    name: destination.name,
                })) || [];
            if (omniFlixTVDestinations && omniFlixTVDestinations.length) {
                const liveFeedDestinations = omniFlixTVDestinations.filter(destination => destination.type === 'live_feed') || [];
                const broadcastDestinations = omniFlixTVDestinations.filter(destination => destination.type === 'broadcast') || [];
                let destinationIdsWithConnectedChannels = [];
                if (connectedChannels && connectedChannels.length) {
                    const enabledConnectedChannelIds = connectedChannels.filter(connectedChannel => connectedChannel.enabled).map(connectedChannel => connectedChannel.channel_id.toString()) || [];
                    destinationIdsWithConnectedChannels = omniFlixTVDestinations.filter(destination => enabledConnectedChannelIds.includes(destination.channel_id.toString())).map(destination => destination._id.toString());
                }
                next(null, liveFeedDestinations, broadcastDestinations, destinationIdsWithConnectedChannels, nonOmniFlixEnabledDestinations);
            } else {
                next(null, [], [], [], []);
            }
        }, (liveFeedDestinations, broadcastDestinations, destinationIdsWithConnectedChannels, nonOmniFlixEnabledDestinations, next) => {
            const docs = [];
            const urls = [];
            if (liveFeedDestinations && liveFeedDestinations.length) {
                let viewKey;
                liveFeedDestinations.forEach((liveFeedDestination) => {
                    if (isLiveFeed) {
                        viewKey = `${liveStream.media_space.id}/${liveStream.configuration.broadcast_config.stream_key}1`;
                        const doc = {
                            status: 'LIVE',
                            token: liveFeedDestination.key,
                            viewKey,
                            typeOfStream: isLiveFeed ? 'live_feed' : 'broadcast',
                        };
                        if (bitRate) {
                            doc.bitRate = bitRate;
                        }
                        if (destinationIdsWithConnectedChannels && destinationIdsWithConnectedChannels.length && destinationIdsWithConnectedChannels.includes(liveFeedDestination._id.toString())) {
                            doc.destinations = nonOmniFlixEnabledDestinations;
                            if (liveStream.configuration.stream_live_text) {
                                doc.text = liveStream.configuration.stream_live_text;
                            }
                        }
                        docs.push(doc);
                        urls.push(`${config.omniflixStudio[liveFeedDestination.tv_type]}/media-node/live-streams/${liveFeedDestination.stream_id}`);
                    } else {
                        const doc = {
                            status: 'ENDED',
                            token: liveFeedDestination.key,
                        };
                        if (playbackPath) {
                            doc.playback_path = playbackPath;
                        }
                        docs.push(doc);
                        urls.push(`${config.omniflixStudio[liveFeedDestination.tv_type]}/media-node/live-streams/${liveFeedDestination.stream_id}`);
                    }
                });
            }
            if (broadcastDestinations && broadcastDestinations.length) {
                broadcastDestinations.forEach((broadcastDestination) => {
                    if (isLiveFeed) {
                        const doc = {
                            status: 'PAUSED',
                            token: broadcastDestination.key,
                        };
                        docs.push(doc);
                        urls.push(`${config.omniflixStudio[broadcastDestination.tv_type]}/media-node/live-streams/${broadcastDestination.stream_id}`);
                    } else {
                        if (liveStream.configuration.broadcast_state === 'running') {
                            const doc = {
                                status: 'LIVE',
                                token: broadcastDestination.key,
                                viewKey: `${liveStream.media_space.id}/broadcast/${liveStream.configuration.broadcast_config.stream_key}`,
                            };
                            if (destinationIdsWithConnectedChannels && destinationIdsWithConnectedChannels.length && destinationIdsWithConnectedChannels.includes(broadcastDestination._id.toString())) {
                                doc.destinations = nonOmniFlixEnabledDestinations;
                                if (liveStream.configuration.stream_live_text) {
                                    doc.text = liveStream.configuration.stream_live_text;
                                }
                            }
                            docs.push(doc);
                            urls.push(`${config.omniflixStudio[broadcastDestination.tv_type]}/media-node/live-streams/${broadcastDestination.stream_id}`);
                        }
                    }
                });
            }
            next(null, docs, urls);
        }, (docs, urls, next) => {
            if (docs && urls && docs.length && urls.length) {
                try {
                    const promises = docs.map((doc, index) => {
                        return Axios({
                            method: 'PUT',
                            url: urls[index],
                            data: doc,
                        });
                    });

                    Promise.all(promises)
                        .then(() => {
                            next(null);
                        })
                        .catch((error) => {
                            logger.error('Error occurred while updating live stream in studio.', error);
                            next(null);
                        });
                } catch (error) {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating live stream in studio.',
                        info: error.message,
                    });
                }
            } else {
                next(null);
            }
        }, (next) => {
            const updatedDestinations = liveStream.configuration.stream_destinations.filter(destination => destination.name !== 'OmniFlixTV' && destination.enabled) || [];
            const omniFlixTVDestinations = liveStream.configuration.stream_destinations.filter(destination => destination.name === 'OmniFlixTV' && destination.enabled) || [];

            if (omniFlixTVDestinations && omniFlixTVDestinations.length) {
                async.forEachLimit(omniFlixTVDestinations, 1, (omniFlixTVDestination, _next) => {
                    const url = `${config.omniflixStudio[omniFlixTVDestination.tv_type]}/live-streams/${omniFlixTVDestination.stream_id}/status?token=${omniFlixTVDestination.key}`;

                    Axios({
                        method: 'get',
                        url,
                    }).then((response) => {
                        if (response && response.data && response.data.success && response.data.result) {
                            if (response.data.result.stream_status === 'ENDED') {
                                _next(null);
                            } else {
                                updatedDestinations.push(omniFlixTVDestination);
                                _next(null);
                            }
                        } else {
                            _next(null);
                        }
                    }).catch((error) => {
                        logger.error('Error occurred while getting the live stream status.', error);
                        _next(null);
                    });
                }, (_error) => {
                    if (_error) {
                        next(null, updatedDestinations || []);
                    } else {
                        next(null, updatedDestinations || []);
                    }
                });
            } else {
                next(null, updatedDestinations || []);
            }
        }, (updatedDestinations, next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: liveStream._id,
            }, {
                $set: {
                    'configuration.stream_destinations': updatedDestinations,
                },
            }, {
                new: true,
            }, false, (error) => {
                if (error) {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating live stream.',
                    });
                } else {
                    next(null);
                }
            });
        },
    ], cb);
};

const updateStudioLiveStreamStop = (liveStream, cb) => {
    const playbackPath = liveStream.playback_path;

    async.waterfall([
        (next) => {
            const destinations = liveStream.configuration.stream_destinations || [];
            const omniFlixTVDestinations = destinations.filter(destination => destination.name === 'OmniFlixTV' && destination.enabled);
            if (omniFlixTVDestinations && omniFlixTVDestinations.length) {
                next(null, omniFlixTVDestinations);
            } else {
                next(null, null);
            }
        }, (omniFlixTVDestinations, next) => {
            if (omniFlixTVDestinations) {
                const docs = [];
                const urls = [];
                omniFlixTVDestinations.forEach((omniFlixTVDestination) => {
                    if (omniFlixTVDestination.type === 'broadcast') {
                        const doc = {
                            status: 'PAUSED',
                            token: omniFlixTVDestination.key,
                        };
                        urls.push(`${config.omniflixStudio[omniFlixTVDestination.tv_type]}/media-node/live-streams/${omniFlixTVDestination.stream_id}`);
                        docs.push(doc);
                    } else {
                        const doc = {
                            status: 'ENDED',
                            token: omniFlixTVDestination.key,
                        };
                        if (playbackPath) {
                            doc.playback_path = playbackPath;
                        }
                        urls.push(`${config.omniflixStudio[omniFlixTVDestination.tv_type]}/media-node/live-streams/${omniFlixTVDestination.stream_id}`);
                        docs.push(doc);
                    }
                });
                next(null, docs, urls);
            } else {
                next(null, null, null);
            }
        }, (docs, urls, next) => {
            if (docs && urls && docs.length && urls.length) {
                try {
                    const promises = docs.map((doc, index) => {
                        return Axios({
                            method: 'PUT',
                            url: urls[index],
                            data: doc,
                        });
                    });

                    Promise.all(promises)
                        .then(() => {
                            next(null);
                        })
                        .catch((error) => {
                            logger.error('Error occurred while updating live stream in studio.', error);
                            next(null);
                        });
                } catch (error) {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating live stream in studio.',
                        info: error.message,
                    });
                }
            } else {
                next(null);
            }
        }, (next) => {
            const updatedDestinations = liveStream.configuration.stream_destinations.filter(destination => destination.name !== 'OmniFlixTV' && destination.enabled) || [];
            const omniFlixTVDestinations = liveStream.configuration.stream_destinations.filter(destination => destination.name === 'OmniFlixTV' && destination.enabled) || [];

            if (omniFlixTVDestinations && omniFlixTVDestinations.length) {
                async.forEachLimit(omniFlixTVDestinations, 1, (omniFlixTVDestination, _next) => {
                    const url = `${config.omniflixStudio[omniFlixTVDestination.tv_type]}/live-streams/${omniFlixTVDestination.stream_id}/status?token=${omniFlixTVDestination.key}`;

                    Axios({
                        method: 'get',
                        url,
                    }).then((response) => {
                        if (response && response.data && response.data.success && response.data.result) {
                            if (response.data.result.stream_status === 'ENDED') {
                                _next(null);
                            } else {
                                updatedDestinations.push(omniFlixTVDestination);
                                _next(null);
                            }
                        } else {
                            _next(null);
                        }
                    }).catch((error) => {
                        logger.error('Error occurred while getting the live stream status.', error);
                        _next(null);
                    });
                }, (_error) => {
                    if (_error) {
                        next(null, updatedDestinations || []);
                    } else {
                        next(null, updatedDestinations || []);
                    }
                });
            } else {
                next(null, updatedDestinations || []);
            }
        }, (updatedDestinations, next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: liveStream._id,
            }, {
                $set: {
                    'configuration.stream_destinations': updatedDestinations,
                },
            }, {
                new: true,
            }, false, (error) => {
                if (error) {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating live stream.',
                    });
                } else {
                    next(null);
                }
            });
        },
    ], cb);
};

const createNewLiveStreamInStudio = (liveStream, isLiveFeed, cb) => {
    async.waterfall([
        (next) => {
            const connectedChannels = liveStream.configuration.connected_channels;
            const destinations = liveStream.configuration.stream_destinations;
            if (connectedChannels && connectedChannels.length) {
                if (!isLiveFeed && (destinations && destinations.length)) {
                    const broadcastTvDestinations = destinations.filter(destination => destination.name === 'OmniFlixTV' && destination.type === 'broadcast' && destination.enabled) || [];
                    if (broadcastTvDestinations && broadcastTvDestinations.length) {
                        next(null, connectedChannels, broadcastTvDestinations);
                    } else {
                        next(null, connectedChannels, []);
                    }
                } else {
                    next(null, connectedChannels, []);
                }
            } else {
                next(null, [], []);
            }
        }, (connectedChannels, broadcastTvDestinations, next) => {
            if (connectedChannels && connectedChannels.length) {
                async.forEachLimit(connectedChannels, 1, (connectedChannel, _next) => {
                    let channelBroadcastExistInDestination = false;
                    if (!isLiveFeed) {
                        channelBroadcastExistInDestination = broadcastTvDestinations.find(destination => destination.channel_id === connectedChannel.channel_id);
                    }
                    if (connectedChannel.enabled && !channelBroadcastExistInDestination) {
                        const url = `${config.omniflixStudio[connectedChannel.studio_type]}/media-node/live-streams`;
                        const data = {
                            channelId: connectedChannel.channel_id,
                            liveStreamAccessToken: connectedChannel.live_stream_access_token,
                            viewKey: `${liveStream.media_space.id}/broadcast/${liveStream.configuration.broadcast_config.stream_key}`,
                            mediaNodeId: config.mediaSpace.id,
                            bcAccountAddress: connectedChannel.bc_account_address,
                            name: liveStream.name,
                            description: liveStream.description,
                            type: isLiveFeed ? 'live_feed' : 'broadcast',
                        };
                        if (isLiveFeed) {
                            data.viewKey = `${liveStream.media_space.id}/${liveStream.configuration.broadcast_config.stream_key}1`;
                        }
                        if (liveStream.image_url) {
                            data.imageURL = liveStream.image_url;
                        }
                        Axios({
                            method: 'POST',
                            url,
                            data,
                        }).then((response) => {
                            if (response.data && response.data.result) {
                                console.log('response.data.result', response.data.result);
                                addLiveStreamDestination(liveStream, response.data.result, connectedChannel.studio_type, connectedChannel.channel_id, isLiveFeed, connectedChannel.username, (error) => {
                                    if (error) {
                                        logger.error(error.message);
                                    }
                                    _next(null);
                                });
                            } else {
                                _next({
                                    error: liveStreamError.createLiveStreamFailed,
                                    message: 'Error occurred while creating live stream in studio.',
                                    info: response.data,
                                });
                            }
                        }).catch((error) => {
                            console.log(error);
                            logger.error('Error occurred while creating live stream in studio.', error.data);
                            _next(null);
                        });
                    } else {
                        _next(null);
                    }
                }, (_error) => {
                    if (_error) {
                        next({
                            error: liveStreamError.createLiveStreamFailed,
                            message: 'Error occurred while creating live stream in studio.',
                            info: _error,
                        });
                    } else {
                        next(null);
                    }
                });
            } else {
                next(null);
            }
        }, (next) => {
            liveStreamDBO.findOne({
                _id: liveStream._id,
            }, {}, {}, true, (error, liveStream) => {
                if (error) {
                    logger.error(error.message);
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
        },
    ], cb);
};

const updateLiveStreamDestinationsToStudio = (liveStream, cb) => {
    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: liveStream._id,
            }, {}, {}, false, (error, liveStream) => {
                if (error) {
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
            const destinations = liveStream.configuration.stream_destinations || [];
            const enabledDestinations = destinations.filter(destination => destination.enabled && destination.name !== 'OmniFlixTV') || [];
            const simplifiedDestinations = enabledDestinations.map(destination => ({
                name: destination.name,
                url: destination.url,
                key: destination.key,
                username: destination.username,
            }));
            const connectedChannels = liveStream.configuration.connected_channels || [];
            const enabledConnectedChannels = connectedChannels.filter(channel => channel.enabled) || [];
            next(null, simplifiedDestinations, enabledConnectedChannels);
        }, (simplifiedDestinations, enabledConnectedChannels, next) => {
            if (enabledConnectedChannels && enabledConnectedChannels.length && simplifiedDestinations && simplifiedDestinations.length) {
                async.forEachLimit(enabledConnectedChannels, 1, (connectedChannel, _next) => {
                    const url = `${config.omniflixStudio[connectedChannel.studio_type]}/media-nodes/${config.mediaSpace.id}/live-stream-destinations`;
                    const data = {
                        token: connectedChannel.live_stream_access_token,
                        destinations: simplifiedDestinations,
                    };
                    Axios({
                        method: 'PUT',
                        url,
                        data,
                    }).then(() => {
                        _next(null);
                    }).catch((error) => {
                        console.log(error);
                        if (error.response && error.response.data && error.response.data.error) {
                            logger.error(error.response.data.error.message);
                        } else {
                            logger.error(error.message);
                        }
                        _next(null);
                    });
                }, (error) => {
                    if (error) {
                        next({
                            error: liveStreamError.updateLiveStreamFailed,
                            message: 'Error occurred while updating live stream.',
                        });
                    } else {
                        next(null);
                    }
                });
            } else {
                next(null);
            }
        },
    ], cb);
};

const addLiveStreamDestination = (liveStream, response, type, channelId, isLiveFeed, username, cb) => {
    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: liveStream._id,
            }, {}, {}, false, (error, liveStream) => {
                if (error) {
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
            const streamDestinations = liveStream.configuration.stream_destinations || [];
            const destinationIndex = streamDestinations.findIndex((destination) => destination.stream_id === response._id);
            if (destinationIndex !== -1) {
                streamDestinations[destinationIndex].key = response.stream_key;
            } else {
                streamDestinations.push({
                    name: 'OmniFlixTV',
                    stream_id: response._id,
                    key: response.stream_key,
                    channel_id: channelId,
                    tv_type: type,
                    type: isLiveFeed ? 'live_feed' : 'broadcast',
                    enabled: true,
                    username,
                });
            }
            console.log('streamDestinations', streamDestinations);
            liveStreamDBO.findOneAndUpdate({
                _id: liveStream._id,
            }, {
                $set: {
                    'configuration.stream_destinations': streamDestinations,
                },
            }, {
                new: true,
            }, false, (error, liveStream) => {
                if (error) {
                    console.log('error', error);
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating live stream.',
                    });
                } else if (liveStream) {
                    console.log('liveStream', liveStream);
                    next(null, liveStream);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        },
    ], (error) => {
        cb(error);
    });
};

const startLiveStream = (liveStream, cb) => {
    async.waterfall([
        (next) => {
            getLiveFeedStatus(liveStream.media_space.username, (error, result) => {
                if (error) {
                    next(error);
                } else {
                    next(null, result);
                }
            });
        }, (liveFeedStatus, next) => {
            if (liveFeedStatus) {
                next({
                    error: liveStreamError.startLiveStreamFailed,
                    message: 'Live feed stream is already running.',
                });
            } else {
                next(null);
            }
        }, (next) => {
            const url = `http://${ip}:${port}/live-streams/users/${liveStream.created_by._id}/streams/${liveStream._id}/status`;
            Axios({
                method: 'get',
                url,
            }).then((response) => {
                if (response && response.data && response.data.success) {
                    if (response.data.status === 'running') {
                        next({
                            error: liveStreamError.startLiveStreamFailed,
                            message: 'Live stream is already running.',
                        });
                    } else {
                        next(null);
                    }
                } else {
                    next(null);
                }
            }).catch((error) => {
                logger.error(error);
                next(null);
            });
        }, (next) => {
            configHelper.updateStreamKeys(config.streamer.stream_keys_path, liveStream.media_space.username, liveStream.media_space.id, liveStream.configuration.broadcast_config.stream_key, liveStream.configuration.live_feed_config.stream_key, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.updateStreamKeysFailed,
                        message: 'Error occurred while updating the stream keys.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            slotDBO.findOne({
                live_stream: liveStream._id,
                start_at: {
                    $lte: new Date(),
                },
                end_at: {
                    $gte: new Date(),
                },
            }, {}, {
                start_at: 1,
            }, false, (error, slot) => {
                if (error) {
                    next(error);
                } else if (slot) {
                    if (slot.play_out && slot.play_out.length && slot.push_at && slot.push_at < new Date()) {
                        next({
                            error: liveStreamError.startLiveStreamFailed,
                            message: 'Slot is already pushed.',
                        });
                    } else {
                        next(null, slot);
                    }
                } else {
                    next(null, null);
                }
            });
        }, (slot, next) => {
            if (slot) {
                next(null, slot);
            } else {
                const slotDuration = liveStream.configuration.slot_length || liveStream.slot_configuration.slot_length;
                const startAt = new Date();
                const endAt = new Date(startAt.getTime() + slotDuration * 1000);

                const doc = {
                    live_stream: liveStream._id,
                    name: `Slot ${new Date(startAt).getUTCHours()}:${new Date(startAt).getUTCMinutes()}`,
                    media_space: liveStream.media_space._id,
                    start_at: startAt,
                    end_at: endAt,
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
            slotHelper.fillSlotWithPrograms(liveStream._id, slot, (error, programs) => {
                if (error) {
                    next(error);
                } else {
                    next(null, slot, programs);
                }
            });
        }, (slot, programs, next) => {
            assetDBO.find({
                'file.encode.status': 'COMPLETE',
                media_space: liveStream.media_space._id,
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
                _id: liveStream._id,
                media_space: liveStream.media_space._id,
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
                live_stream: liveStream._id,
                media_space: liveStream.media_space._id,
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
                live_stream: liveStream._id,
                type: 'bug',
                media_space: liveStream.media_space._id,
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
                    live_stream: liveStream._id,
                    slot: slot._id,
                    media_space: liveStream.media_space._id,
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
            const url = `http://${ip}:${port}/live-streams/users/${liveStream.created_by._id}/streams/${liveStream._id}/generate-playlist`;
            const data = {
                date: _slot.startAt,
                slot: _slot,
                username: liveStream.media_space.username,
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
                media_space: liveStream.media_space._id,
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
                media_space: liveStream.media_space._id,
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
        }, (next) => {
            const startStreamUrl = `http://${ip}:${port}/live-streams/users/${liveStream.created_by._id}/streams/${liveStream._id}/start`;
            const streamConfigData = {
                configuration: liveStream.configuration,
                username: liveStream.media_space.username,
                media_space: liveStream.media_space,
            };
            if (liveStream.extra_destinations && liveStream.extra_destinations.length > 0) {
                streamConfigData.extra_destinations = liveStream.extra_destinations;
            }
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
                logger.error(error);
                next({
                    error: liveStreamError.requestRunnerFailed,
                    message: 'Error occurred while requesting the runner.',
                });
            });
        }, (next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: liveStream._id,
            }, {
                $set: {
                    status: 'LIVE',
                },
            }, {}, false, (error) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else {
                    next(null);
                }
            });
        },
    ], cb);
};

const stopLiveStreams = (mediaSpace, user, cb) => {
    async.waterfall([
        (next) => {
            liveStreamDBO.find({
                media_space: mediaSpace._id,
            }, {}, {}, true, (error, result) => {
                if (error) {
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (result && result.length) {
                    next(null, result);
                } else {
                    next(null, []);
                }
            });
        }, (liveStreams, next) => {
            async.forEachLimit(liveStreams, 10, (liveStream, next) => {
                const data = {
                    username: liveStream.media_space.username,
                };
                const url = `http://${ip}:${port}/live-streams/users/${user._id}/streams/${liveStream._id}/stop`;
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
            }, (error) => {
                if (error) {
                    next(error);
                } else {
                    next(null, liveStreams);
                }
            });
        }, (liveStreams, next) => {
            liveStreamDBO.updateMany({
                media_space: mediaSpace._id,
            }, {
                $set: {
                    status: 'ENDED',
                },
            }, {}, false, (error) => {
                if (error) {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else {
                    next(null, liveStreams);
                }
            });
        }, (liveStreams, next) => {
            async.forEachLimit(liveStreams, 10, (liveStream, next) => {
                updateStudioLiveStreamStop(liveStream, (error) => {
                    if (error) {
                        next(error);
                    } else {
                        next(null);
                    }
                });
            }, (error) => {
                if (error) {
                    next(error);
                } else {
                    next(null);
                }
            });
        },
    ], cb);
};

const updateStudioLiveStreamDestinationStop = (liveStream, destination, cb) => {
    const playbackPath = liveStream.playback_path;

    async.waterfall([
        (next) => {
            if (destination.type === 'broadcast') {
                const doc = {
                    status: 'PAUSED',
                    token: destination.key,
                };
                const url = `${config.omniflixStudio[destination.tv_type]}/media-node/live-streams/${destination.stream_id}`;
                next(null, doc, url);
            } else {
                const doc = {
                    status: 'ENDED',
                    token: destination.key,
                };
                if (playbackPath) {
                    doc.playback_path = playbackPath;
                }
                const url = `${config.omniflixStudio[destination.tv_type]}/media-node/live-streams/${destination.stream_id}`;
                next(null, doc, url);
            }
        }, (doc, url, next) => {
            if (doc && url) {
                Axios({
                    method: 'PUT',
                    url,
                    data: doc,
                }).then(() => {
                    next(null);
                }).catch((error) => {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating live stream in studio.',
                        info: error.message,
                    });
                });
            } else {
                next(null);
            }
        },
    ], cb);
};

module.exports = {
    getLiveFeedStatus,
    createLiveStream,
    updateStudioLiveStreamStart,
    updateStudioLiveStreamStop,
    createNewLiveStreamInStudio,
    startLiveStream,
    stopLiveStreams,
    updateLiveStreamDestinationsToStudio,
    updateStudioLiveStreamDestinationStop,
};
