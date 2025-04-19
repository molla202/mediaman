const async = require('async');
const path = require('path');
// eslint-disable-next-line camelcase
const { google, youtube_v3 } = require('googleapis');
const assetDBO = require('../dbos/asset.dbo');
const assetError = require('../errors/asset.error');
const assetDistributionDBO = require('../dbos/asset_distribution.dbo');
const assetDistributionError = require('../errors/asset_distribution.error');
const mediaSpaceDBO = require('../dbos/media_space.dbo');
const mediaSpaceError = require('../errors/media_space.error');
const liveStreamDBO = require('../dbos/live_stream.dbo');
const liveStreamError = require('../errors/live_stream.error');
const youtubeError = require('../errors/youtube.error');
const userDBO = require('../dbos/user.dbo');
const userError = require('../errors/user.error');
const processJSONResponse = require('../utils/response.util');
const stringUtil = require('../utils/string.util');
const config = require('../../config');
const { uploadYoutubeVideo } = require('../helpers/youtube.helper');
const logger = require('../../logger');

const oAuth2Client = new google.auth.OAuth2(
    config.youtube.clientId,
    config.youtube.clientSecret,
    config.youtube.redirectUri,
);

const getAuthUrl = (req, res) => {
    const { _id, media_space: mediaSpaceId } = req.user;
    const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.force-ssl',
        'https://www.googleapis.com/auth/youtube.readonly',
    ];
    async.waterfall([
        (next) => {
            const token = stringUtil.randomString(20);
            const updates = {
                $push: {
                    'social_accounts.youtube': {
                        token,
                        status: 'UNVERIFIED',
                    },
                },
            };
            userDBO.findOneAndUpdate({
                _id,
                media_space: mediaSpaceId,
            }, updates, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: youtubeError.getAuthUrlFailed,
                        message: 'Error while getting auth url for youtube login.',
                    });
                } else if (result) {
                    next(null, token);
                } else {
                    next({
                        error: youtubeError.getAuthUrlFailed,
                        message: 'Error while getting auth url for youtube login.',
                    });
                }
            });
        }, (token, next) => {
            try {
                const url = oAuth2Client.generateAuthUrl({
                    access_type: 'offline',
                    scope: scopes,
                    state: JSON.stringify({
                        _id,
                        token,
                    }),
                });
                next(null, {
                    status: 200,
                    result: {
                        url,
                    },
                });
            } catch (error) {
                next({
                    error: youtubeError.getAuthUrlFailed,
                    message: 'Error while getting auth url for youtube login.',
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const handleCallback = (req, res) => {
    const { code, scope, state } = req.query;
    const { _id, media_space: mediaSpaceId } = req.user;
    const { token: tokenId } = JSON.parse(state);

    async.waterfall([
        (next) => {
            oAuth2Client.getToken(code).then((token) => {
                next(null, token.tokens);
            }).catch((err) => {
                next({
                    error: youtubeError.getTokenFailed,
                    message: 'Error while getting token.',
                    data: err,
                });
            });
        }, (token, next) => {
            const client = new google.auth.OAuth2(
                config.youtube.clientId,
                config.youtube.clientSecret,
                config.youtube.redirectUri,
            );
            client.setCredentials(token);

            const channel = new youtube_v3.Resource$Channels({
                _options: {
                    auth: client,
                },
            });
            channel.list({
                part: ['id', 'snippet'],
                mine: true,
            }, (error, result) => {
                if (error) {
                    next({
                        error: youtubeError.getChannelFailed,
                        message: 'Error while getting channel.',
                        data: error,
                    });
                } else if (result && result.data && result.data.items && result.data.items.length > 0) {
                    next(null, token, result.data.items[0]);
                } else {
                    next({
                        error: youtubeError.getChannelFailed,
                        message: 'No channel found.',
                    });
                }
            });
        }, (token, channel, next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpaceId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.youtube && result.social_accounts.youtube.length > 0) {
                        const index = result.social_accounts.youtube.findIndex(
                            (account) => account.channel_id === channel.id && account.status === 'VERIFIED',
                        );
                        next(null, token, channel, index);
                    } else {
                        next({
                            error: youtubeError.tokenVerificationFailed,
                            message: 'Youtube token verification failed.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (token, channel, index, next) => {
            if (index !== -1) {
                const conditions = {
                    _id,
                    media_space: mediaSpaceId,
                    'social_accounts.youtube.channel_id': channel.id,
                };
                const updates = {
                    $set: {
                        'social_accounts.youtube.$[elem].channel_id': channel.id,
                        'social_accounts.youtube.$[elem].channel_name': channel.snippet.title,
                        'social_accounts.youtube.$[elem].thumbnail_url': channel.snippet.thumbnails,
                        'social_accounts.youtube.$[elem].youtube_url': `https://www.youtube.com/${channel.snippet.customUrl}`,
                        'social_accounts.youtube.$[elem].access_token': token.access_token,
                        'social_accounts.youtube.$[elem].refresh_token': token.refresh_token,
                        'social_accounts.youtube.$[elem].scope': scope,
                        'social_accounts.youtube.$[elem].code': code,
                        'social_accounts.youtube.$[elem].expiry_date': token.expiry_date,
                        'social_accounts.youtube.$[elem].status': 'VERIFIED',
                    },
                };
                const options = {
                    arrayFilters: [{
                        'elem.channel_id': channel.id,
                    }],
                    new: true,
                };
                next(null, conditions, updates, options, false);
            } else {
                const conditions = {
                    _id,
                    media_space: mediaSpaceId,
                    'social_accounts.youtube.token': tokenId,
                };
                const updates = {
                    $set: {
                        'social_accounts.youtube.$[elem].channel_id': channel.id,
                        'social_accounts.youtube.$[elem].channel_name': channel.snippet.title,
                        'social_accounts.youtube.$[elem].thumbnail_url': channel.snippet.thumbnails,
                        'social_accounts.youtube.$[elem].youtube_url': `https://www.youtube.com/${channel.snippet.customUrl}`,
                        'social_accounts.youtube.$[elem].access_token': token.access_token,
                        'social_accounts.youtube.$[elem].refresh_token': token.refresh_token,
                        'social_accounts.youtube.$[elem].scope': scope,
                        'social_accounts.youtube.$[elem].code': code,
                        'social_accounts.youtube.$[elem].expiry_date': token.expiry_date,
                        'social_accounts.youtube.$[elem].status': 'VERIFIED',
                    },
                    $unset: {
                        'social_accounts.youtube.$[elem].token': 1,
                    },
                };
                const options = {
                    arrayFilters: [{
                        'elem.token': tokenId,
                    }],
                    new: true,
                };
                next(null, conditions, updates, options, true);
            }
        }, (conditions, updates, options, isTokenUpdated, next) => {
            userDBO.findOneAndUpdate(conditions, updates, options, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: userError.updateUserFailed,
                        message: 'Error occurred while updating user.',
                    });
                } else if (result) {
                    next(null, isTokenUpdated);
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (isTokenUpdated, next) => {
            if (isTokenUpdated) {
                next(null, {
                    status: 200,
                });
            } else {
                userDBO.findOneAndUpdate({
                    _id,
                    media_space: mediaSpaceId,
                    'social_accounts.youtube.token': tokenId,
                }, {
                    $pull: {
                        'social_accounts.youtube': {
                            token: tokenId,
                        },
                    },
                }, {
                    new: true,
                    arrayFilters: [{
                        'elem.token': tokenId,
                    }],
                }, false, (error, result) => {
                    if (error) {
                        logger.error(error.message);
                        next({
                            error: userError.updateUserFailed,
                            message: 'Error occurred while updating user.',
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

const getLiveStreams = (req, res) => {
    const { _id, media_space: mediaSpaceId } = req.user;
    const {
        id,
        pageToken,
        maxResults = 50,
        channelId,
    } = req.query;

    const conditions = {
        part: ['id', 'snippet', 'cdn', 'status'],
        maxResults,
    };

    if (id) {
        conditions.id = id;
    } else {
        conditions.mine = true;
    }

    if (pageToken) {
        conditions.pageToken = pageToken;
    }

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpaceId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.youtube && result.social_accounts.youtube.length > 0) {
                        const account = result.social_accounts.youtube.find(
                            (account) => account.channel_id === channelId && account.status === 'VERIFIED',
                        );
                        if (account && account.expiry_date > Date.now()) {
                            next(null, account);
                        } else {
                            next({
                                error: youtubeError.tokenExpired,
                                message: 'Youtube token does not exist or expired.',
                            });
                        }
                    } else {
                        next({
                            error: youtubeError.findUserLoginFailed,
                            message: 'No youtube token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (account, next) => {
            const client = new google.auth.OAuth2(
                config.youtube.clientId,
                config.youtube.clientSecret,
                config.youtube.redirectUri,
            );
            client.setCredentials({
                access_token: account.access_token,
                scope: account.scope,
                expiry_date: account.expiry_date,
                token_type: 'Bearer',
            });
            next(null, client);
        }, (client, next) => {
            const youtube = new youtube_v3.Resource$Livestreams({
                _options: {
                    auth: client,
                },
            });
            youtube.list(conditions, (error, result) => {
                if (error) {
                    next({
                        error: youtubeError.getLiveStreamsFailed,
                        message: 'Error occurred while getting live streams.',
                        data: error,
                    });
                } else if (result && result.data && result.data.items && result.data.items.length > 0) {
                    next(null, {
                        status: 200,
                        result: {
                            list: result.data.items,
                            nextPageToken: result.data.nextPageToken || '',
                            prevPageToken: result.data.prevPageToken || '',
                        },
                    });
                } else {
                    next({
                        error: youtubeError.getLiveStreamsDoesNotExist,
                        message: 'No live streams found.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addLiveStream = (req, res) => {
    const {
        cdn,
        snippet,
        contentDetails,
        channelId,
    } = req.body;

    const { _id, media_space: mediaSpaceId } = req.user;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpaceId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.youtube && result.social_accounts.youtube.length > 0) {
                        const account = result.social_accounts.youtube.find(
                            (account) => account.channel_id === channelId && account.status === 'VERIFIED',
                        );
                        if (account && account.expiry_date > Date.now()) {
                            next(null, account);
                        } else {
                            next({
                                error: youtubeError.tokenExpired,
                                message: 'Youtube token does not exist or expired.',
                            });
                        }
                    } else {
                        next({
                            error: youtubeError.findUserLoginFailed,
                            message: 'No youtube token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (account, next) => {
            const client = new google.auth.OAuth2(
                config.youtube.clientId,
                config.youtube.clientSecret,
                config.youtube.redirectUri,
            );
            client.setCredentials({
                access_token: account.access_token,
                scope: account.scope,
                expiry_date: account.expiry_date,
                token_type: 'Bearer',
            });
            next(null, client);
        }, (client, next) => {
            const doc = {
                part: ['id', 'snippet', 'cdn', 'status'],
                requestBody: {
                    cdn,
                    snippet,
                    contentDetails,
                },
            };
            const youtube = new youtube_v3.Resource$Livestreams({
                _options: {
                    auth: client,
                },
            });
            youtube.insert(doc, (error, result) => {
                if (error) {
                    next({
                        error: youtubeError.addLiveStreamFailed,
                        message: 'Error occurred while adding live stream.',
                        data: error,
                    });
                } else if (result && result.data && result.data.id) {
                    next(null, {
                        status: 200,
                        result: {
                            stream: result.data,
                        },
                    });
                } else {
                    next({
                        error: youtubeError.addLiveStreamFailed,
                        message: 'Error occurred while adding live stream.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getLiveBroadcasts = (req, res) => {
    const { _id, media_space: mediaSpaceId } = req.user;
    const {
        id,
        pageToken,
        maxResults = 50,
        broadcastStatus,
        broadcastType,
        channelId,
    } = req.query;

    const conditions = {
        part: ['id', 'snippet', 'contentDetails', 'monetizationDetails', 'status'],
        maxResults,
    };

    if (pageToken) {
        conditions.pageToken = pageToken;
    }

    if (broadcastType) {
        conditions.broadcastType = broadcastType;
    }

    if (id) {
        conditions.id = id;
    } else if (broadcastStatus) {
        conditions.broadcastStatus = broadcastStatus;
    } else {
        conditions.mine = true;
    }

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpaceId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.youtube && result.social_accounts.youtube.length > 0) {
                        const account = result.social_accounts.youtube.find(
                            (account) => account.channel_id === channelId && account.status === 'VERIFIED',
                        );
                        if (account && account.expiry_date > Date.now()) {
                            next(null, account);
                        } else {
                            next({
                                error: youtubeError.tokenExpired,
                                message: 'Youtube token does not exist or expired.',
                            });
                        }
                    } else {
                        next({
                            error: youtubeError.findUserLoginFailed,
                            message: 'No youtube token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (account, next) => {
            const client = new google.auth.OAuth2(
                config.youtube.clientId,
                config.youtube.clientSecret,
                config.youtube.redirectUri,
            );
            client.setCredentials({
                access_token: account.access_token,
                scope: account.scope,
                expiry_date: account.expiry_date,
                token_type: 'Bearer',
            });
            next(null, client);
        }, (client, next) => {
            const youtube = new youtube_v3.Resource$Livebroadcasts({
                _options: {
                    auth: client,
                },
            });
            youtube.list(conditions, (error, result) => {
                if (error) {
                    next({
                        error: youtubeError.getLiveBroadcastsFailed,
                        message: 'Error occurred while getting live broadcasts.',
                        data: error,
                    });
                } else if (result && result.data && result.data.items && result.data.items.length > 0) {
                    next(null, {
                        status: 200,
                        result: {
                            list: result.data.items,
                            nextPageToken: result.data.nextPageToken || '',
                            prevPageToken: result.data.prevPageToken || '',
                        },
                    });
                } else {
                    next({
                        error: youtubeError.liveBroadcastsDoesNotExist,
                        message: 'No live broadcasts found.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addLiveBroadcast = (req, res) => {
    const {
        status,
        snippet,
        contentDetails,
        channelId,
    } = req.body;

    const { _id, media_space: mediaSpaceId } = req.user;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpaceId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.youtube && result.social_accounts.youtube.length > 0) {
                        const account = result.social_accounts.youtube.find(
                            (account) => account.channel_id === channelId && account.status === 'VERIFIED',
                        );
                        if (account && account.expiry_date > Date.now()) {
                            next(null, account);
                        } else {
                            next({
                                error: youtubeError.tokenExpired,
                                message: 'Youtube token does not exist or expired.',
                            });
                        }
                    } else {
                        next({
                            error: youtubeError.findUserLoginFailed,
                            message: 'No youtube token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (account, next) => {
            const client = new google.auth.OAuth2(
                config.youtube.clientId,
                config.youtube.clientSecret,
                config.youtube.redirectUri,
            );
            client.setCredentials({
                access_token: account.access_token,
                scope: account.scope,
                expiry_date: account.expiry_date,
                token_type: 'Bearer',
            });
            next(null, client);
        }, (client, next) => {
            const doc = {
                part: ['id', 'snippet', 'contentDetails', 'status'],
                requestBody: {
                    status,
                    snippet,
                    contentDetails,
                },
            };
            const youtube = new youtube_v3.Resource$Livebroadcasts({
                _options: {
                    auth: client,
                },
            });
            youtube.insert(doc, (error, result) => {
                if (error) {
                    next({
                        error: youtubeError.addLiveBroadcastFailed,
                        message: 'Error occurred while adding live broadcast.',
                        data: error,
                    });
                } else if (result && result.data && result.data.id) {
                    next(null, {
                        status: 200,
                        result: {
                            broadcast: result.data,
                        },
                    });
                } else {
                    next({
                        error: youtubeError.addLiveBroadcastFailed,
                        message: 'Error occurred while adding live broadcast.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateLiveBroadcast = (req, res) => {
    const { broadcastId } = req.params;
    const { _id, media_space: mediaSpaceId } = req.user;
    const {
        status,
        snippet,
        contentDetails,
        channelId,
    } = req.body;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpaceId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.youtube && result.social_accounts.youtube.length > 0) {
                        const account = result.social_accounts.youtube.find(
                            (account) => account.channel_id === channelId && account.status === 'VERIFIED',
                        );
                        if (account && account.expiry_date > Date.now()) {
                            next(null, account);
                        } else {
                            next({
                                error: youtubeError.tokenExpired,
                                message: 'Youtube token does not exist or expired.',
                            });
                        }
                    } else {
                        next({
                            error: youtubeError.findUserLoginFailed,
                            message: 'No youtube token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (account, next) => {
            const client = new google.auth.OAuth2(
                config.youtube.clientId,
                config.youtube.clientSecret,
                config.youtube.redirectUri,
            );
            client.setCredentials({
                access_token: account.access_token,
                scope: account.scope,
                expiry_date: account.expiry_date,
                token_type: 'Bearer',
            });
            next(null, client);
        }, (client, next) => {
            const updates = {
                part: ['id', 'snippet', 'contentDetails', 'status'],
                id: broadcastId,
                requestBody: {
                    status,
                    snippet,
                    contentDetails,
                },
            };
            const youtube = new youtube_v3.Resource$Livebroadcasts({
                _options: {
                    auth: client,
                },
            });
            youtube.update(updates, (error, result) => {
                if (error) {
                    next({
                        error: youtubeError.updateLiveBroadcastFailed,
                        message: 'Error occurred while updating live broadcast.',
                        data: error,
                    });
                } else if (result && result.data && result.data.id) {
                    next(null, {
                        status: 200,
                        result: {
                            broadcast: result.data,
                        },
                    });
                } else {
                    next({
                        error: youtubeError.updateLiveBroadcastFailed,
                        message: 'Error occurred while updating live broadcast.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const bindAndUnbindLiveBroadcast = (req, res) => {
    const { broadcastId } = req.params;
    const { _id, media_space: mediaSpaceId } = req.user;
    const {
        streamId,
        channelId,
    } = req.body;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpaceId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.youtube && result.social_accounts.youtube.length > 0) {
                        const account = result.social_accounts.youtube.find(
                            (account) => account.channel_id === channelId && account.status === 'VERIFIED',
                        );
                        if (account && account.expiry_date > Date.now()) {
                            next(null, account);
                        } else {
                            next({
                                error: youtubeError.tokenExpired,
                                message: 'Youtube token does not exist or expired.',
                            });
                        }
                    } else {
                        next({
                            error: youtubeError.findUserLoginFailed,
                            message: 'No youtube token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (account, next) => {
            const client = new google.auth.OAuth2(
                config.youtube.clientId,
                config.youtube.clientSecret,
                config.youtube.redirectUri,
            );
            client.setCredentials({
                access_token: account.access_token,
                scope: account.scope,
                expiry_date: account.expiry_date,
                token_type: 'Bearer',
            });
            next(null, client);
        }, (client, next) => {
            const doc = {
                part: ['id', 'snippet', 'contentDetails', 'status'],
                id: broadcastId,
                requestBody: {
                    streamId,
                },
            };
            const youtube = new youtube_v3.Resource$Livebroadcasts({
                _options: {
                    auth: client,
                },
            });
            youtube.bind(doc, (error, result) => {
                if (error) {
                    next({
                        error: youtubeError.bindLiveBroadcastFailed,
                        message: 'Error occurred while binding or unbinding live broadcast.',
                        data: error,
                    });
                } else if (result && result.data && result.data.id) {
                    next(null, {
                        status: 200,
                        result: {
                            broadcast: result.data,
                        },
                    });
                } else {
                    next({
                        error: youtubeError.bindLiveBroadcastFailed,
                        message: 'Error occurred while binding or unbinding live broadcast.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateMediaNodeYoutubeDestination = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const {
        streamId,
        liveStreamId,
    } = req.params;
    const {
        channelId,
    } = req.body;

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
                media_space: mediaSpace._id,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.youtube && result.social_accounts.youtube.length > 0) {
                        const account = result.social_accounts.youtube.find(
                            (account) => account.channel_id === channelId && account.status === 'VERIFIED',
                        );
                        if (account && account.expiry_date > Date.now()) {
                            username = account.youtube_url ? account.youtube_url.replace('https://www.youtube.com/', '') : account.channel_name;
                            next(null, liveStream, account);
                        } else {
                            next({
                                error: youtubeError.tokenExpired,
                                message: 'Youtube token does not exist or expired.',
                            });
                        }
                    } else {
                        next({
                            error: youtubeError.findUserLoginFailed,
                            message: 'No youtube token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (liveStream, account, next) => {
            const client = new google.auth.OAuth2(
                config.youtube.clientId,
                config.youtube.clientSecret,
                config.youtube.redirectUri,
            );
            client.setCredentials({
                access_token: account.access_token,
                scope: account.scope,
                expiry_date: account.expiry_date,
                token_type: 'Bearer',
            });
            next(null, liveStream, client);
        }, (liveStream, client, next) => {
            const youtube = new youtube_v3.Resource$Livestreams({
                _options: {
                    auth: client,
                },
            });
            youtube.list({
                part: ['id', 'snippet', 'cdn', 'status'],
                id: streamId,
            }, (error, result) => {
                if (error) {
                    next({
                        error: youtubeError.getLiveStreamFailed,
                        message: 'Error occurred while getting youtube live stream.',
                        data: error,
                    });
                } else if (result && result.data && result.data.items && result.data.items.length > 0) {
                    if (result.data.items[0].cdn && result.data.items[0].cdn.ingestionType === 'rtmp' && result.data.items[0].cdn.ingestionInfo) {
                        next(null, liveStream, result.data.items[0]);
                    } else {
                        next({
                            error: youtubeError.liveStreamDoesNotExist,
                            message: 'Youtube live stream is not RTMP or does not have ingestion info.',
                        });
                    }
                } else {
                    next({
                        error: youtubeError.liveStreamDoesNotExist,
                        message: 'Youtube live stream does not exist.',
                    });
                }
            });
        }, (liveStream, youtubeStream, next) => {
            const streamDestinations = [];
            if (liveStream.configuration && liveStream.configuration.stream_destinations) {
                streamDestinations.push(...liveStream.configuration.stream_destinations);
            }
            const existingYoutubeStream = streamDestinations.find((destination) => {
                if (destination.name === 'youtube' && destination.url === youtubeStream.cdn.ingestionInfo.ingestionAddress && destination.key === youtubeStream.cdn.ingestionInfo.streamName) {
                    return true;
                }
            });
            if (!existingYoutubeStream) {
                streamDestinations.push({
                    name: 'youtube',
                    url: youtubeStream.cdn.ingestionInfo.ingestionAddress,
                    key: youtubeStream.cdn.ingestionInfo.streamName,
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

const uploadAsset = (req, res) => {
    const { assetId } = req.params;
    const user = req.user;
    const {
        title,
        description,
        tags,
        defaultLanguage,
        localizations,
        status,
        channelId,
    } = req.body;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id: user._id,
                media_space: user.media_space,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.youtube && result.social_accounts.youtube.length > 0) {
                        const account = result.social_accounts.youtube.find(
                            (account) => account.channel_id === channelId && account.status === 'VERIFIED',
                        );
                        if (account && account.expiry_date > Date.now()) {
                            next(null, account);
                        } else {
                            next({
                                error: youtubeError.tokenExpired,
                                message: 'Youtube token does not exist or expired.',
                            });
                        }
                    } else {
                        next({
                            error: youtubeError.findUserLoginFailed,
                            message: 'No youtube token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (youtubeToken, next) => {
            assetDBO.findOne({
                _id: assetId,
                media_space: user.media_space,
            }, {}, {}, false, (error, asset) => {
                if (error) {
                    next({
                        error: assetError.findAssetFailed,
                        message: 'Error occurred while finding asset.',
                    });
                } else if (asset) {
                    next(null, asset, youtubeToken);
                } else {
                    next({
                        error: assetError.assetDoesNotExist,
                        message: 'Asset does not exist.',
                    });
                }
            });
        }, (asset, youtubeToken, next) => {
            const assetOptions = {
                part: ['id', 'snippet'],
                requestBody: {
                    snippet: {},
                },
            };
            if (title) {
                assetOptions.requestBody.snippet.title = title;
            } else if (asset.name) {
                assetOptions.requestBody.snippet.title = asset.name;
            } else {
                assetOptions.requestBody.snippet.title = 'Uploaded From Media Node Studio';
            }
            if (description) {
                assetOptions.requestBody.snippet.description = description;
            } else if (asset.description) {
                assetOptions.requestBody.snippet.description = asset.description;
            }
            if (tags && tags.length > 0) {
                assetOptions.requestBody.snippet.tags = tags;
            } else if (asset.tags && asset.tags.length > 0) {
                assetOptions.requestBody.snippet.tags = asset.tags;
            }
            if (defaultLanguage) {
                assetOptions.requestBody.snippet.defaultLanguage = defaultLanguage;
            }
            if (localizations) {
                assetOptions.part.push('localizations');
                assetOptions.requestBody.localizations = localizations;
            }
            if (status) {
                assetOptions.part.push('status');
                assetOptions.requestBody.status = status;
            }

            if (asset.type === 'video' && asset.file && asset.file.download && asset.file.download.status === 'COMPLETE') {
                assetOptions.media = {
                    mimeType: 'video/mp4',
                };
                const filePath = path.join(user.root_path, 'media-node-data/sources', asset.file.download.path, asset.file.name);
                assetOptions.media.body = '';
                next(null, youtubeToken, assetOptions, filePath);
            } else if (asset.type === 'image' && asset.file && asset.file.download && asset.file.download.status === 'COMPLETE') {
                assetOptions.media = {
                    mimeType: 'image/jpeg',
                };
                const filePath = path.join(user.root_path, 'media-node-data/sources', asset.file.download.path, asset.file.download.name);
                assetOptions.media.body = '';
                next(null, youtubeToken, assetOptions, filePath);
            } else {
                next({
                    error: assetError.assetDoesNotExist,
                    message: 'Asset does not exist.',
                });
            }
        }, (youtubeToken, assetOptions, filePath, next) => {
            const client = new google.auth.OAuth2(
                config.youtube.clientId,
                config.youtube.clientSecret,
                config.youtube.redirectUri,
            );
            client.setCredentials({
                access_token: youtubeToken.access_token,
                scope: youtubeToken.scope,
                expiry_date: youtubeToken.expiry_date,
                token_type: 'Bearer',
            });
            const youtube = new youtube_v3.Resource$Videos({
                _options: {
                    auth: client,
                },
            });
            const doc = {
                asset: assetId,
                social_media: 'YOUTUBE',
                status: 'IN_QUEUE',
                user: user._id,
            };
            assetDistributionDBO.save(doc, false, (error, result) => {
                if (error) {
                    next({
                        error: assetDistributionError.saveAssetDistributionFailed,
                        message: 'Error occurred while saving asset distribution.',
                    });
                } else {
                    uploadYoutubeVideo(youtube, assetOptions, filePath, result._id);
                    next(null, result);
                }
            });
        }, (assetDistribution, next) => {
            const updates = {
                $push: {
                    distributions: {
                        platform: 'YOUTUBE',
                        asset_distribution: assetDistribution._id,
                    },
                },
            };
            assetDBO.findOneAndUpdate({
                _id: assetId,
            }, updates, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    next({
                        error: assetError.updateAssetFailed,
                        message: 'Error occurred while updating asset.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result: {
                            asset: result,
                            asset_distribution: assetDistribution,
                        },
                    });
                } else {
                    next({
                        error: assetError.assetDoesNotExist,
                        message: 'Asset does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getYoutubeAsset = (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const {
        channelId,
    } = req.query;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id: user._id,
                media_space: user.media_space,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.youtube && result.social_accounts.youtube.length > 0) {
                        const account = result.social_accounts.youtube.find(
                            (account) => account.channel_id === channelId && account.status === 'VERIFIED',
                        );
                        if (account && account.expiry_date > Date.now()) {
                            next(null, account);
                        } else {
                            next({
                                error: youtubeError.tokenExpired,
                                message: 'Youtube token does not exist or expired.',
                            });
                        }
                    } else {
                        next({
                            error: youtubeError.findUserLoginFailed,
                            message: 'No youtube token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (youtubeToken, next) => {
            const client = new google.auth.OAuth2(
                config.youtube.clientId,
                config.youtube.clientSecret,
                config.youtube.redirectUri,
            );
            client.setCredentials({
                access_token: youtubeToken.access_token,
                scope: youtubeToken.scope,
                expiry_date: youtubeToken.expiry_date,
                token_type: 'Bearer',
            });
            next(null, client);
        }, (client, next) => {
            const youtube = new youtube_v3.Resource$Videos({
                _options: {
                    auth: client,
                },
            });
            youtube.list({
                part: ['id', 'snippet', 'content_details', 'status'],
                id,
            }, (error, result) => {
                if (error) {
                    next({
                        error: youtubeError.getAssetFailed,
                        message: 'Error occurred while getting asset.',
                    });
                } else if (result && result.data && result.data.items && result.data.items.length > 0) {
                    next(null, {
                        status: 200,
                        result: result.data.items[0],
                    });
                } else {
                    next({
                        error: youtubeError.assetDoesNotExist,
                        message: 'Asset does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateYoutubeAsset = (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const {
        title,
        description,
        tags,
        defaultLanguage,
        localizations,
        status,
        channelId,
    } = req.body;

    async.waterfall([
        (next) => {
            assetDistributionDBO.findOne({
                _id: id,
                user: user._id,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: assetDistributionError.findAssetDistributionFailed,
                        message: 'Error occurred while finding asset distribution.',
                    });
                } else if (result) {
                    if (result.platform === 'YOUTUBE' && result.youtube && result.youtube.id) {
                        next(null, result);
                    } else {
                        next({
                            error: assetDistributionError.assetDistributionDoesNotExist,
                            message: 'Provided asset distribution is not a youtube asset distribution.',
                        });
                    }
                } else {
                    next({
                        error: assetDistributionError.assetDistributionDoesNotExist,
                        message: 'Asset distribution does not exist.',
                    });
                }
            });
        }, (assetDistribution, next) => {
            userDBO.findOne({
                _id: user._id,
                media_space: user.media_space,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    if (result.social_accounts && result.social_accounts.youtube && result.social_accounts.youtube.length > 0) {
                        const account = result.social_accounts.youtube.find(
                            (account) => account.channel_id === channelId && account.status === 'VERIFIED',
                        );
                        if (account && account.expiry_date > Date.now()) {
                            next(null, assetDistribution, account);
                        } else {
                            next({
                                error: youtubeError.tokenExpired,
                                message: 'Youtube token does not exist or expired.',
                            });
                        }
                    } else {
                        next({
                            error: youtubeError.findUserLoginFailed,
                            message: 'No youtube token found for user.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (assetDistribution, youtubeToken, next) => {
            const client = new google.auth.OAuth2(
                config.youtube.clientId,
                config.youtube.clientSecret,
                config.youtube.redirectUri,
            );

            client.setCredentials({
                access_token: youtubeToken.access_token,
                scope: youtubeToken.scope,
                expiry_date: youtubeToken.expiry_date,
                token_type: 'Bearer',
            });
            next(null, assetDistribution, client);
        }, (assetDistribution, client, next) => {
            const youtubeUpdates = {
                id: assetDistribution.youtube.id,
                snippet: {},
                status: {},
            };

            if (title) {
                youtubeUpdates.snippet.title = title;
            }
            if (description) {
                youtubeUpdates.snippet.description = description;
            }
            if (tags && tags.length > 0) {
                youtubeUpdates.snippet.tags = tags;
            }
            if (defaultLanguage) {
                youtubeUpdates.snippet.defaultLanguage = defaultLanguage;
            }
            if (localizations) {
                youtubeUpdates.snippet.localizations = localizations;
            }
            if (status) {
                youtubeUpdates.status.privacyStatus = status;
            }
            next(null, assetDistribution, client, youtubeUpdates);
        }, (assetDistribution, client, youtubeUpdates, next) => {
            const youtube = new youtube_v3.Resource$Videos({
                _options: {
                    auth: client,
                },
            });
            youtube.update({
                part: ['id', 'snippet', 'status'],
                requestBody: youtubeUpdates,
            }, (error, result) => {
                if (error) {
                    next({
                        error: youtubeError.updateAssetFailed,
                        message: 'Error occurred while updating asset.',
                    });
                } else if (result && result.data && result.data.id) {
                    next(null, assetDistribution, result.data);
                } else {
                    next({
                        error: youtubeError.updateAssetFailed,
                        message: 'Error occurred while updating asset.',
                    });
                }
            });
        }, (assetDistribution, ytData, next) => {
            const updates = {
                $set: {
                    youtube: {
                        id: ytData.id,
                        title: ytData.snippet.title,
                        description: ytData.snippet.description,
                        thumbnail: ytData.snippet.thumbnails,
                        privacy_status: ytData.status.privacyStatus,
                    },
                },
            };
            assetDistributionDBO.findOneAndUpdate({
                _id: assetDistribution._id,
            }, updates, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    next({
                        error: assetDistributionError.updateAssetDistributionFailed,
                        message: 'Error occurred while updating asset distribution.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result: result,
                    });
                } else {
                    next({
                        error: assetDistributionError.assetDistributionDoesNotExist,
                        message: 'Asset distribution does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

module.exports = {
    getAuthUrl,
    handleCallback,
    getLiveStreams,
    addLiveStream,
    getLiveBroadcasts,
    addLiveBroadcast,
    updateLiveBroadcast,
    bindAndUnbindLiveBroadcast,
    updateMediaNodeYoutubeDestination,
    uploadAsset,
    getYoutubeAsset,
    updateYoutubeAsset,
};
