const async = require('async');
const userDBO = require('../dbos/user.dbo');
const userError = require('../errors/user.error');
const userLoginDBO = require('../dbos/user_login.dbo');
const userLoginError = require('../errors/user_login.error');
const mediaSpaceDBO = require('../dbos/media_space.dbo');
const mediaSpaceError = require('../errors/media_space.error');
const authError = require('../errors/auth.error');
const { verifyJWT } = require('../utils/auth.util');
const processJSONResponse = require('../utils/response.util');
const logger = require('../../logger');
const config = require('../../config');

const isAuthenticated = (req, res, cb) => {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    } else if (req.body && req.body.at) {
        token = req.body.at;
    }
    async.waterfall([
        (next) => {
            if (token) {
                verifyJWT(token, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: authError.jwtVerificationFailed,
                            message: 'Error occurred while verifying the JWT token.',
                        });
                    } else {
                        next(null, result._id, result.login_id, result.bc_account_address);
                    }
                });
            } else {
                next({
                    status: 400,
                    error: authError.jwtTokenRequired,
                    message: 'JWT token is required for this request.',
                });
            }
        }, (_id, loginId, bcAccountAddress, next) => {
            userLoginDBO.findOne({
                _id: loginId,
                user_id: _id,
                access_token: token,
            }, {
                _id: 1,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: userLoginError.findUserLoginFailed,
                        message: 'Error occurred while finding the user login.',
                    });
                } else if (result) {
                    next(null, _id);
                } else {
                    next({
                        status: 404,
                        error: userLoginError.userLoginDoesNotExist,
                        message: 'User Id and token combination does not exist.',
                    });
                }
            });
        }, (_id, next) => {
            userDBO.findOne({
                _id,
            }, {
                profile_image: 0,
                __v: 0,
                created_at: 0,
                updated_at: 0,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    req.user = result;
                    req.token = token;
                    next(null, result);
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (result, next) => {
            if (config.mediaSpace.forLease === 'false') {
                next(null);
            } else {
                mediaSpaceDBO.findOne({
                    _id: result.media_space,
                    'lease.status': 'LEASE_STATUS_ACTIVE',
                }, {}, {}, false, (error, mediaSpace) => {
                    if (error) {
                        next({
                            error: mediaSpaceError.findMediaSpaceFailed,
                            message: 'Error occurred while finding the media space.',
                        });
                    } else if (mediaSpace) {
                        if (mediaSpace.lease && new Date(mediaSpace.lease.expiry) > Date.now()) {
                            next(null);
                        } else {
                            next({
                                error: mediaSpaceError.leaseExpired,
                                message: 'Media space lease has expired.',
                            });
                        }
                    } else {
                        next({
                            error: mediaSpaceError.mediaSpaceDoesNotExist,
                            message: 'Media space does not exist.',
                        });
                    }
                });
            }
        },
    ], (error) => {
        if (error) {
            processJSONResponse(res, error);
        } else {
            cb();
        }
    });
};

const hasStudioPermission = (req, res, cb) => {
    const {
        _id,
    } = req.user;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                permissions: 'studio',
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the route.',
                    });
                } else if (result) {
                    next(null);
                } else {
                    next({
                        status: 404,
                        error: userError.userDoesNotExist,
                        message: 'User does not have permission.',
                    });
                }
            });
        },
    ], (error) => {
        if (error) {
            processJSONResponse(res, error);
        } else {
            cb();
        }
    });
};

const hasIPFSPermission = (req, res, cb) => {
    const {
        _id,
    } = req.user;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                permissions: 'ipfs',
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the route.',
                    });
                } else if (result) {
                    next(null);
                } else {
                    next({
                        status: 404,
                        error: userError.userDoesNotExist,
                        message: 'User does not have permission.',
                    });
                }
            });
        },
    ], (error) => {
        if (error) {
            processJSONResponse(res, error);
        } else {
            cb();
        }
    });
};

const hasRunnerPermission = (req, res, cb) => {
    const {
        _id,
    } = req.user;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                permissions: 'runner',
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the route.',
                    });
                } else if (result) {
                    next(null);
                } else {
                    next({
                        status: 404,
                        error: userError.userDoesNotExist,
                        message: 'User does not have permission.',
                    });
                }
            });
        },
    ], (error) => {
        if (error) {
            processJSONResponse(res, error);
        } else {
            cb();
        }
    });
};

const hasStreamerPermission = (req, res, cb) => {
    const {
        _id,
    } = req.user;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                permissions: 'streamer',
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the route.',
                    });
                } else if (result) {
                    next(null);
                } else {
                    next({
                        status: 404,
                        error: userError.userDoesNotExist,
                        message: 'User does not have permission.',
                    });
                }
            });
        },
    ], (error) => {
        if (error) {
            processJSONResponse(res, error);
        } else {
            cb();
        }
    });
};

