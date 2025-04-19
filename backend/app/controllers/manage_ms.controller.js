const async = require('async');
const Axios = require('axios');
const childProcess = require('child_process');
const diskUsage = require('diskusage');
const fs = require('fs');
const os = require('os');
const mediaSpaceDBO = require('../dbos/media_space.dbo');
const mediaSpaceErrors = require('../errors/media_space.error');
const manageMsErrors = require('../errors/manage_ms.error');
const userDBO = require('../dbos/user.dbo');
const userErrors = require('../errors/user.error');
const configHelper = require('../helpers/config.helper');
const config = require('../../config');
const processJSONResponse = require('../utils/response.util');
const logger = require('../../logger');

const restartStudio = (req, res) => {
    const { data } = req.body;

    async.waterfall([
        (next) => {
            try {
                const { youtube, twitch, facebook } = data;
                const configData = {};
                if (youtube) {
                    configData.YOUTUBE_CLIENT_ID = youtube.clientId;
                    configData.YOUTUBE_CLIENT_SECRET = youtube.clientSecret;
                    configData.YOUTUBE_REDIRECT_URI = youtube.redirectUri;
                }
                if (twitch) {
                    configData.TWITCH_CLIENT_ID = twitch.clientId;
                    configData.TWITCH_CLIENT_SECRET = twitch.clientSecret;
                    configData.TWITCH_REDIRECT_URI = twitch.redirectUri;
                }
                if (facebook) {
                    configData.FACEBOOK_APP_ID = facebook.appId;
                    configData.FACEBOOK_APP_SECRET = facebook.appSecret;
                    configData.FACEBOOK_REDIRECT_URI = facebook.redirectUri;
                }
                configHelper.updateConfig('/etc/supervisor/conf.d/backend.conf', configData, (error) => {
                    if (error) {
                        next({
                            error: manageMsErrors.configUpdateFailed,
                            message: `${error.message}`,
                        });
                    } else {
                        next(null);
                    }
                });
            } catch (error) {
                next({
                    error: manageMsErrors.configUpdateFailed,
                    message: `${error.message}`,
                });
            }
        }, (next) => {
            childProcess.exec('supervisorctl reread && supervisorctl update', (err, stdout, stderr) => {
                if (err) {
                    next({
                        error: manageMsErrors.configUpdateFailed,
                        message: 'Error occurred while updating supervisor configuration',
                        info: `${err.message}`,
                    });
                } else if (stderr) {
                    next({
                        error: manageMsErrors.configUpdateFailed,
                        message: 'Console error occurred while updating supervisor configuration',
                        info: `${stderr}`,
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            setTimeout(() => {
                childProcess.exec('supervisorctl restart backend', (err, stdout, stderr) => {
                    if (err) {
                        logger.error(err);
                    } else if (stderr) {
                        logger.error(stderr);
                    }
                });
            }, 5000);
            next(null, {
                status: 200,
                message: 'Studio restart triggered successsfully!',
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const restartNginx = (req, res) => {
    async.waterfall([
        (next) => {
            childProcess.exec('supervisorctl restart nginx', (err, stdout, stderr) => {
                if (err) {
                    next({
                        error: manageMsErrors.restartFailed,
                        message: 'Error occurred while restarting NGINX',
                        info: `${err.message}`,
                    });
                } else if (stdout) {
                    if (stdout.includes('started')) {
                        next(null, {
                            status: 200,
                            message: 'NGINX restarted successfully!',
                        });
                    } else {
                        next({
                            error: manageMsErrors.restartFailed,
                            message: 'NGINX failed to start',
                            info: `${stdout}`,
                        });
                    }
                } else {
                    next({
                        error: manageMsErrors.restartFailed,
                        message: 'Error occurred while reloading NGINX',
                        info: `${stderr}`,
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getStudioConfig = (req, res) => {
    async.waterfall([
        (next) => {
            configHelper.getConfig('/etc/supervisor/conf.d/backend.conf', (error, data) => {
                if (error) {
                    next({
                        error: manageMsErrors.readConfigFailed,
                        message: 'Error occurred while reading environment variables',
                        info: `${error.message}`,
                    });
                } else if (data) {
                    next(null, {
                        status: 200,
                        result: data,
                    });
                } else {
                    next({
                        error: manageMsErrors.readConfigFailed,
                        message: 'Backend environment variables not found',
                    });
                }
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getStatus = (req, res) => {
    async.waterfall([
        (next) => {
            const url = `http://${config.runner.ip}:${config.runner.port}/status`;
            Axios({
                method: 'get',
                url,
            }).then((res) => {
                if (res && res.data && res.data.success) {
                    next(null, true);
                } else {
                    next(null, false);
                }
            }).catch(() => {
                next(null, false);
            });
        }, (runnerStatus, next) => {
            childProcess.exec('supervisorctl status nginx', (err, stdout, stderr) => {
                if (err) {
                    next(null, runnerStatus, false);
                } else if (stdout) {
                    next(null, runnerStatus, stdout.includes('RUNNING'));
                } else {
                    next(null, runnerStatus, false);
                }
            });
        }, (runnerStatus, nginxStatus, next) => {
            next(null, {
                status: 200,
                result: {
                    runner: runnerStatus ? 'ACTIVE' : 'INACTIVE',
                    nginx: nginxStatus ? 'ACTIVE' : 'INACTIVE',
                    studio: 'ACTIVE',
                },
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getMediaSpaceSlots = (req, res) => {
    async.waterfall([
        (next) => {
            mediaSpaceDBO.count({}, (error, count) => {
                if (error) {
                    next({
                        error: mediaSpaceErrors.findCountFailed,
                        message: 'Error occured while fetching media space count',
                        info: `${error.message}`,
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

            const availableMediaSpaceCores = totalCores - (count * config.mediaSpace.coreLimit);
            const availableMediaSpaceMemory = totalMemory - (count * config.mediaSpace.memoryLimitInMB);

            const numberOfSlotsCores = Math.floor(availableMediaSpaceCores / config.mediaSpace.coreLimit);
            const numberOfSlotsMemory = Math.floor(availableMediaSpaceMemory / config.mediaSpace.memoryLimitInMB);

            let numberOfSlots = Math.min(numberOfSlotsCores, numberOfSlotsMemory);

            if (numberOfSlots < 0) {
                numberOfSlots = 0;
            }

            next(null, {
                status: 200,
                result: {
                    available: numberOfSlots,
                    used: count,
                },
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getHardwareSpecs = (req, res) => {
    async.waterfall([
        (next) => {
            let totalCores = 0;
            let memoryLimitGB = 0;
            try {
                const memoryLimit = fs.readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim();
                if (memoryLimit === 'max') {
                    const totalMemory = os.totalmem();
                    memoryLimitGB = (totalMemory / (1024 ** 3)).toFixed(2);
                } else {
                    memoryLimitGB = (parseInt(memoryLimit, 10) / (1024 ** 3)).toFixed(2);
                }
            } catch (error) {
                logger.error(error.message);
                const totalMemory = os.totalmem();
                memoryLimitGB = (totalMemory / (1024 ** 3)).toFixed(2);
            }
            try {
                const cpuCount = fs.readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim();
                const [quota, period] = cpuCount.split(' ');
                if (quota === 'max') {
                    totalCores = os.cpus().length;
                } else {
                    totalCores = parseInt(quota) / parseInt(period);
                }
            } catch (error) {
                logger.error(error.message);
                totalCores = os.cpus().length;
            }

            diskUsage.check('/').then((stats) => {
                const totalStorageGB = (stats.total / (1024 ** 3)).toFixed(2);
                next(null, {
                    status: 200,
                    result: {
                        cpus: totalCores,
                        memory: memoryLimitGB + ' GB',
                        storage: totalStorageGB + ' GB',
                    },
                });
            }).catch((error) => {
                logger.error(error.message);
                next(null, {
                    status: 200,
                    result: {
                        cpus: totalCores,
                        memory: memoryLimitGB + ' GB',
                        storage: 'N/A',
                    },
                });
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getHardwareStats = (req, res) => {
    async.waterfall([
        (next) => {
            try {
                const readCgroupValue = (filePath, defaultValue) => {
                    try {
                        const value = fs.readFileSync(filePath, 'utf8').trim();
                        return value === 'max' ? defaultValue : parseInt(value, 10);
                    } catch (err) {
                        return defaultValue;
                    }
                };
                const cpuQuota = fs.readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim();
                let totalCores = 0;
                const [quota, period] = cpuQuota.split(' ');
                if (quota === 'max') {
                    totalCores = os.cpus().length;
                } else {
                    totalCores = parseInt(quota) / parseInt(period);
                }

                const cpuStatFile = '/sys/fs/cgroup/cpu.stat';
                let cpuUsagePercent = 0;
                if (fs.existsSync(cpuStatFile)) {
                    const cpuStats = fs.readFileSync(cpuStatFile, 'utf8').split('\n');
                    const usageLine = cpuStats.find(line => line.startsWith('usage_usec'));
                    if (usageLine) {
                        const usageMicroseconds = parseInt(usageLine.split(' ')[1], 10);
                        cpuUsagePercent = ((usageMicroseconds / 1000000) / os.uptime()) * 100 / totalCores;
                    }
                }
                const totalMemory = readCgroupValue('/sys/fs/cgroup/memory.max', os.totalmem());
                let freeMemory = os.freemem();
                let usedMemory = totalMemory - freeMemory;

                if (usedMemory < 0) {
                    usedMemory = 0;
                    freeMemory = totalMemory;
                }

                const formatBytes = (bytes) => (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';

                diskUsage.check('/').then((stats) => {
                    const totalDisk = stats.total;
                    const freeDisk = stats.free;
                    const usedDisk = totalDisk - freeDisk;

                    next(null, {
                        status: 200,
                        result: {
                            cpu: {
                                total: totalCores,
                                used: cpuUsagePercent.toFixed(5),
                            },
                            memory: {
                                total: formatBytes(totalMemory),
                                used: formatBytes(usedMemory),
                                free: formatBytes(freeMemory),
                            },
                            storage: {
                                total: formatBytes(totalDisk),
                                used: formatBytes(usedDisk),
                                free: formatBytes(freeDisk),
                            },
                        },
                    });
                }).catch((error) => {
                    logger.error(error.message);
                    next(null, {
                        status: 200,
                        result: {
                            cpu: {
                                total: totalCores,
                                used: cpuUsagePercent.toFixed(2),
                            },
                            memory: {
                                total: formatBytes(totalMemory),
                                used: formatBytes(usedMemory),
                                free: formatBytes(freeMemory),
                            },
                            storage: {
                                total: 'N/A',
                                used: 'N/A',
                                free: 'N/A',
                                error: error.message,
                            },
                        },
                    });
                });
            } catch (error) {
                logger.error(error.message);
                next({
                    error: manageMsErrors.readConfigFailed,
                    message: 'Error occurred while reading hardware stats',
                    info: `${error.message}`,
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const updateMediaSpaceLease = (req, res) => {
    const user = req.user;
    const { enable } = req.body;

    async.waterfall([
        (next) => {
            if (user && user.is_media_node_admin) {
                next(null);
            } else {
                next({
                    error: manageMsErrors.unauthorized,
                    message: 'Unauthorized access.',
                });
            }
        }, (next) => {
            const backendConfPath = '/etc/supervisor/conf.d/backend.conf';

            try {
                const config = fs.readFileSync(backendConfPath, 'utf8');
                const configLines = config.split('\n');
                const newConfigLines = configLines.map(line => {
                    if (line.includes('MEDIA_SPACE_FOR_LEASE=true')) {
                        line = line.replace('MEDIA_SPACE_FOR_LEASE=true', `MEDIA_SPACE_FOR_LEASE=${enable}`);
                    } else if (line.includes('MEDIA_SPACE_FOR_LEASE=false')) {
                        line = line.replace('MEDIA_SPACE_FOR_LEASE=false', `MEDIA_SPACE_FOR_LEASE=${enable}`);
                    }
                    return line;
                });

                const newConfig = newConfigLines.join('\n');
                fs.writeFileSync(backendConfPath, newConfig);

                next(null);

                setTimeout(() => {
                    childProcess.exec('supervisorctl reread && supervisorctl update && supervisorctl restart backend', (err, stdout, stderr) => {
                        if (err) {
                            logger.error('Error updating supervisor:', err);
                        } else if (stderr) {
                            logger.error('Supervisor update stderr:', stderr);
                        } else {
                            logger.info('Supervisor configuration updated successfully');
                        }
                    });
                }, 5000);
            } catch (error) {
                next({
                    error: manageMsErrors.updateFailed,
                    message: 'Failed to update media space lease configuration',
                    info: error.message,
                });
            }
        }, (next) => {
            if (enable === true) {
                const updates = {
                    is_admin: '',
                    permissions: '',
                    media_space: '',

                };
                userDBO.findOneAndUpdate({
                    _id: user._id,
                }, {
                    $unset: updates,
                }, {}, false, (error, result) => {
                    if (error) {
                        logger.error(error.message);
                        next({
                            error: userErrors.updateUserFailed,
                            message: 'Error occured while updating the user',
                            info: `${error.message}`,
                        });
                    } else if (result) {
                        next(null, {
                            status: 200,
                            message: 'Media space lease configuration updated successfully. Please wait for the changes to take effect.',
                        });
                    } else {
                        next({
                            error: userErrors.userDoesNotExist,
                            message: 'User does not exist',
                        });
                    }
                });
            } else {
                next(null, {
                    status: 200,
                    message: 'Media space lease configuration updated successfully. Please wait for the changes to take effect.',
                });
            }
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const checkConfig = (req, res) => {
    async.waterfall([
        (next) => {
            const result = {};
            if (config.youtube.clientId && config.youtube.clientId.length > 0 &&
                config.youtube.clientSecret && config.youtube.clientSecret.length > 0 &&
                config.youtube.redirectUri && config.youtube.redirectUri.length > 0) {
                result.youtube = true;
            } else {
                result.youtube = false;
            }
            if (config.twitch.clientId && config.twitch.clientId.length > 0 &&
                config.twitch.clientSecret && config.twitch.clientSecret.length > 0 &&
                config.twitch.redirectUri && config.twitch.redirectUri.length > 0) {
                result.twitch = true;
            } else {
                result.twitch = false;
            }
            if (config.facebook.apiUrl && config.facebook.apiUrl.length > 0 &&
                config.facebook.appId && config.facebook.appId.length > 0 &&
                config.facebook.appSecret && config.facebook.appSecret.length > 0) {
                result.facebook = true;
            } else {
                result.facebook = false;
            }
            next(null, {
                status: 200,
                result,
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

const getGeolocation = (req, res) => {
    async.waterfall([
        (next) => {
            const url = 'http://ip-api.com/json';
            Axios({
                method: 'get',
                url,
            }).then((response) => {
                if (response && response.data && response.data.status === 'success') {
                    const formattedData = {
                        country: response.data.country,
                        countryCode: response.data.countryCode,
                        region: response.data.region,
                        regionName: response.data.regionName,
                    };
                    next(null, {
                        status: 200,
                        result: formattedData,
                    });
                } else {
                    next({
                        error: manageMsErrors.readConfigFailed,
                        message: 'Error occurred while fetching geolocation',
                    });
                }
            }).catch((error) => {
                next({
                    error: manageMsErrors.readConfigFailed,
                    message: 'Error occurred while fetching geolocation',
                    info: `${error.message}`,
                });
            });
        },
    ], (error, result) => {
        processJSONResponse(res, error, result);
    });
};

module.exports = {
    restartStudio,
    restartNginx,
    getStudioConfig,
    getStatus,
    getMediaSpaceSlots,
    getHardwareSpecs,
    getHardwareStats,
    updateMediaSpaceLease,
    checkConfig,
    getGeolocation,
};
