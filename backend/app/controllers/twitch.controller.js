const async = require('async');
const fetch = require('node-fetch');
const liveStreamDBO = require('../dbos/live_stream.dbo');
const liveStreamError = require('../errors/live_stream.error');
const mediaSpaceDBO = require('../dbos/media_space.dbo');
const mediaSpaceError = require('../errors/media_space.error');
const twitchScheduleDBO = require('../dbos/twitch_schedule.dbo');
const twitchError = require('../errors/twitch.error');
const userDBO = require('../dbos/user.dbo');
const userError = require('../errors/user.error');
const processJSONResponse = require('../utils/response.util');
const stringUtils = require('../utils/string.util');
const config = require('../../config');
const logger = require('../../logger');

const getAuthUrl = (req, res) => {
    const { _id } = req.user;
    const scopes = ['user_read', 'channel:read:stream_key', 'channel:manage:schedule'];
    async.waterfall([
        (next) => {
            const randomString = stringUtils.randomString(20);
            const updates = {
                $push: {
                    'social_accounts.twitch': {
                        token: randomString,
                        status: 'UNVERIFIED',
                    },
                },
            };
            userDBO.findOneAndUpdate({
                _id,
            }, updates, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.updateUserFailed,
                        message: 'Error occurred while updating user.',
                    });
                } else if (result) {
                    next(null, randomString);
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (token, next) => {
            try {
                const params = new URLSearchParams({
                    client_id: config.twitch.clientId,
                    redirect_uri: config.twitch.redirectUri,
                    response_type: 'code',
                    scope: scopes.join(' '),
                    state: JSON.stringify({
                        _id,
                        token,
                    }),
                });
                const authUrl = `${config.twitch.authUrl}/oauth2/authorize?${params.toString()}`;
                next(null, {
                    status: 200,
                    result: {
                        url: authUrl,
                    },
                });
            } catch (error) {
                next({
                    error: twitchError.getAuthUrlFailed,
                    message: 'Error while getting auth url for twitch login.',
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const handleCallback = (req, res) => {
    const { code, scope, state } = req.query;
    const { _id, media_space: mediaSpace } = req.user;
    const { token: tokenString } = JSON.parse(state);

    async.waterfall([
        (next) => {
            const params = new URLSearchParams({
                client_id: config.twitch.clientId,
                client_secret: config.twitch.clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: config.twitch.redirectUri,
            });
            fetch(`${config.twitch.authUrl}/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            })
                .then((response) => response.json())
                .then((data) => {
                    next(null, data);
                })
                .catch((error) => {
                    next({
                        error: twitchError.getTokenFailed,
                        message: 'Error while getting token.',
                        data: error,
                    });
                });
        }, (token, next) => {
            fetch(`${config.twitch.apiUrl}/helix/users`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/vnd.twitchtv.v5+json',
                    'Client-ID': config.twitch.clientId,
                    Authorization: `Bearer ${token.access_token}`,
                },
            })
                .then((response) => response.json())
                .then((jsonResponse) => {
                    if (jsonResponse.data && jsonResponse.data.length > 0) {
                        next(null, token, jsonResponse.data[0]);
                    } else {
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'Error while getting twitch user data.',
                            data: jsonResponse,
                        });
                    }
                })
                .catch((error) => {
                    logger.error(error.message, error);
                    next({
                        error: twitchError.getTokenFailed,
                        message: 'Error while getting twitch user data.',
                        data: error,
                    });
                });
        }, (token, twitchData, next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpace,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error.message, error);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.twitch && result.social_accounts.twitch.length > 0) {
                        const index = result.social_accounts.twitch.findIndex(
                            (account) => account.broadcaster_id === twitchData.id && account.status === 'VERIFIED',
                        );
                        if (index !== -1) {
                            next(null, token, twitchData, index);
                        } else {
                            next(null, token, twitchData, -1);
                        }
                    } else {
                        next(null, token, twitchData, -1);
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (token, twitchData, index, next) => {
            if (index !== -1) {
                const conditions = {
                    _id,
                    'social_accounts.twitch.broadcaster_id': twitchData.id,
                };
                const updates = {
                    $set: {
                        'social_accounts.twitch.$[elem].code': code,
                        'social_accounts.twitch.$[elem].broadcaster_id': twitchData.id,
                        'social_accounts.twitch.$[elem].access_token': token.access_token,
                        'social_accounts.twitch.$[elem].refresh_token': token.refresh_token,
                        'social_accounts.twitch.$[elem].scope': scope,
                        'social_accounts.twitch.$[elem].expires_in': token.expires_in,
                        'social_accounts.twitch.$[elem].status': 'VERIFIED',
                        'social_accounts.twitch.$[elem].username': twitchData.login,
                    },
                };
                const options = {
                    arrayFilters: [{
                        'elem.broadcaster_id': twitchData.id,
                    }],
                    new: true,
                };
                next(null, conditions, updates, options, false);
            } else {
                const conditions = {
                    _id,
                    'social_accounts.twitch.token': tokenString,
                };
                const updates = {
                    $set: {
                        'social_accounts.twitch.$[elem].code': code,
                        'social_accounts.twitch.$[elem].broadcaster_id': twitchData.id,
                        'social_accounts.twitch.$[elem].access_token': token.access_token,
                        'social_accounts.twitch.$[elem].refresh_token': token.refresh_token,
                        'social_accounts.twitch.$[elem].scope': scope,
                        'social_accounts.twitch.$[elem].expires_in': token.expires_in,
                        'social_accounts.twitch.$[elem].status': 'VERIFIED',
                    },
                    $unset: {
                        'social_accounts.twitch.$[elem].token': 1,
                    },
                };
                const options = {
                    arrayFilters: [{
                        'elem.token': tokenString,
                    }],
                    new: true,
                };
                next(null, conditions, updates, options, true);
            }
        }, (conditions, updates, options, isTokenRemoved, next) => {
            userDBO.findOneAndUpdate(conditions, updates, options, false, (error, result) => {
                if (error) {
                    logger.error(error.message, error);
                    next({
                        error: userError.updateUserFailed,
                        message: 'Error while updating user.',
                    });
                } else if (result) {
                    next(null, isTokenRemoved);
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (isTokenRemoved, next) => {
            if (isTokenRemoved) {
                next(null, {
                    status: 200,
                });
            } else {
                userDBO.findOneAndUpdate({
                    _id,
                    media_space: mediaSpace,
                }, {
                    $pull: {
                        'social_accounts.twitch': {
                            token: tokenString,
                        },
                    },
                }, {
                    new: true,
                }, false, (error, result) => {
                    if (error) {
                        next({
                            error: userError.updateUserFailed,
                            message: 'Error while updating user.',
                        });
                    } else if (result) {
                        next(null, {
                            status: 200,
                        });
                    } else {
                        next({
                            error: userError.userDoesNotExist,
                            message: 'User does not exist.',
                        });
                    }
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateMediaNodeTwitchDestination = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
    } = req.params;

    let username = null;
    async.waterfall([
        (next) => {
            mediaSpaceDBO.findOne({
                _id: mediaSpace,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occurred while finding media space.',
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
            liveStreamDBO.findOne({
                media_space: mediaSpace,
                _id: liveStreamId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding live stream.',
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
            userDBO.findOne({
                _id,
                media_space: mediaSpace,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.twitch && result.social_accounts.twitch.length > 0) {
                        const twitchToken = result.social_accounts.twitch.find((account) => account.status === 'VERIFIED');
                        if (twitchToken) {
                            username = twitchToken.username;
                            next(null, liveStream, twitchToken);
                        } else {
                            next({
                                error: twitchError.getTokenFailed,
                                message: 'No twitch token found for user.',
                            });
                        }
                    } else {
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'No twitch token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (liveStream, twitchToken, next) => {
            try {
                fetch(`${config.twitch.apiUrl}/helix/streams/key?broadcaster_id=${twitchToken.broadcaster_id}`, {
                    method: 'GET',
                    headers: {
                        'Client-ID': config.twitch.clientId,
                        Authorization: `Bearer ${twitchToken.access_token}`,
                    },
                }).then((response) => response.json()).then((jsonResponse) => {
                    if (jsonResponse.data && jsonResponse.data.length > 0) {
                        next(null, liveStream, jsonResponse.data[0]);
                    } else {
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'Error while getting twitch stream key.',
                            data: jsonResponse,
                        });
                    }
                }).catch((error) => {
                    next({
                        error: twitchError.getTokenFailed,
                        message: 'Error while getting twitch stream key.',
                        data: error,
                    });
                });
            } catch (error) {
                next({
                    error: twitchError.getTokenFailed,
                    message: 'Error while getting twitch stream key.',
                    data: error,
                });
            }
        }, (liveStream, twitchStream, next) => {
            const streamDestinations = [];
            if (liveStream.configuration && liveStream.configuration.stream_destinations) {
                streamDestinations.push(...liveStream.configuration.stream_destinations);
            }
            const existingTwitchStream = streamDestinations.find((destination) => {
                if (destination.name === 'twitch' && destination.url === 'rtmp://live-tyo.twitch.tv/app' && destination.key === twitchStream.stream_key) {
                    return true;
                }
            });
            if (!existingTwitchStream) {
                streamDestinations.push({
                    name: 'twitch',
                    url: 'rtmp://live-tyo.twitch.tv/app',
                    key: twitchStream.stream_key,
                    username,
                });
            }
            liveStreamDBO.findOneAndUpdate({
                _id: liveStream._id,
            }, {
                $set: {
                    'configuration.stream_destinations': streamDestinations,
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

const broadcastTwitchLiveStream = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const {
        liveStreamId,
    } = req.params;
    const {
        startTime,
        duration,
        timezone,
        title,
        isRecurring,
        categoryId,
        broadcasterId,
    } = req.body;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: liveStreamId,
                media_space: mediaSpace,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error while finding live stream.',
                    });
                } else if (result) {
                    if (result.configuration && result.configuration.stream_destinations) {
                        const twitchDestination = result.configuration.stream_destinations.find((destination) => destination.name === 'twitch');
                        if (twitchDestination) {
                            next(null);
                        } else {
                            next({
                                error: liveStreamError.liveStreamDoesNotExist,
                                message: 'Twitch destination is not set for this live stream.',
                            });
                        }
                    } else {
                        next({
                            error: liveStreamError.liveStreamDoesNotExist,
                            message: 'Destinations are not set for this live stream.',
                        });
                    }
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpace,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.twitch && result.social_accounts.twitch.length > 0) {
                        const twitchToken = result.social_accounts.twitch.find((account) => account.status === 'VERIFIED' && account.broadcaster_id === broadcasterId);
                        if (twitchToken) {
                            next(null, twitchToken);
                        } else {
                            next({
                                error: twitchError.getTokenFailed,
                                message: 'No twitch token found for user.',
                            });
                        }
                    } else {
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'No twitch token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (twitchToken, next) => {
            const headers = {
                'Client-ID': config.twitch.clientId,
                Authorization: `Bearer ${twitchToken.access_token}`,
                'Content-Type': 'application/json',
            };
            const body = {
                start_time: startTime,
                duration,
                timezone,
                title,
                is_recurring: isRecurring,
            };
            if (categoryId) {
                body.category_id = categoryId;
            }

            fetch(`${config.twitch.apiUrl}/helix/schedule/segment?broadcaster_id=${twitchToken.broadcaster_id}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            }).then((response) => {
                console.log('response', response);
                if (response.status === 200) {
                    next(null, response.json());
                } else {
                    next({
                        error: twitchError.getTokenFailed,
                        message: 'Error occurred while creating twitch schedule segment.',
                        data: response,
                    });
                }
            }).catch((error) => {
                logger.error(error.message, error);
                next({
                    error: twitchError.getTokenFailed,
                    message: 'Error occurred while creating twitch schedule segment.',
                    data: error,
                });
            });
        }, (twitchScheduleSegment, next) => {
            twitchScheduleSegment.then((response) => {
                if (response && response.data && response.data.segments && response.data.segments.length > 0) {
                    const segment = response.data.segments[0];
                    console.log('response', response.data);
                    next(null, segment);
                } else {
                    console.log(response);
                    next({
                        error: twitchError.getTokenFailed,
                        message: 'Error while getting twitch schedule segment.',
                        data: response,
                    });
                }
            }).catch((error) => {
                console.log(error);
                logger.error(error.message, error);
                next({
                    error: twitchError.getTokenFailed,
                    message: 'Error while getting twitch schedule segment.',
                    data: error,
                });
            });
        }, (segment, next) => {
            const doc = {
                user: _id,
                media_space: mediaSpace,
                id: segment.id,
                title: segment.title,
                start_time: segment.start_time,
                end_time: segment.end_time,
                category_id: segment.category_id,
                is_recurring: segment.is_recurring,
                is_cancelled: segment.is_cancelled,
                timezone: timezone,
                duration: duration,
                broadcaster_id: broadcasterId,
            };
            twitchScheduleDBO.save(doc, false, (error, result) => {
                if (error) {
                    logger.error(error.message, error);
                    next({
                        error: twitchError.saveTwitchScheduleFailed,
                        message: 'Error occurred while saving twitch schedule.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result: result,
                    });
                } else {
                    next({
                        error: twitchError.scheduleSegmentDoesNotExist,
                        message: 'Twitch schedule does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateTwitchScheduleSegment = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const {
        segmentId,
    } = req.params;
    const {
        title,
        startTime,
        duration,
        isCancelled,
        broadcasterId,
    } = req.body;

    async.waterfall([
        (next) => {
            twitchScheduleDBO.findOne({
                id: segmentId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: twitchError.findTwitchScheduleSegmentFailed,
                        message: 'Error while finding twitch schedule segment.',
                    });
                } else if (result) {
                    if (result.is_cancelled) {
                        next({
                            error: twitchError.scheduleSegmentIsCancelled,
                            message: 'Twitch schedule segment is cancelled.',
                        });
                    } else if (result.start_time < new Date().toISOString()) {
                        next({
                            error: twitchError.scheduleSegmentIsPast,
                            message: 'Twitch schedule segment is in the past.',
                        });
                    } else if (startTime && result.is_recurring) {
                        next({
                            error: twitchError.scheduleSegmentIsRecurring,
                            message: 'Twitch schedule segment is recurring and can\'t update start time.',
                        });
                    } else {
                        next(null);
                    }
                } else {
                    next(null);
                }
            });
        }, (next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpace,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error while finding user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.twitch && result.social_accounts.twitch.length > 0) {
                        const twitchToken = result.social_accounts.twitch.find((account) => account.status === 'VERIFIED' && account.broadcaster_id === broadcasterId);
                        if (twitchToken) {
                            next(null, twitchToken);
                        } else {
                            next({
                                error: twitchError.getTokenFailed,
                                message: 'No twitch token found for user.',
                            });
                        }
                    } else {
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'No twitch token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (twitchToken, next) => {
            const updates = {};
            if (startTime) {
                updates.start_time = startTime;
            }
            if (duration) {
                updates.duration = duration;
            }
            if (title) {
                updates.title = title;
            }
            if (isCancelled) {
                updates.is_cancelled = isCancelled;
            }

            const headers = {
                'Client-ID': config.twitch.clientId,
                Authorization: `Bearer ${twitchToken.access_token}`,
                'Content-Type': 'application/json',
            };

            fetch(`${config.twitch.apiUrl}/helix/schedule/segment?broadcaster_id=${twitchToken.broadcaster_id}&id=${segmentId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(updates),
            }).then((response) => {
                if (response.status === 200) {
                    next(null);
                } else {
                    response.json().then((data) => {
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'Error while updating twitch schedule segment.',
                            data: data,
                        });
                    }).catch((error) => {
                        logger.error(error.message, error);
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'Error while updating twitch schedule segment.',
                            data: error,
                        });
                    });
                }
            });
        }, (next) => {
            const updates = {
                user: _id,
                media_space: mediaSpace,
                id: segmentId,
                broadcaster_id: broadcasterId,
            };
            if (startTime) {
                updates.start_time = startTime;
            }
            if (duration) {
                updates.duration = duration;
            }
            if (title) {
                updates.title = title;
            }
            if (isCancelled) {
                updates.is_cancelled = isCancelled;
            }
            twitchScheduleDBO.findOneAndUpdate({
                id: segmentId,
            }, updates, {
                new: true,
                upsert: true,
            }, false, (error, result) => {
                if (error) {
                    next({
                        error: twitchError.updateTwitchScheduleFailed,
                        message: 'Error while updating twitch schedule segment.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                    });
                } else {
                    next({
                        error: twitchError.updateTwitchScheduleFailed,
                        message: 'Twitch schedule segment does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const deleteTwitchScheduleSegment = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const {
        segmentId,
    } = req.params;
    const {
        broadcasterId,
    } = req.query;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpace,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error while finding user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.twitch && result.social_accounts.twitch.length > 0) {
                        const twitchToken = result.social_accounts.twitch.find((account) => account.status === 'VERIFIED' && account.broadcaster_id === broadcasterId);
                        if (twitchToken) {
                            next(null, twitchToken);
                        } else {
                            next({
                                error: twitchError.getTokenFailed,
                                message: 'No twitch token found for user.',
                            });
                        }
                    } else {
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'No twitch token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (twitchToken, next) => {
            const headers = {
                'Client-ID': config.twitch.clientId,
                Authorization: `Bearer ${twitchToken.access_token}`,
                'Content-Type': 'application/json',
            };

            fetch(`${config.twitch.apiUrl}/helix/schedule/segment?broadcaster_id=${twitchToken.broadcaster_id}&id=${segmentId}`, {
                method: 'DELETE',
                headers,
            }).then((response) => {
                if (response.status === 200) {
                    next(null);
                } else {
                    response.json().then((data) => {
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'Error while deleting twitch schedule segment.',
                            data: data,
                        });
                    }).catch((error) => {
                        logger.error(error.message, error);
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'Error while deleting twitch schedule segment.',
                            data: error,
                        });
                    });
                }
            });
        }, (next) => {
            twitchScheduleDBO.findOneAndDelete({
                id: segmentId,
            }, {}, false, (error) => {
                if (error) {
                    next({
                        error: twitchError.updateTwitchScheduleFailed,
                        message: 'Error while updating twitch schedule segment.',
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

const getTwitchLiveStreamBroadcasts = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const {
        broadcasterId,
    } = req.query;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpace,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error while finding user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.twitch && result.social_accounts.twitch.length > 0) {
                        const twitchToken = result.social_accounts.twitch.find((account) => account.status === 'VERIFIED' && account.broadcaster_id === broadcasterId);
                        if (twitchToken) {
                            next(null, twitchToken);
                        } else {
                            next({
                                error: twitchError.getTokenFailed,
                                message: 'No twitch token found for user.',
                            });
                        }
                    } else {
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'No twitch token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (twitchToken, next) => {
            fetch(`${config.twitch.apiUrl}/helix/schedule?broadcaster_id=${twitchToken.broadcaster_id}`, {
                method: 'GET',
                headers: {
                    'Client-ID': config.twitch.clientId,
                    Authorization: `Bearer ${twitchToken.access_token}`,
                },
            }).then((response) => {
                if (response.status === 200) {
                    next(null, response.json());
                } else {
                    response.json().then((data) => {
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'Error while getting twitch schedule.',
                            data: data,
                        });
                    }).catch((error) => {
                        logger.error(error.message, error);
                        next({
                            error: twitchError.getTokenFailed,
                            message: 'Error while getting twitch schedule.',
                            data: error,
                        });
                    });
                }
            });
        }, (twitchSchedule, next) => {
            twitchSchedule.then((response) => {
                if (response && response.data && response.data.segments && response.data.segments.length > 0) {
                    next(null, {
                        status: 200,
                        result: response.data.segments,
                    });
                } else {
                    next({
                        error: twitchError.getTokenFailed,
                        message: 'Error while getting twitch schedule.',
                        data: response,
                    });
                }
            }).catch((error) => {
                logger.error(error.message, error);
                next({
                    error: twitchError.getTokenFailed,
                    message: 'Error while getting twitch schedule.',
                    data: error,
                });
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

module.exports = {
    getAuthUrl,
    handleCallback,
    updateMediaNodeTwitchDestination,
    broadcastTwitchLiveStream,
    updateTwitchScheduleSegment,
    deleteTwitchScheduleSegment,
    getTwitchLiveStreamBroadcasts,
};