const isAdminUser = (req, res, cb) => {
    const {
        _id,
    } = req.user;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                is_admin: true,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the route.',
                    });
                } else if (result) {
                    next(null, result);
                } else {
                    next({
                        status: 404,
                        error: userError.userDoesNotExist,
                        message: 'User does not have permission.',
                    });
                }
            });
        }, (result, next) => {
            if (result.is_media_node_admin) {
                next(null);
            } else if (config.mediaSpace.forLease === 'false') {
                next(null);
            } else {
                mediaSpaceDBO.findOne({
                    _id: result.media_space_id,
                    'lease.status': 'LEASE_STATUS_ACTIVE',
                    'lease.expiry': {
                        $gt: new Date(),
                    },
                }, {}, {}, false, (error, mediaSpace) => {
                    if (error) {
                        next({
                            error: mediaSpaceError.findMediaSpaceFailed,
                            message: 'Error occurred while finding the media space.',
                        });
                    } else if (mediaSpace) {
                        next(null);
                    } else {
                        next({
                            error: mediaSpaceError.mediaSpaceDoesNotExist,
                            message: 'Media space does not exist or lease has expired.',
                        });
                    }
                });
            }
        },
    ], (error) => {
        if (error) {
            processJSONResponse(res, error);
        } else {
            cb();
        }
    });
};

const isMediaNodeAdminUser = (req, res, cb) => {
    const {
        _id,
    } = req.user;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
                is_media_node_admin: true,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the route.',
                    });
                } else if (result) {
                    next(null);
                } else {
                    next({
                        status: 404,
                        error: userError.userDoesNotExist,
                        message: 'User does not have permission.',
                    });
                }
            });
        },
    ], (error) => {
        if (error) {
            processJSONResponse(res, error);
        } else {
            cb();
        }
    });
};

const isValidScriptCall = (req, res, cb) => {
    const {
        token,
    } = req.body;

    if (token && token === config.streamer.script_call_token) {
        cb();
    } else {
        processJSONResponse(res, {
            error: authError.invalidToken,
            message: 'Invalid token.',
        });
    }
};

const isValidYoutubeCallback = (req, res, cb) => {
    let _id = null;
    let token = null;
    if (req && req.query && req.query.state) {
        const state = JSON.parse(req.query.state);
        if (state && state._id && state.token) {
            _id = state._id;
            token = state.token;
        } else {
            processJSONResponse(res, {
                error: authError.jwtVerificationFailed,
                message: 'Invalid request for youtube callback.',
            });
        }
    }

    if (_id && token) {
        async.waterfall([
            (next) => {
                userDBO.findOne({
                    _id,
                }, {
                    profile_image: 0,
                    __v: 0,
                    created_at: 0,
                    updated_at: 0,
                }, {}, true, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: userError.findUserFailed,
                            message: 'Error occurred while finding the user.',
                        });
                    } else if (result) {
                        const youtubeAccounts = result.social_accounts.youtube;
                        if (youtubeAccounts && youtubeAccounts.length > 0) {
                            const youtubeAccount = youtubeAccounts.find((account) => account.token === token);
                            if (youtubeAccount) {
                                req.user = result;
                                next(null);
                            } else {
                                next({
                                    error: userError.userDoesNotExist,
                                    message: 'Invalid token for youtube callback.',
                                });
                            }
                        } else {
                            next({
                                error: userError.userDoesNotExist,
                                message: 'Invalid youtube callback.',
                            });
                        }
                    } else {
                        next({
                            error: userError.userDoesNotExist,
                            message: 'User does not exist.',
                        });
                    }
                });
            },
        ], (error) => {
            if (error) {
                processJSONResponse(res, error);
            } else {
                cb();
            }
        });
    }
};

const isValidTwitchCallback = (req, res, cb) => {
    let _id = null;
    let token = null;
    if (req && req.query && req.query.state) {
        const state = JSON.parse(req.query.state);
        if (state && state._id && state.token) {
            _id = state._id;
            token = state.token;
        } else {
            processJSONResponse(res, {
                error: authError.jwtVerificationFailed,
                message: 'Invalid request for youtube callback.',
            });
        }
    }

    if (_id && token) {
        async.waterfall([
            (next) => {
                userDBO.findOne({
                    _id,
                }, {
                    profile_image: 0,
                    __v: 0,
                    created_at: 0,
                    updated_at: 0,
                }, {}, true, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: userError.findUserFailed,
                            message: 'Error occurred while finding the user.',
                        });
                    } else if (result) {
                        const twitchAccounts = result.social_accounts.twitch;
                        if (twitchAccounts && twitchAccounts.length > 0) {
                            const twitchAccount = twitchAccounts.find((account) => account.token === token);
                            if (twitchAccount) {
                                req.user = result;
                                next(null);
                            } else {
                                next({
                                    error: userError.userDoesNotExist,
                                    message: 'Invalid token for twitch callback.',
                                });
                            }
                        } else {
                            next({
                                error: userError.userDoesNotExist,
                                message: 'Invalid twitch callback.',
                            });
                        }
                    } else {
                        next({
                            error: userError.userDoesNotExist,
                            message: 'User does not exist.',
                        });
                    }
                });
            },
        ], (error) => {
            if (error) {
                processJSONResponse(res, error);
            } else {
                cb();
            }
        });
    }
};

