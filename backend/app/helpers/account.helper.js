const async = require('async');
const { bech32 } = require('bech32');
const Axios = require('axios');
const AxiosRetry = require('axios-retry');
const { Buffer } = require('buffer');
const childProcess = require('child_process');
const { recoverPersonalSignature } = require('eth-sig-util');
const { bufferToHex } = require('ethereumjs-utils');
const fs = require('fs');
const assetDBO = require('../dbos/asset.dbo');
const assetCategoryDBO = require('../dbos/asset_category.dbo');
const liveStreamDBO = require('../dbos/live_stream.dbo');
const liveStreamError = require('../errors/live_stream.error');
const mediaSpaceDBO = require('../dbos/media_space.dbo');
const mediaSpaceError = require('../errors/media_space.error');
const userDBO = require('../dbos/user.dbo');
const userError = require('../errors/user.error');
const configHelper = require('./config.helper');
const stringUtils = require('../utils/string.util');
const logger = require('../../logger');
const config = require('../../config');
AxiosRetry(Axios, {
    retries: 3,
    retryDelay: (retryCount) => {
        console.log(`retry attempt: ${retryCount}`);
        return retryCount * 2000; // time interval between retries
    },
});
const {
    verifySignature,
} = require('@tendermint/sig');

const {
    flixnet,
    cosmos,
    akash,
    sentinel,
    osmosis,
    iris,
    juno,
    mediaSpace: mediaSpaceConfig,
    server,
} = require('../../config');

const verifySign = (network, address, sign, authCode, cb) => {
    async.waterfall([
        (next) => {
            const url = `${network.apiAddress}/cosmos/auth/v1beta1/accounts/${address}`;
            Axios({
                method: 'get',
                url,
            }).then(res => {
                if (res && res.data && res.data.account && res.data.account.address) {
                    res.data.account.account_number = res.data.account.account_number || '0';
                    res.data.account.sequence = res.data.account.sequence || '0';
                    next(null, res.data);
                } else if (res && res.data && res.data.account && res.data.account.base_vesting_account && res.data.account.base_vesting_account.base_account) {
                    res.data.account.account_number = res.data.account.base_vesting_account.base_account.account_number || '0';
                    res.data.account.sequence = res.data.account.base_vesting_account.base_account.sequence || '0';
                    next(null, res.data);
                } else {
                    const data = {
                        account: {
                            account_number: '0',
                            sequence: '0',
                        },
                    };
                    next(null, data);
                }
            }).catch((error) => {
                if (error && error.response && error.response.data && (!error.response.data.details || !error.response.data.details.length)) {
                    const data = {
                        account: {
                            account_number: '0',
                            sequence: '0',
                        },
                    };
                    next(null, data);
                } else {
                    const data = {
                        account: {
                            account_number: '0',
                            sequence: '0',
                        },
                    };
                    next(null, data);
                }
            });
        }, (addressInfo, next) => {
            // console.log(addressInfo)
            const msg = {
                chain_id: network.chainId,
                account_number: addressInfo.account.account_number,
                sequence: addressInfo.account.sequence,
                fee: {
                    gas: '1',
                    amount: [
                        {
                            denom: network.coin.denom,
                            amount: '0',
                        },
                    ],
                },
                msgs: [
                    {
                        type: 'omniflix/MsgSign',
                        value: {
                            address: address,
                        },
                    },
                ],
                memo: authCode.toString(),
            };
            try {
                // console.log(msg,sign)
                const valid = verifySignature(msg, sign);
                // console.log(valid)
                if (valid) {
                    next(null, true);
                } else {
                    const error = {
                        message: 'Invalid signature.',
                    };
                    next(error);
                }
            } catch (e) {
                console.log(e);
                const error = {
                    message: 'Invalid signature.',
                };
                next(error);
            }
        },
    ], cb);
};

const isValidFlixNetAddres = (address) => {
    try {
        const data = bech32.decode(address);
        return data.prefix === 'omniflix';
    } catch (e) {
        console.log(e);
        return false;
    }
};

const isValidBech32Address = (address) => {
    try {
        const data = bech32.decode(address);
        return !!data;
    } catch (e) {
        return false;
    }
};

