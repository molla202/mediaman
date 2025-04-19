const async = require('async');
const os = require('os');
const userDBO = require('../dbos/user.dbo');
const userError = require('../errors/user.error');
const userLoginDBO = require('../dbos/user_login.dbo');
const mediaSpaceDBO = require('../dbos/media_space.dbo');
const userLoginError = require('../errors/user_login.error');
const mediaSpaceError = require('../errors/media_space.error');
const { updateLeases } = require('./media_space.controller');
const {
    isValidFlixNetAddres,
    isValidBech32Address,
    verifySign,
    verifyLeasedAccount,
} = require('../helpers/account.helper');
const processJSONResponse = require('../utils/response.util');
const authUtil = require('../utils/auth.util');
const stringUtils = require('../utils/string.util');
const { enableFeeGrant } = require('../helpers/fee_grant.helper');
const { createNewUserSetup, getResourceUsage } = require('../helpers/user.helper');
const logger = require('../../logger');
const {
    flixnet,
    mediaSpace: mediaSpaceConfig,
} = require('../../config');

const connectBCAccount = (req, res) => {
    const {
        bcAccountAddress,
        mediaSpace,
    } = req.body;
    const now = new Date();

    const conditions = {
        bc_account_address: bcAccountAddress,
    };

    if (mediaSpace) {
        conditions.media_space = mediaSpace;
    }

    async.waterfall([
        (next) => {
            if (isValidBech32Address(bcAccountAddress)) {
                if (isValidFlixNetAddres(bcAccountAddress)) {
                    userDBO.findOne(conditions, {}, {}, false, (error, result) => {
                        if (error) {
                            logger.error(error.message);
                            next({
                                error: userError.findUserFailed,
                                message: 'Error occurred while finding the user.',
                            });
                        } else if (result) {
                            delete (result['profile_image']);
                            delete (result.__v);
                            next(null, result);
                        } else {
                            next(null, null);
                        }
                    });
                } else {
                    next({
                        error: userError.invalidBCAccountAddress,
                        message: 'Not omniflix address.\'',
                    });
                }
            } else {
                next({
                    error: userError.invalidBCAccountAddress,
                    message: 'Invalid account address.\'',
                });
            }
        }, (user, next) => {
            if (mediaSpaceConfig.forLease === 'true') {
                updateLeases(true, (error) => {
                    if (error) {
                        if (error.error === mediaSpaceError.mediaSpaceIsActive) {
                            next(null, user);
                        } else {
                            next({
                                error: mediaSpaceError.updateLeaseFailed,
                                message: 'Error occurred while updating the media space lease.',
                            });
                        }
                    } else {
                        next(null, user);
                    }
                });
            } else if (!user) {
                next({
                    error: userError.userDoesNotExist,
                    message: 'Unauthorized access.',
                });
            } else {
                next(null, user);
            }
        }, (user, next) => {
            if (!user && mediaSpaceConfig.forLease === 'true') {
                verifyLeasedAccount(bcAccountAddress, false, (error, result) => {
                    if (error) {
                        next(error);
                    } else {
                        next(null, result);
                    }
                });
            } else {
                next(null, user);
            }
        }, (user, next) => {
            if (mediaSpaceConfig.forLease === 'false') {
                next(null, user);
            } else {
                mediaSpaceDBO.findOne({
                    _id: user.media_space,
                }, {}, {}, false, (error, result) => {
                    if (error) {
                        logger.error(error.message);
                        next({
                            error: mediaSpaceError.findMediaSpaceFailed,
                            message: 'Error occurred while finding the media space.',
                        });
                    } else if (result) {
                        if (result.lease && result.lease.status === 'LEASE_STATUS_ACTIVE' && result.lease.expiry > Date.now()) {
                            next(null, user);
                        } else {
                            next({
                                error: mediaSpaceError.mediaSpaceDoesNotExist,
                                message: 'Media space lease is expired.',
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
        }, (user, next) => {
            const userLoginDoc = {
                user_id: user._id,
                bc_account_address: bcAccountAddress,
                auth_code: stringUtils.generateOTP(6),
                auth_code_expire_at: new Date(now.getTime() + 5 * 60000),
            };

            userLoginDBO.save(userLoginDoc, false, (error) => {
                if (error) {
                    console.log(error);
                    logger.error(error.message);
                    next({
                        error: userLoginError.saveUserLoginFailed,
                        message: 'Error occurred while saving the User login info',
                    });
                } else {
                    next(null, {
                        status: 200,
                        result: {
                            _id: user._id,
                            bc_account: bcAccountAddress,
                            auth_code: userLoginDoc.auth_code,
                        },
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const verifyBCAccount = (req, res) => {
    const {
        userId,
    } = req.params;
    const {
        authCode,
        authToken,
        sign,
    } = req.body;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id: userId,
            }, {
                __v: 0,
                created_at: 0,
                updated_at: 0,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    if (authToken === result.auth_token) {
                        next(null, result);
                    } else if (result.media_space &&
                        result.media_space.lease &&
                        result.media_space.lease.status === 'LEASE_STATUS_ACTIVE' &&
                        result.media_space.lease.expiry > Date.now() &&
                        result.media_space.lease.lessee.toString() === userId.toString()
                    ) {
                        next(null, result);
                    } else {
                        next({
                            status: 400,
                            error: userError.unAuthorizedAccess,
                            message: 'Auth Token does not match.',
                        });
                    }
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (user, next) => {
            const conditions = {
                user_id: user._id,
                auth_code: authCode,
                bc_account_address: user.bc_account_address,
            };

            userLoginDBO.findOne(conditions, {}, {
                sort: {
                    created_at: -1,
                },
            }, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: userLoginError.findUserLoginFailed,
                        message: 'Error occurred while finding the User login info',
                    });
                } else if (result) {
                    if (new Date(result.auth_code_expire_at) > new Date()) {
                        next(null, user, result);
                    } else {
                        next({
                            error: userLoginError.loginRequestExpired,
                            message: 'Login request expired.',
                        });
                    }
                } else {
                    next({
                        error: userError.loginRequestDoesNotExist,
                        message: 'Login request does not exist with given details.',
                    });
                }
            });
        }, (user, loginInfo, next) => {
            verifySign(flixnet, loginInfo.bc_account_address, sign, loginInfo.auth_code, (error, _) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: userError.invalidSignature,
                        message: error,
                    });
                } else {
                    next(null, user, loginInfo);
                }
            });
        }, (user, loginInfo, next) => {
            const payload = {
                _id: userId,
                login_id: loginInfo._id,
                bc_account_address: user.bc_account_address,
            };
            const remoteAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const accessToken = authUtil.generateAccessToken(payload);
            const refreshToken = authUtil.generateRefreshToken(payload);

            userLoginDBO.findOneAndUpdate({
                _id: loginInfo._id,
            }, {
                $set: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    remote_address: remoteAddress,
                    status: 'SUCCESS',
                },
            }, {}, false, (error) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: userLoginError.updateUserLoginFailed,
                        message: 'Error occurred while updating the user login info.',
                    });
                } else {
                    next(null, {
                        status: 200,
                        result: {
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        },
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const refreshUserAccessToken = (req, res) => {
    const {
        refreshToken,
    } = req.body;

    async.waterfall([
        (next) => {
            authUtil.verifyJWT(refreshToken, (error, decoded) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: userError.invalidRefreshToken,
                        message: 'Invalid refresh token.',
                    });
                } else {
                    next(null, decoded._id, decoded.login_id, decoded.bc_account_address);
                }
            });
        }, (id, loginId, bcAccountAddress, next) => {
            const payload = {
                _id: id,
                login_id: loginId,
                bc_account_address: bcAccountAddress,
            };

            const remoteAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const accessToken = authUtil.generateAccessToken(payload);
            const refreshToken = authUtil.generateRefreshToken(payload);
            userLoginDBO.findOneAndUpdate({
                _id: loginId,
                user_id: id,
            }, {
                $set: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    remote_address: remoteAddress,
                },
            }, {}, false, (error) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: userError.updateUserFailed,
                        message: 'Error occurred while updating the user.',
                    });
                } else {
                    next(null, {
                        status: 200,
                        result: {
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        },
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getUserProfileDetails = (req, res) => {
    const { _id } = req.user;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
            }, {}, {}, true, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result,
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

const updateUserProfileDetails = (req, res) => {
    const {
        _id,
    } = req.user;
    const {
        emailAddress,
    } = req.body;

    const updates = {};
    if (emailAddress) {
        updates.email_address = emailAddress;
    }

    async.waterfall([
        (next) => {
            userDBO.findOneAndUpdate({
                _id,
            }, {
                $set: updates,
            }, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    logger.error(error);
                    next({
                        error: userError.updateUserFailed,
                        message: 'Error occurred while updating the user.',
                    });
                } else {
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

const allowFeeGrant = (req, res) => {
    const {
        _id,
    } = req.user;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id,
            }, {
                bc_account_address: 1,
                social_accounts: 1,
                fee_grant: 1,
            }, {}, true, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    next(null, result.bc_account_address);
                    /**
                     if (result.fee_grant && result.fee_grant.status &&
                     result.fee_grant.status === 'CLAIMED') {
                        next({
                            error: userError.feeGrantAlreadyClaimed,
                            message: 'Fee Grant already claimed.',
                        });
                    } else {
                        if (result.social_accounts && result.social_accounts.twitter &&
                            result.social_accounts.twitter.status === 'VERIFIED') {
                            next(null, result.bc_account_address);
                        } else {
                            next({
                                error: userError.twitterNotVerified,
                                message: 'User twitter account not verified.',
                            });
                        }
                    }
                     */
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (bcAccountAddress, next) => {
            enableFeeGrant(bcAccountAddress, (error, txHash) => {
                if (error) {
                    next({
                        error: userError.feeGrantFailed,
                        message: error.message,
                    });
                } else {
                    next(null, txHash);
                }
            });
        }, (txHash, next) => {
            userDBO.findOneAndUpdate({
                _id,
            }, {
                $set: {
                    'fee_grant.status': 'CLAIMED',
                    'fee_grant.tx_hash': txHash,
                    'fee_grant.updated_at': new Date(),
                },
            }, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    logger.error(error.message);
                    next({
                        error: userError.updateUserFailed,
                        message: 'Error occurred while updating the user.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result: {
                            tx_hash: txHash,
                        },
                    });
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const addUser = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
        username,
        root_path: rootPath,
    } = req.user;
    const {
        bcAccountAddress,
        permissions,
        is_admin: isAdmin,
    } = req.body;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                bc_account_address: bcAccountAddress,
                media_space: mediaSpace,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    console.log(error);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while checking for existing user.',
                    });
                } else if (result) {
                    next({
                        status: 400,
                        error: userError.userAlreadyExists,
                        message: 'User with this blockchain account address already exists in this media space.',
                    });
                } else {
                    next(null);
                }
            });
        },
        (next) => {
            const otp = stringUtils.generateOTP(6);
            const authToken = `${bcAccountAddress.slice(-6)}${otp}`;
            const doc = {
                bc_account_address: bcAccountAddress,
                permissions,
                created_by: _id,
                auth_token: authToken,
                username: username || '',
                is_admin: isAdmin || false,
                root_path: rootPath,
                media_space: mediaSpace,
                broadcast_enabled: mediaSpace.broadcast_enabled || true,
            };
            userDBO.save(doc, false, (error, result) => {
                if (error) {
                    console.log(error);
                    next({
                        error: userError.saveUserFailed,
                        message: 'Error occurred while saving the new user.',
                    });
                } else {
                    next(null, {
                        status: 200,
                        message: 'New user added successfully.',
                        data: result,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateUser = (req, res) => {
    const {
        _id,
        media_space: mediaSpace,
    } = req.user;
    const {
        permissions,
    } = req.body;
    const {
        id,
    } = req.params;
    const updates = {
        permissions,
    };
    async.waterfall([
        (next) => {
            userDBO.findOneAndUpdate({
                _id: id,
                created_by: _id,
                media_space: mediaSpace,
            }, {
                $set: updates,
            }, {
                new: true,
            }, true, (error, result) => {
                if (error) {
                    console.log(error);
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while checking for existing user.',
                    });
                } else if (result) {
                    next(null, {
                        status: 201,
                        message: 'New user updated successfully.',
                        data: result,
                    });
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'user does not exists.',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const verifyJWT = (req, res) => {
    processJSONResponse(res, null, {
        status: 200,
        message: 'JWT verified',
    });
};

const addMediaNodeUser = (req, res) => {
    const {
        _id,
    } = req.user;
    const {
        bcAccountAddress,
        broadcastEnabled,
    } = req.body;

    async.waterfall([
        (next) => {
            mediaSpaceDBO.count({}, (error, count) => {
                if (error) {
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occurred while finding the media space.',
                    });
                } else if (count) {
                    next(null, count);
                } else {
                    next(null, 0);
                }
            });
        }, (count, next) => {
            const totalCores = os.cpus().length - 2;
            const totalMemory = (os.totalmem() / (1024 ** 2)).toFixed(2);

            const availableMediaSpaceCores = totalCores - (count * mediaSpaceConfig.coreLimit);
            const availableMediaSpaceMemory = totalMemory - (count * mediaSpaceConfig.memoryLimitInMB);

            if (availableMediaSpaceCores >= mediaSpaceConfig.coreLimit && availableMediaSpaceMemory >= mediaSpaceConfig.memoryLimitInMB) {
                next(null);
            } else {
                next({
                    error: mediaSpaceError.mediaSpaceFull,
                    message: 'Maximum number of media nodes reached.',
                });
            }
        }, (next) => {
            const otp = stringUtils.generateOTP(6);
            const authToken = `${bcAccountAddress.slice(-6)}${otp}`;
            const doc = {
                bc_account_address: bcAccountAddress,
                permissions: ['studio', 'runner', 'ipfs', 'streamer'],
                created_by: _id,
                auth_token: authToken,
                broadcast_enabled: broadcastEnabled,
            };
            userDBO.save(doc, false, (error, result) => {
                if (error) {
                    console.log(error);
                    next({
                        error: userError.saveUserFailed,
                        message: 'Error occurred while saving the new user.',
                    });
                } else {
                    next(null, result);
                }
            });
        }, (user, next) => {
            createNewUserSetup(user, (error, username, path, mediaSpaceId) => {
                if (error) {
                    next(error);
                } else {
                    next(null, user, username, path, mediaSpaceId);
                }
            });
        }, (user, username, path, mediaSpaceId, next) => {
            console.log('user path', path);
            userDBO.findOneAndUpdate({
                _id: user._id,
            }, {
                $set: {
                    username,
                    root_path: path,
                    media_space: mediaSpaceId,
                },
            }, {
                new: true,
            }, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.updateUserFailed,
                        message: 'Error occurred while updating the user.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        message: 'New user added successfully.',
                        result,
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

const getUserRootPath = (req, res) => {
    const {
        userId,
    } = req.params;

    async.waterfall([
        (next) => {
            userDBO.findOne({
                _id: userId,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result: result.root_path,
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

const getUserId = (req, res) => {
    let {
        username,
    } = req.params;

    async.waterfall([
        (next) => {
            if (username === 'ubuntu') {
                username = 'main';
            }
            mediaSpaceDBO.findOne({
                username,
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occurred while finding the media space.',
                    });
                } else if (result) {
                    next(null, result._id);
                } else {
                    next(null, null);
                }
            });
        }, (mediaSpaceId, next) => {
            userDBO.findOne({
                $or: [{
                    username,
                }, {
                    media_space: mediaSpaceId,
                }],
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the user.',
                    });
                } else if (result) {
                    next(null, {
                        status: 200,
                        result: result._id,
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

const getUsers = (req, res) => {
    const {
        createdBy,
    } = req.query;

    const conditions = {};
    if (createdBy) {
        conditions.created_by = createdBy;
    }

    async.waterfall([
        (next) => {
            userDBO.find(conditions, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the users.',
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

const getResourceUsageOfUser = (req, res) => {
    const {
        media_space: mediaSpace,
    } = req.user;

    const conditions = {
        _id: mediaSpace,
    };

    async.waterfall([
        (next) => {
            mediaSpaceDBO.findOne(conditions, {}, {}, false, (error, result) => {
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
            getResourceUsage(mediaSpace, (error, diskUsage, memoryUsage, cpuUsage) => {
                if (error) {
                    next(error);
                } else {
                    next(null, {
                        status: 200,
                        result: {
                            disk_usage: diskUsage,
                            memory_usage: memoryUsage,
                            cpu_usage: cpuUsage,
                        },
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getMediaSpaces = (req, res) => {
    const {
        bc_account_address: bcAccountAddress,
    } = req.user;

    async.waterfall([
        (next) => {
            userDBO.find({
                bc_account_address: bcAccountAddress,
            }, {
                media_space: 1,
            }, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: userError.findUserFailed,
                        message: 'Error occurred while finding the users.',
                    });
                } else if (result && result.length > 0) {
                    next(null, result);
                } else {
                    next({
                        error: userError.userDoesNotExist,
                        message: 'User does not exist.',
                    });
                }
            });
        }, (userList, next) => {
            const mediaSpaceIds = userList.map((user) => user.media_space);
            mediaSpaceDBO.find({
                _id: { $in: mediaSpaceIds },
            }, {}, {}, false, (error, result) => {
                if (error) {
                    next({
                        error: mediaSpaceError.findMediaSpaceFailed,
                        message: 'Error occurred while finding the media spaces.',
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

module.exports = {
    connectBCAccount,
    verifyBCAccount,
    refreshUserAccessToken,
    allowFeeGrant,
    getUserProfileDetails,
    updateUserProfileDetails,
    addUser,
    updateUser,
    verifyJWT,
    addMediaNodeUser,
    getUserRootPath,
    getUserId,
    getUsers,
    getResourceUsageOfUser,
    getMediaSpaces,
};