const isValidFacebookCallback = (req, res, cb) => {
    let _id = null;
    let token = null;
    if (req && req.query && req.query.state) {
        const state = JSON.parse(req.query.state);
        if (state && state._id && state.token) {
            _id = state._id;
            token = state.token;
        } else {
            processJSONResponse(res, {
                error: authError.jwtVerificationFailed,
                message: 'Invalid request for facebook callback.',
            });
        }
    }

    if (_id && token) {
        async.waterfall([
            (next) => {
                userDBO.findOne({
                    _id,
                }, {
                    profile_image: 0,
                    __v: 0,
                    created_at: 0,
                    updated_at: 0,
                }, {}, true, (error, result) => {
                    if (error) {
                        logger.error(error);
                        next({
                            error: userError.findUserFailed,
                            message: 'Error occurred while finding the user.',
                        });
                    } else if (result) {
                        const facebookAccounts = result.social_accounts.facebook;
                        if (facebookAccounts && facebookAccounts.length > 0) {
                            const facebookAccount = facebookAccounts.find((account) => account.token === token);
                            if (facebookAccount) {
                                req.user = result;
                                next(null);
                            } else {
                                next({
                                    error: userError.userDoesNotExist,
                                    message: 'Invalid token for facebook callback.',
                                });
                            }
                        } else {
                            next({
                                error: userError.userDoesNotExist,
                                message: 'Invalid facebook callback.',
                            });
                        }
                    } else {
                        next({
                            error: userError.userDoesNotExist,
                            message: 'User does not exist.',
                        });
                    }
                });
            },
        ], (error) => {
            if (error) {
                processJSONResponse(res, error);
            } else {
                cb();
            }
        });
    }
};

const isValidStudioToken = (req, res, cb) => {
    let userAuthToken = null;
    let address = null;

    if (req && req.body && req.body.userAuthToken && req.body.address) {
        userAuthToken = req.body.userAuthToken;
        address = req.body.address;
    } else if (req && req.query && req.query.userAuthToken && req.query.address) {
        userAuthToken = req.query.userAuthToken;
        address = req.query.address;
    }

    async.waterfall([
        (next) => {
            userDBO.findOne({
                bc_account_address: address,
                'social_accounts.of_studio.access_token': userAuthToken,
            }, {
                profile_image: 0,
                __v: 0,
                created_at: 0,
                updated_at: 0,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    req.user = result;
                    next(null);
                } else {
                    next({
                        status: 404,
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        },
    ], (error) => {
        if (error) {
            processJSONResponse(res, error);
        } else {
            cb();
        }
    });
};

const isValidStudioCall = (req, res, cb) => {
    let token = null;

    if (req && req.headers && req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        token = req.headers.authorization.split(' ')[1];
    } else if (req && req.query && req.query.token) {
        token = req.query.token;
    } else if (req && req.body && req.body.token) {
        token = req.body.token;
    }

    async.waterfall([
        (next) => {
            if (token && token === config.omniflixStudio.token) {
                next(null);
            } else {
                next({
                    status: 401,
                    error: authError.invalidStudioToken,
                    message: 'Invalid studio token.',
                });
            }
        },
    ], (error) => {
        if (error) {
            processJSONResponse(res, error);
        } else {
            cb();
        }
    });
};

const isValidToken = (req, res, cb) => {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    } else if (req.body && req.body.at) {
        token = req.body.at;
    }

    async.waterfall([
        (next) => {
            verifyJWT(token, (error, result) => {
                if (error) {
                    next(null, {
                        status: 200,
                        expired: true,
                    });
                } else {
                    next(null, {
                        status: 200,
                        expired: false,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

module.exports = {
    isAuthenticated,
    hasStudioPermission,
    hasIPFSPermission,
    hasRunnerPermission,
    hasStreamerPermission,
    isAdminUser,
    isValidScriptCall,
    isValidYoutubeCallback,
    isValidTwitchCallback,
    isValidFacebookCallback,
    isValidStudioToken,
    isMediaNodeAdminUser,
    isValidStudioCall,
    isValidToken,
};
