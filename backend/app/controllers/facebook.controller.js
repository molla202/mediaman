const async = require('async');
const fetch = require('node-fetch');
const facebookScheduleSegmentDBO = require('../dbos/facebook_schedule.dbo');
const facebookError = require('../errors/facebook.error');
const liveStreamDBO = require('../dbos/live_stream.dbo');
const liveStreamError = require('../errors/live_stream.error');
const userDBO = require('../dbos/user.dbo');
const userError = require('../errors/user.error');
const stringUtils = require('../utils/string.util');
const config = require('../../config');
const processJSONResponse = require('../utils/response.util');
const logger = require('../../logger');

const scopes = ['email', 'publish_video'];

const getAuthUrl = (req, res) => {
    const { _id } = req.user;

    async.waterfall([
        (next) => {
            const randomString = stringUtils.randomString(20);
            const updates = {
                $push: {
                    'social_accounts.facebook': {
                        token: randomString,
                        status: 'UNVERIFIED',
                    },
                },
            };
            userDBO.findOneAndUpdate({
                _id,
            }, updates, {
                new: true,
            }, false, (error, user) => {
                if (error) {
                    next({
                        error: userError.updateUserFailed,
                        message: 'Error while updating user.',
                    });
                } else if (user) {
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
                    client_id: config.facebook.appId,
                    redirect_uri: config.facebook.redirectUri,
                    scope: scopes.join(','),
                    state: JSON.stringify({
                        _id,
                        token,
                    }),
                });
                const authUrl = `${config.facebook.authUrl}/v22.0/dialog/oauth?${params.toString()}`;
                next(null, {
                    status: 200,
                    result: {
                        url: authUrl,
                    },
                });
            } catch (error) {
                next({
                    error: facebookError.getAuthUrlFailed,
                    message: 'Error while getting auth url for facebook login.',
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const handleCallback = (req, res) => {
    const { _id, media_space: mediaSpace } = req.user;
    const { code, state } = req.query;
    const { token } = JSON.parse(state);

    async.waterfall([
        (next) => {
            try {
                const params = new URLSearchParams({
                    client_id: config.facebook.appId,
                    redirect_uri: config.facebook.redirectUri,
                    client_secret: config.facebook.appSecret,
                    code,
                });

                fetch(`${config.facebook.apiUrl}/v22.0/oauth/access_token?${params.toString()}`, {
                    method: 'GET',
                }).then((response) => response.json())
                    .then((data) => {
                        next(null, data);
                    });
            } catch (error) {
                next({
                    error: facebookError.getAccessTokenFailed,
                    message: 'Error while getting access token for facebook login.',
                    data: error,
                });
            }
        }, (fbData, next) => {
            try {
                const params = new URLSearchParams({
                    access_token: fbData.access_token,
                    fields: 'id,name',
                });

                fetch(`${config.facebook.apiUrl}/v22.0/me?${params.toString()}`, {
                    method: 'GET',
                }).then((response) => response.json())
                    .then((data) => {
                        next(null, fbData, data);
                    });
            } catch (error) {
                next({
                    error: facebookError.getUserInfoFailed,
                    message: 'Error while getting user info for facebook login.',
                    data: error,
                });
            }
        }, (fbData, userInfo, next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpace._id,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.facebook && result.social_accounts.facebook.length > 0) {
                        const index = result.social_accounts.facebook.findIndex(
                            (account) => account.user_id === userInfo.id && account.status === 'VERIFIED',
                        );
                        next(null, fbData, userInfo, index);
                    } else {
                        next(null, fbData, userInfo, -1);
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (fbData, userInfo, index, next) => {
            if (index !== -1) {
                const conditions = {
                    _id,
                    'social_accounts.facebook.user_id': userInfo.id,
                };
                const updates = {
                    $set: {
                        'social_accounts.facebook.$[elem].code': code,
                        'social_accounts.facebook.$[elem].scope': scopes,
                        'social_accounts.facebook.$[elem].user_id': userInfo.id,
                        'social_accounts.facebook.$[elem].access_token': fbData.access_token,
                        'social_accounts.facebook.$[elem].refresh_token': fbData.refresh_token,
                        'social_accounts.facebook.$[elem].expires_in': fbData.expires_in,
                        'social_accounts.facebook.$[elem].status': 'VERIFIED',
                    },
                };
                const options = {
                    arrayFilters: [{
                        'elem.user_id': userInfo.id,
                    }],
                    new: true,
                };
                next(null, conditions, updates, options, false);
            } else {
                const conditions = {
                    _id,
                    'social_accounts.facebook.token': token,
                };
                const updates = {
                    $set: {
                        'social_accounts.facebook.$[elem].code': code,
                        'social_accounts.facebook.$[elem].scope': scopes,
                        'social_accounts.facebook.$[elem].user_id': userInfo.id,
                        'social_accounts.facebook.$[elem].access_token': fbData.access_token,
                        'social_accounts.facebook.$[elem].refresh_token': fbData.refresh_token,
                        'social_accounts.facebook.$[elem].expires_in': fbData.expires_in,
                        'social_accounts.facebook.$[elem].status': 'VERIFIED',
                    },
                    $unset: {
                        'social_accounts.facebook.$[elem].token': 1,
                    },
                };
                const options = {
                    arrayFilters: [{
                        'elem.token': token,
                    }],
                    new: true,
                };
                next(null, conditions, updates, options, true);
            }
        }, (conditions, updates, options, isTokenRemoved, next) => {
            userDBO.findOneAndUpdate(conditions, updates, options, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.updateUserFailed,
                        message: 'Error occurred while updating user.',
                        data: error,
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
                    'social_accounts.facebook.token': token,
                }, {
                    $pull: {
                        'social_accounts.facebook': {
                            token: token,
                        },
                    },
                }, {}, false, (error, result) => {
                    if (error) {
                        logger.error(error.message);
                        next({
                            error: userError.updateUserFailed,
                            message: 'Error occurred while updating user.',
                            data: error,
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

const updateMediaNodeFacebookDestination = (req, res) => {
    const { liveStreamId } = req.params;
    const { _id, media_space: mediaSpace } = req.user;
    const {
        scheduleId,
    } = req.body;

    async.waterfall([
        (next) => {
            facebookScheduleSegmentDBO.findOne({
                user: _id,
                media_space: mediaSpace._id,
                id: scheduleId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: facebookError.findUserLoginFailed,
                        message: 'Error while finding user login for facebook login.',
                        data: error,
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        error: facebookError.scheduleSegmentDoesNotExist,
                        message: 'Schedule segment does not exist.',
                    });
                }
            });
        }, (schedule, next) => {
            liveStreamDBO.findOne({
                _id: liveStreamId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error while finding live stream.',
                        data: error,
                    });
                } else if (result) {
                    next(null, schedule, result);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (schedule, liveStream, next) => {
            const fullUrl = schedule.stream_url;
            const lastSlashIndex = fullUrl.lastIndexOf('/');
            const baseUrl = fullUrl.substring(0, lastSlashIndex);
            const streamKey = fullUrl.substring(lastSlashIndex + 1);

            const streamDestinations = [];
            if (liveStream.configuration && liveStream.configuration.stream_destinations) {
                streamDestinations.push(...liveStream.configuration.stream_destinations);
            }
            const existingFacebookStream = streamDestinations.find((destination) => {
                if (destination.name === 'facebook' && destination.url === baseUrl && destination.key === streamKey) {
                    return true;
                }
            });
            if (!existingFacebookStream) {
                streamDestinations.push({
                    name: 'facebook',
                    url: baseUrl,
                    key: streamKey,
                    id: schedule.id,
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
                        result: result,
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

const createFacebookSchedule = (req, res) => {
    const { _id, media_space: mediaSpace } = req.user;
    const {
        title,
        description,
        scheduleStartTime,
        startImmediately,
        userId,
    } = req.body;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: facebookError.findUserLoginFailed,
                        message: 'Error while finding user login for facebook login.',
                        data: error,
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.facebook && result.social_accounts.facebook.length > 0) {
                        const facebookToken = result.social_accounts.facebook.find((account) => account.user_id === userId && account.status === 'VERIFIED');
                        if (facebookToken) {
                            next(null, facebookToken);
                        } else {
                            next({
                                error: facebookError.findUserLoginFailed,
                                message: 'User login not found for facebook login.',
                            });
                        }
                    } else {
                        next({
                            error: facebookError.findUserLoginFailed,
                            message: 'User login not found for facebook login.',
                        });
                    }
                } else {
                    next({
                        message: 'User login not found for facebook login.',
                    });
                }
            });
        }, (facebookToken, next) => {
            const searchParams = {
                access_token: facebookToken.access_token,
                title,
                description,
            };
            if (startImmediately) {
                searchParams.status = 'LIVE_NOW';
            } else {
                searchParams.event_params = JSON.stringify({
                    start_time: Math.floor(new Date(scheduleStartTime).getTime() / 1000),
                });
            }
            const params = new URLSearchParams(searchParams);

            fetch(`${config.facebook.apiUrl}/v22.0/${facebookToken.user_id}/live_videos?${params.toString()}`, {
                method: 'POST',
            }).then((response) => response.json())
                .then((data) => {
                    if (data.id) {
                        next(null, data);
                    } else {
                        next({
                            error: facebookError.createFacebookScheduleFailed,
                            message: 'Error while creating facebook schedule.',
                            data: data,
                        });
                    }
                })
                .catch((error) => {
                    next({
                        error: facebookError.createFacebookScheduleFailed,
                        message: 'Unhandled error while creating facebook schedule.',
                        data: error,
                    });
                });
        }, (facebookSchedule, next) => {
            const doc = {
                id: facebookSchedule.id,
                start_time: scheduleStartTime,
                title,
                description,
                stream_url: facebookSchedule.stream_url,
                user_id: userId,
                user: _id,
                media_space: mediaSpace._id,
            };
            facebookScheduleSegmentDBO.save(doc, false, (error, result) => {
                if (error) {
                    next({
                        error: facebookError.createFacebookScheduleFailed,
                        message: 'Error while creating facebook schedule.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result: result,
                    });
                } else {
                    next({
                        error: facebookError.scheduleSegmentDoesNotExist,
                        message: 'Facebook schedule segment does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const reScheduleFacebookSchedule = (req, res) => {
    const { scheduleId } = req.params;
    const { _id, media_space: mediaSpace } = req.user;
    const {
        scheduleStartTime,
        startImmediately,
        title,
        description,
    } = req.body;

    async.waterfall([
        (next) => {
            facebookScheduleSegmentDBO.findOne({
                user: _id,
                media_space: mediaSpace._id,
                id: scheduleId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: facebookError.findUserLoginFailed,
                        message: 'Error while finding user login for facebook login.',
                        data: error,
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        error: facebookError.scheduleSegmentDoesNotExist,
                        message: 'Schedule segment does not exist.',
                    });
                }
            });
        }, (facebookSchedule, next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpace._id,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: facebookError.findUserLoginFailed,
                        message: 'Error while finding user login for facebook login.',
                        data: error,
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.facebook && result.social_accounts.facebook.length > 0) {
                        const facebookToken = result.social_accounts.facebook.find((account) => account.user_id === facebookSchedule.user_id && account.status === 'VERIFIED');
                        if (facebookToken) {
                            next(null, facebookSchedule, facebookToken);
                        } else {
                            next({
                                error: facebookError.findUserLoginFailed,
                                message: 'User login not found for facebook login.',
                            });
                        }
                    } else {
                        next({
                            error: facebookError.findUserLoginFailed,
                            message: 'User login not found for facebook login.',
                        });
                    }
                } else {
                    next({
                        error: facebookError.findUserLoginFailed,
                        message: 'User login not found for facebook login.',
                    });
                }
            });
        }, (facebookSchedule, facebookToken, next) => {
            const searchParams = {
                access_token: facebookToken.access_token,
                id: facebookSchedule.id,
            };
            if (title) {
                searchParams.title = title;
            }
            if (description) {
                searchParams.description = description;
            }
            if (startImmediately) {
                searchParams.status = 'LIVE_NOW';
                searchParams.event_params = JSON.stringify({
                    start_time: Math.floor(new Date().getTime() / 1000) + 10,
                });
            } else {
                searchParams.event_params = JSON.stringify({
                    start_time: Math.floor(new Date(scheduleStartTime).getTime() / 1000),
                });
            }
            const params = new URLSearchParams(searchParams);

            fetch(`${config.facebook.apiUrl}/v22.0/${facebookSchedule.id}`, {
                method: 'POST',
                body: params.toString(),
            }).then((response) => response.json())
                .then((data) => {
                    if (data.id) {
                        next(null);
                    } else {
                        next({
                            error: facebookError.broadcastLiveStreamFailed,
                            message: 'Error while broadcasting live stream.',
                            data: data,
                        });
                    }
                })
                .catch((error) => {
                    next({
                        error: facebookError.broadcastLiveStreamFailed,
                        message: 'Unhandled error while broadcasting live stream.',
                        data: error,
                    });
                });
        }, (next) => {
            const updates = {};
            const condition = {
                user: _id,
                media_space: mediaSpace._id,
                id: scheduleId,
            };
            updates.$set = {
                start_time: scheduleStartTime,
            };
            if (title) {
                updates.$set.title = title;
            }
            if (description) {
                updates.$set.description = description;
            }
            facebookScheduleSegmentDBO.findOneAndUpdate(condition, updates, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    next({
                        error: facebookError.updateFacebookScheduleFailed,
                        message: 'Error while updating facebook schedule.',
                        data: error,
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result: result,
                    });
                } else {
                    next({
                        error: facebookError.scheduleSegmentDoesNotExist,
                        message: 'Facebook schedule not found.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getFacebookLiveStreamBroadcasts = (req, res) => {
    const { _id, media_space: mediaSpace } = req.user;
    const {
        userId,
    } = req.query;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpace._id,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: facebookError.findUserLoginFailed,
                        message: 'Error while finding user login for facebook login.',
                        data: error,
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.facebook && result.social_accounts.facebook.length > 0) {
                        const facebookToken = result.social_accounts.facebook.find((account) => account.user_id === userId && account.status === 'VERIFIED');
                        if (facebookToken) {
                            next(null, facebookToken);
                        } else {
                            next({
                                error: facebookError.findUserLoginFailed,
                                message: 'User login not found for facebook login.',
                            });
                        }
                    } else {
                        next({
                            error: facebookError.findUserLoginFailed,
                            message: 'User login not found for facebook login.',
                        });
                    }
                } else {
                    next({
                        error: facebookError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (facebookToken, next) => {
            const searchParams = {
                access_token: facebookToken.access_token,
            };
            if (userId) {
                searchParams.user_id = userId;
            }
            const params = new URLSearchParams(searchParams);
            console.log(params.toString());

            fetch(`${config.facebook.apiUrl}/v22.0/${facebookToken.user_id}/live_videos?${params.toString()}`, {
                method: 'GET',
            }).then((response) => response.json())
                .then((data) => {
                    next(null, {
                        status: 200,
                        result: data,
                    });
                })
                .catch((error) => {
                    next({
                        error: facebookError.getFacebookLiveStreamBroadcastsFailed,
                        message: 'Unhandled error while getting facebook live stream broadcasts.',
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
    updateMediaNodeFacebookDestination,
    createFacebookSchedule,
    reScheduleFacebookSchedule,
    getFacebookLiveStreamBroadcasts,
};