const decodeEthSignature = (signature, nonce) => {
    const msg = `I am signing my one-time nonce: ${nonce}`;
    const msgBufferHex = bufferToHex(Buffer.from(msg, 'utf8'));
    const address = recoverPersonalSignature({
        data: msgBufferHex,
        sig: signature,
    });

    return address;
};

const decodeAndVerifySignature = (address, sign, memo, cb) => {
    async.waterfall([
        (next) => {
            // next(null)
            if (sign && sign.signature && sign.pub_key) {
                try {
                    const data = bech32.decode(address);
                    next(null, 'cosmos', data.prefix);
                } catch (e) {
                    next('Invalid address.');
                }
            } else if (sign && sign.signature && (sign.pub_key === undefined)) {
                next(null, 'eth', null);
            } else {
                next('Invalid signature.');
            }
        }, (networkType, prefix, next) => {
            if (networkType === 'cosmos') {
                if (prefix === 'omniflix') {
                    // console.log("aaa",address,sign,memo)
                    verifySign(flixnet, address, sign, memo, (error, address) => {
                        if (error) {
                            next(error);
                        } else {
                            next(null, address);
                        }
                    });
                } else if (prefix === 'cosmos') {
                    verifySign(cosmos, address, sign, memo, (error, address) => {
                        if (error) {
                            next(error);
                        } else {
                            next(null, address);
                        }
                    });
                } else if (prefix === 'akash') {
                    verifySign(akash, address, sign, memo, (error, address) => {
                        if (error) {
                            next(error);
                        } else {
                            next(null, address);
                        }
                    });
                } else if (prefix === 'sent') {
                    verifySign(sentinel, address, sign, memo, (error, address) => {
                        if (error) {
                            next(error);
                        } else {
                            next(null, address);
                        }
                    });
                } else if (prefix === 'iaa') {
                    verifySign(iris, address, sign, memo, (error, address) => {
                        if (error) {
                            next(error);
                        } else {
                            next(null, address);
                        }
                    });
                } else if (prefix === 'osmo') {
                    verifySign(osmosis, address, sign, memo, (error, address) => {
                        if (error) {
                            next(error);
                        } else {
                            next(null, address);
                        }
                    });
                } else if (prefix === 'juno') {
                    verifySign(juno, address, sign, memo, (error, address) => {
                        if (error) {
                            next(error);
                        } else {
                            next(null, address);
                        }
                    });
                } else {
                    next('Invalid network.');
                }
            } else if (networkType === 'eth') {
                const ethAddress = decodeEthSignature(sign.signature, memo);
                next(null, ethAddress);
            } else {
                next('Invalid network.');
            }
        }, (decodedAddress, next) => {
            if (decodedAddress === address) {
                next(null);
            } else {
                next('Invalid signature.');
            }
        },
    ], cb);
};

