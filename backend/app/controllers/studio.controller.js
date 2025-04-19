const async = require('async');
const Axios = require('axios');
const liveStreamDBO = require('../dbos/live_stream.dbo');
const liveStreamError = require('../errors/live_stream.error');
const userDBO = require('../dbos/user.dbo');
const userError = require('../errors/user.error');
const studioError = require('../errors/studio.error');
const config = require('../../config');
const processJSONResponse = require('../utils/response.util');
const logger = require('../../logger');

const getStudioChannels = (req, res) => {
    const user = req.user;

    const { type } = req.query;

    async.waterfall([
        (next) => {
            const url = `${config.omniflixStudio[type]}/media-node/channels?bcAccountAddress=${user.bc_account_address}`;

            Axios({
                method: 'GET',
                url,
            }).then((response) => {
                next(null, response.data);
            }).catch((_) => {
                next({
                    error: studioError.findStudioChannelsFailed,
                    message: 'Error occurred while finding the studio channels.',
                });
            });
        }, (response, next) => {
            if (response.result.list.length === 0) {
                next({
                    error: studioError.studioChannelsNotFound,
                    message: 'No channels found in the studio.',
                });
            } else {
                next(null, {
                    status: 200,
                    result: response.result.list,
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateLiveStreamAccessToken = (req, res) => {
    const user = req.user;
    const { id } = req.params;
    const {
        liveStreamAccessToken,
        channelName,
        type,
    } = req.body;
    let {
        channelId,
    } = req.body;

    async.waterfall([
        (next) => {
            const url = `${config.omniflixStudio[type]}/media-node/channels?bcAccountAddress=${user.bc_account_address}`;

            Axios({
                method: 'GET',
                url,
            }).then((response) => {
                next(null, response.data);
            }).catch((error) => {
                logger.error('Error occurred while finding the studio channels.', error);
                next({
                    error: studioError.findStudioChannelsFailed,
                    message: 'Error occurred while finding the studio channels.',
                });
            });
        }, (response, next) => {
            if (response.result && response.result.list && response.result.list.length > 0) {
                if (channelId) {
                    const channel = response.result.list.find((channel) => channel._id.toString() === channelId.toString());
                    if (!channel) {
                        next({
                            error: studioError.channelNotFound,
                            message: 'Provided channel id does not exist or you do not have access to this channel.',
                        });
                    } else {
                        next(null, {
                            channelId,
                            username: channel.username,
                        });
                    }
                } else {
                    next({
                        error: studioError.channelAlreadyExists,
                        message: 'Channel already exists, please provide a channel from available channels.',
                    });
                }
            } else if (channelName) {
                const body = {
                    channelUsername: channelName,
                    liveStreamAccessToken: liveStreamAccessToken,
                    bcAccountAddress: user.bc_account_address,
                };

                const url = `${config.omniflixStudio[type]}/media-node/channels`;

                Axios({
                    method: 'POST',
                    url,
                    data: body,
                }).then((response) => {
                    if (response && response.data && response.data.result && response.data.result._id) {
                        channelId = response.data.result._id;
                        next(null, {
                            channelId,
                            username: response.data.result.username,
                        });
                    } else {
                        next({
                            error: studioError.creatingChannelFailed,
                            message: 'Channel creation failed, invalid response.',
                        });
                    }
                }).catch((error) => {
                    logger.error('Error occurred while creating the channel.', error);
                    next({
                        error: studioError.creatingChannelFailed,
                        message: 'Error occurred while creating the channel.',
                    });
                });
            } else {
                next({
                    error: studioError.channelNotFound,
                    message: 'Channel not found, please provide a channel name to create a new channel.',
                });
            }
        }, (channel, next) => {
            liveStreamDBO.findOne({
                _id: id,
            }, {}, {}, false, (error, liveStream) => {
                if (error) {
                    next({
                        error: liveStreamError.findLiveStreamFailed,
                        message: 'Error occurred while finding the live stream.',
                    });
                } else if (liveStream) {
                    next(null, channel, liveStream);
                } else {
                    next({
                        error: liveStreamError.liveStreamDoesNotExist,
                        message: 'Live stream does not exist.',
                    });
                }
            });
        }, (channel, liveStream, next) => {
            const connectedChannels = liveStream.configuration.connected_channels || [];
            const channelExistInDestinations = connectedChannels.find((destination) => destination.channel_id.toString() === channel.channelId.toString());
            if (channelExistInDestinations) {
                connectedChannels.forEach((destination) => {
                    if (destination.channel_id.toString() === channel.channelId.toString()) {
                        destination.channel_id = channel.channelId;
                        destination.username = channel.username;
                        destination.live_stream_access_token = liveStreamAccessToken;
                        destination.studio_type = type;
                        destination.bc_account_address = user.bc_account_address;
                    }
                });
            } else {
                connectedChannels.push({
                    channel_id: channel.channelId,
                    username: channel.username,
                    live_stream_access_token: liveStreamAccessToken,
                    studio_type: type,
                    bc_account_address: user.bc_account_address,
                });
            }

            liveStreamDBO.findOneAndUpdate({
                _id: id,
            }, {
                $set: {
                    'configuration.connected_channels': connectedChannels,
                },
            }, {
                new: true,
            }, false, (error, liveStream) => {
                if (error) {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
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
            if (user && user.social_accounts && user.social_accounts.of_studio && user.social_accounts.of_studio.length > 0) {
                const index = user.social_accounts.of_studio.findIndex((ofStudio) => ofStudio.channel_id.toString() === channelId.toString());
                if (index !== -1) {
                    next(null, liveStream, index);
                } else {
                    next(null, liveStream, -1);
                }
            } else {
                next(null, liveStream, -1);
            }
        }, (liveStream, index, next) => {
            if (index !== -1) {
                const conditions = {
                    _id: user._id,
                    'social_accounts.of_studio.channel_id': channelId,
                };
                const updates = {
                    $set: {
                        'social_accounts.of_studio.$[elem].access_token': liveStreamAccessToken,
                        'social_accounts.of_studio.$[elem].channel_id': channelId,
                        'social_accounts.of_studio.$[elem].type': type,
                    },
                };
                const options = {
                    arrayFilters: [{
                        'elem.channel_id': channelId,
                    }],
                    new: true,
                };
                next(null, liveStream, conditions, updates, options);
            } else {
                const conditions = {
                    _id: user._id,
                };
                const updates = {
                    $push: {
                        'social_accounts.of_studio': {
                            access_token: liveStreamAccessToken,
                            channel_id: channelId,
                            type: type,
                        },
                    },
                };
                const options = {
                    new: true,
                };
                next(null, liveStream, conditions, updates, options);
            }
        }, (liveStream, conditions, updates, options, next) => {
            userDBO.findOneAndUpdate(conditions, updates, options, false, (error, user) => {
                if (error) {
                    next({
                        error: userError.updateUserFailed,
                        message: 'Error occurred while updating the user.',
                    });
                } else if (user) {
                    next(null, {
                        status: 200,
                        result: liveStream,
                    });
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const removeLiveStreamAccessToken = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;
    const { id, channelId } = req.params;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: id,
                media_space: mediaSpace,
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
            const updatedDestinations = [];
            const destinations = liveStream.configuration.connected_channels || [];
            const channelExistInDestinations = destinations.find((destination) => destination.channel_id.toString() === channelId.toString());
            if (channelExistInDestinations) {
                destinations.forEach((destination) => {
                    if (destination.channel_id.toString() !== channelId.toString()) {
                        updatedDestinations.push(destination);
                    }
                });
            }

            liveStreamDBO.findOneAndUpdate({
                _id: id,
            }, {
                $set: {
                    'configuration.connected_channels': updatedDestinations,
                },
            }, {
                new: true,
            }, false, (error, liveStream) => {
                if (error) {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (liveStream) {
                    next(null, {
                        status: 200,
                        result: liveStream,
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

const getStudioSocials = (req, res) => {
    const {
        _id,
        bc_account_address: bcAccountAddress,
        media_space: mediaSpace,
    } = req.user;
    const { channelId } = req.params;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                media_space: mediaSpace,
            }, {}, {}, false, (error, user) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (user) {
                    if (user.social_accounts && user.social_accounts.of_studio && user.social_accounts.of_studio.length > 0) {
                        const studioAccount = user.social_accounts.of_studio.find((ofStudio) => ofStudio.channel_id.toString() === channelId.toString());
                        if (studioAccount) {
                            next(null, user, studioAccount);
                        } else {
                            next({
                                error: userError.socialAccountsNotFound,
                                message: 'Given channel id does not exist in your social accounts.',
                            });
                        }
                    } else {
                        next({
                            error: userError.socialAccountsNotFound,
                            message: 'Social accounts not found. Please connect studio to media node.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (user, studioAccount, next) => {
            const url = `${config.omniflixStudio[studioAccount.type]}/media-node/sync-socials`;

            Axios({
                method: 'GET',
                url,
                params: {
                    mediaNodeId: config.mediaSpace.id,
                    token: studioAccount.access_token,
                    bcAccountAddress,
                },
            }).then((response) => {
                if (response && response.data && response.data.success === true) {
                    next(null, user, response.data.result, studioAccount);
                } else {
                    next({
                        error: studioError.syncSocialsFailed,
                        message: 'Syncing social accounts failed, invalid response.',
                        info: response ? response.data : null,
                    });
                }
            }).catch((error) => {
                logger.error(error.message);
                if (error.response && error.response.data && error.response.data.message) {
                    next({
                        error: studioError.syncSocialsFailed,
                        message: error.response.data.message,
                    });
                } else {
                    next({
                        error: studioError.syncSocialsFailed,
                        message: error.message,
                    });
                }
            });
        }, (user, result, studioAccount, next) => {
            const newYoutubeAccounts = [];
            const newTwitterAccounts = [];
            if (result && result.youtube && result.youtube.length > 0) {
                const studioYoutubeAccounts = result.youtube;
                const existingYoutubeAccounts = user.social_accounts.youtube || [];
                studioYoutubeAccounts.forEach((studioYoutubeAccount) => {
                    const index = existingYoutubeAccounts.findIndex((existingYoutubeAccount) => existingYoutubeAccount.channel_id.toString() === studioYoutubeAccount.channel_id.toString());
                    if (index === -1) {
                        newYoutubeAccounts.push(studioYoutubeAccount);
                    }
                });
            }
            if (result && result.twitter && result.twitter.length > 0) {
                const studioTwitterAccounts = result.twitter;
                const existingTwitterAccounts = user.social_accounts.twitter || [];
                studioTwitterAccounts.forEach((studioTwitterAccount) => {
                    const index = existingTwitterAccounts.findIndex((existingTwitterAccount) => existingTwitterAccount.user_id.toString() === studioTwitterAccount.user_id.toString());
                    if (index === -1) {
                        newTwitterAccounts.push(studioTwitterAccount);
                    }
                });
            }
            const updates = {
                $push: {
                    'social_accounts.youtube': newYoutubeAccounts,
                    'social_accounts.twitter': newTwitterAccounts,
                },
            };
            userDBO.findOneAndUpdate({
                _id: user._id,
            }, updates, {
                new: true,
            }, false, (error, user) => {
                if (error) {
                    next({
                        error: userError.updateUserFailed,
                        message: 'Error occurred while updating the user.',
                    });
                } else if (user) {
                    next(null, user, studioAccount);
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (user, studioAccount, next) => {
            const url = `${config.omniflixStudio[studioAccount.type]}/media-node/sync-socials`;
            const socialAccounts = user.social_accounts;
            delete socialAccounts.of_studio;
            const data = {
                mediaNodeId: config.mediaSpace.id,
                token: studioAccount.access_token,
                socialAccounts: socialAccounts,
                bcAccountAddress,
            };

            Axios({
                method: 'PUT',
                url,
                data,
            }).then((response) => {
                if (response && response.data && response.data.success === true) {
                    next(null, {
                        status: 200,
                        result: user,
                    });
                } else {
                    next({
                        error: studioError.syncSocialsFailed,
                        message: 'Error occurred while syncing social accounts to studio.',
                        info: response ? response.data : null,
                    });
                }
            }).catch((error) => {
                logger.error(error.message);
                if (error.response && error.response.data && error.response.data.message) {
                    next({
                        error: studioError.syncSocialsFailed,
                        message: error.response.data.message,
                    });
                } else {
                    next({
                        error: studioError.syncSocialsFailed,
                        message: error.message,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const enableStudioChannel = (req, res) => {
    const user = req.user;
    const {
        id,
        channelId,
    } = req.params;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: id,
                media_space: user.media_space,
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
            const connectedChannels = liveStream.configuration.connected_channels || [];
            const channelExistInDestinations = connectedChannels.find((destination) => destination.channel_id.toString() === channelId.toString());
            if (channelExistInDestinations) {
                connectedChannels.forEach((destination) => {
                    if (destination.channel_id.toString() === channelId.toString()) {
                        destination.enabled = true;
                    }
                });
                next(null, connectedChannels);
            } else {
                next({
                    error: liveStreamError.channelNotFound,
                    message: 'Channel not found in the live stream.',
                });
            }
        }, (connectedChannels, next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: id,
            }, {
                $set: {
                    'configuration.connected_channels': connectedChannels,
                },
            }, {
                new: true,
            }, false, (error, liveStream) => {
                if (error) {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (liveStream) {
                    next(null, {
                        status: 200,
                        result: liveStream,
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

const disableStudioChannel = (req, res) => {
    const user = req.user;
    const {
        id,
        channelId,
    } = req.params;

    async.waterfall([
        (next) => {
            liveStreamDBO.findOne({
                _id: id,
                media_space: user.media_space,
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
            const connectedChannels = liveStream.configuration.connected_channels || [];
            const channelExistInDestinations = connectedChannels.find((destination) => destination.channel_id.toString() === channelId.toString());
            if (channelExistInDestinations) {
                connectedChannels.forEach((destination) => {
                    if (destination.channel_id.toString() === channelId.toString()) {
                        destination.enabled = false;
                    }
                });
                next(null, connectedChannels);
            } else {
                next({
                    error: liveStreamError.channelNotFound,
                    message: 'Channel not found in the live stream.',
                });
            }
        }, (connectedChannels, next) => {
            liveStreamDBO.findOneAndUpdate({
                _id: id,
            }, {
                $set: {
                    'configuration.connected_channels': connectedChannels,
                },
            }, {
                new: true,
            }, false, (error, liveStream) => {
                if (error) {
                    next({
                        error: liveStreamError.updateLiveStreamFailed,
                        message: 'Error occurred while updating the live stream.',
                    });
                } else if (liveStream) {
                    next(null, {
                        status: 200,
                        result: liveStream,
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

module.exports = {
    getStudioChannels,
    updateLiveStreamAccessToken,
    removeLiveStreamAccessToken,
    enableStudioChannel,
    getStudioSocials,
    disableStudioChannel,
};