const verifyLeasedAccount = (address, isAdmin, cb) => {
    let assetCategory;
    async.waterfall([
        (next) => {
            mediaSpaceDBO.findOne({
                username: 'main',
            }, {}, {
                created_at: 1,
            }, false, (error, result) => {
                if (error) {
                    logger.error('Error occurred while finding the media space.', error);
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
            const url = `${flixnet.apiAddress}/omniflix/medianode/v1beta1/lease/${mediaSpaceConfig.id}`;
            console.log('url', url);
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
                if (error && error.response && error.response.data && error.response.data.code === 5) {
                    next({
                        error: mediaSpaceError.leaseDoesNotExist,
                        message: 'Lease does not exist on the media node.',
                    });
                } else {
                    next({
                        error: mediaSpaceError.failedToFetchData,
                        message: 'Failed to fetch data from OmniFlix network API.',
                    });
                }
            });
        }, (mediaSpace, data, next) => {
            if (data.lease && data.lease.start_time && data.lease.leased_hours &&
                (new Date(data.lease.start_time).getTime() + parseInt(data.lease.leased_hours) * 3600 * 1000) > Date.now() &&
                data.lease.media_node_id === mediaSpaceConfig.id) {
                console.log('data.lease.leasee', data.lease.lessee);
                console.log('address', address);
                if (data.lease.lessee === address) {
                    next(null, mediaSpace, data.lease);
                } else {
                    next({
                        error: mediaSpaceError.leaseExpired,
                        message: 'User is not authorized to access this media node.',
                    });
                }
            } else {
                next({
                    error: mediaSpaceError.mediaSpaceDoesNotExist,
                    message: 'Media node lease is not active.',
                });
            }
        }, (mediaSpace, lease, next) => {
            if (isAdmin) {
                const otp = stringUtils.generateOTP(6);
                const authToken = `${address.slice(-6)}${otp}`;
                const updates = {
                    permissions: ['studio', 'runner', 'ipfs', 'streamer'],
                    auth_token: authToken,
                    broadcast_enabled: true,
                    is_admin: true,
                    media_space: mediaSpace._id,
                    root_path: '/home/ubuntu',
                };
                if (mediaSpaceConfig.broadcastEnabled === 'false') {
                    updates.broadcast_enabled = false;
                }
                userDBO.findOneAndUpdate({
                    bc_account_address: address,
                }, {
                    $set: updates,
                }, {
                    new: true,
                }, false, (error, result) => {
                    if (error) {
                        logger.error('Error occurred while saving the user.', error);
                        next({
                            error: userError.saveUserFailed,
                            message: 'Error occurred while saving the user.',
                        });
                    } else if (result) {
                        next(null, mediaSpace, lease, result);
                    } else {
                        next({
                            error: userError.saveUserFailed,
                            message: 'Error occurred while saving the user.',
                        });
                    }
                });
            } else {
                const otp = stringUtils.generateOTP(6);
                const authToken = `${address.slice(-6)}${otp}`;
                const doc = {
                    bc_account_address: address,
                    permissions: ['studio', 'runner', 'ipfs', 'streamer'],
                    auth_token: authToken,
                    broadcast_enabled: true,
                    is_admin: true,
                    media_space: mediaSpace._id,
                    root_path: '/home/ubuntu',
                };
                if (mediaSpaceConfig.broadcastEnabled === 'false') {
                    doc.broadcast_enabled = false;
                }
                userDBO.save(doc, false, (error, result) => {
                    if (error) {
                        logger.error('Error occurred while saving the user.', error);
                        next({
                            error: userError.saveUserFailed,
                            message: 'Error occurred while saving the user.',
                        });
                    } else if (result) {
                        next(null, mediaSpace, lease, result);
                    } else {
                        next({
                            error: userError.saveUserFailed,
                            message: 'Error occurred while saving the user.',
                        });
                    }
                });
            }
        }, (mediaSpace, lease, user, next) => {
            const doc = {
                name: 'Demo',
                media_space: mediaSpace._id,
                user: user._id,
            };
            assetCategoryDBO.save(doc, false, (error, result) => {
                if (error) {
                    logger.error('Error occurred while saving the asset category.', error);
                } else if (result) {
                    assetCategory = result._id;
                }
                next(null, mediaSpace, lease, user);
            });
        }, (mediaSpace, lease, user, next) => {
            const doc = {
                name: 'Media Node Live Stream',
                media_space: mediaSpace._id,
                created_by: user._id,
                configuration: {
                    broadcast_config: {
                        stream_url: `rtmp://localhost:1935/${mediaSpace.id}/broadcast`,
                        stream_key: `${stringUtils.randomString(10)}`,
                    },
                    live_feed_config: {
                        stream_url: `rtmp://${server.ip}:${config.nginx.rtmpPort}/${mediaSpace.id}/live_feed`,
                        stream_key: `${stringUtils.randomString(10)}`,
                    },
                    broadcast_enabled: mediaSpace.broadcast_enabled,
                },
                slot_configuration: {
                    slot_length: 3600,
                    content_auto_fill_enabled: true,
                    fillers: {
                        tags: ['demo'],
                        categories: [assetCategory],
                    },
                },
            };

            liveStreamDBO.save(doc, false, (error, result) => {
                if (error) {
                    logger.error('Error occurred while saving the live stream.', error);
                    next({
                        error: liveStreamError.saveLiveStreamFailed,
                        message: 'Error occurred while saving the live stream.',
                    });
                } else if (result) {
                    next(null, mediaSpace, lease, user, result);
                } else {
                    next({
                        error: liveStreamError.saveLiveStreamFailed,
                        message: 'Error occurred while saving the live stream.',
                    });
                }
            });
        }, (mediaSpace, lease, user, liveStream, next) => {
            const streamConfigData = {
                configuration: liveStream.configuration,
                username: mediaSpace.username,
                media_space: mediaSpace,
            };
            if (liveStream.extra_destinations && liveStream.extra_destinations.length > 0) {
                streamConfigData.extra_destinations = liveStream.extra_destinations;
            }
            const { rtmpPath, rtmpConfigDetails, nginxConfigDetails } = configHelper.configureRTMPandNGINXSettings(streamConfigData);
            configHelper.rtmpConfig(rtmpPath, rtmpConfigDetails, streamConfigData.configuration.broadcast_enabled, (error) => {
                if (error) {
                    logger.error(error.message);
                } else {
                    next(null, mediaSpace, lease, user, liveStream, nginxConfigDetails);
                }
            });
        }, (mediaSpace, lease, user, liveStream, nginxConfigDetails, next) => {
            configHelper.nginxConfig(config.nginx.path, nginxConfigDetails, (error) => {
                if (error) {
                    logger.error(error.message);
                }
                next(null, mediaSpace, lease, user, liveStream);
            });
        }, (mediaSpace, lease, user, liveStream, next) => {
            configHelper.updateStreamKeys(config.streamer.stream_keys_path, mediaSpace.username, mediaSpace.id, liveStream.configuration.broadcast_config.stream_key, liveStream.configuration.live_feed_config.stream_key, (error) => {
                if (error) {
                    logger.error('Error occurred while updating the stream keys.', error);
                }
                next(null, mediaSpace, lease, user);
            });
        }, (mediaSpace, lease, user, next) => {
            childProcess.exec('nginx -s reload', (err, stdout, stderr) => {
                if (err) {
                    logger.error(err.message);
                } else if (stderr) {
                    logger.error(stderr.message);
                }
                next(null, mediaSpace, lease, user);
            });
        }, (mediaSpace, lease, user, next) => {
            const expiry = new Date(lease.start_time).getTime() + (parseInt(lease.leased_hours) * 60 * 60 * 1000);
            const updates = {
                lease: {
                    lessee: user._id,
                    start_time: lease.start_time,
                    leased_hours: lease.leased_hours,
                    status: 'LEASE_STATUS_ACTIVE',
                    last_settled_at: lease.last_settled_at,
                    expiry: expiry,
                },
            };
            mediaSpaceDBO.findOneAndUpdate({
                _id: mediaSpace._id,
            }, {
                $set: updates,
            }, {}, false, (error, result) => {
                if (error) {
                    logger.error('Error occurred while updating the media space.', error);
                    next({
                        error: mediaSpaceError.updateMediaSpaceFailed,
                        message: 'Error occurred while updating the media space.',
                    });
                } else if (result) {
                    next(null, user);
                } else {
                    next({
                        error: mediaSpaceError.mediaSpaceDoesNotExist,
                        message: 'Media space does not exist.',
                    });
                }
            });
        }, (user, next) => {
            fs.readFile(mediaSpaceConfig.assetsPath, 'utf8', (err, data) => {
                if (err) {
                    logger.error('Error reading assets.json file', err);
                }
                next(null, user, data);
            });
        }, (user, data, next) => {
            try {
                const assets = JSON.parse(data);
                const updatedAssets = assets.map(asset => ({
                    ...asset,
                    media_space: user.media_space,
                    category: assetCategory,
                    is_default_asset: true,
                }));

                async.forEachLimit(updatedAssets, 10, (asset, callback) => {
                    assetDBO.save(asset, false, (error) => {
                        if (error) {
                            callback(error);
                        } else {
                            callback(null);
                        }
                    });
                }, (error) => {
                    if (error) {
                        logger.error('Error occurred while saving assets', error);
                    }
                    next(null, user);
                });
            } catch (parseError) {
                logger.error('Error parsing assets.json file', parseError);
                next(null, user);
            }
        },
    ], cb);
};

module.exports = {
    isValidFlixNetAddres,
    isValidBech32Address,
    verifySign,
    decodeAndVerifySignature,
    verifyLeasedAccount,
};
