const async = require('async');
const bcryptjs1 = require('bcryptjs');
const childProcess = require('child_process');
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const path = require('path');
const configHelper = require('./config.helper');
const liveStreamHelper = require('./live_stream.helper');
const mediaSpaceHelper = require('./media_space.helper');
const mediaSpaceError = require('../errors/media_space.error');
const userError = require('../errors/user.error');
const templateUtil = require('../utils/template.util');
const config = require('../../config');

const hashPassword = (plainPassword, cb) => {
    bcryptjs1.hash(plainPassword, 10, cb);
};

const comparePassword = (hashedPassword, plainPassword, cb) => {
    bcryptjs1.compare(plainPassword, hashedPassword, cb);
};

const saveProfileImage = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const userId = req.user._id.toString();
            const destinationPath = path.join('uploads', 'users', userId);

            fs.mkdir(destinationPath, {
                recursive: true,
            }, (error) => {
                cb(error, destinationPath);
            });
        },
        filename: (req, file, cb) => {
            const filename = file.originalname.split('.').slice(0, -1).join('.') +
                '_' + Date.now().toString() + '.' + file.originalname.split('.').pop();
            cb(null, filename);
        },
    }),
}).single('file');

const saveAdminProfileImage = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const userId = req.user._id.toString();
            const destinationPath = path.join('uploads', 'admin_users', userId);

            fs.mkdir(destinationPath, {
                recursive: true,
            }, (error) => {
                cb(error, destinationPath);
            });
        },
        filename: (req, file, cb) => {
            const filename = file.originalname.split('.').slice(0, -1).join('.') +
                '_' + Date.now().toString() + '.' + file.originalname.split('.').pop();
            cb(null, filename);
        },
    }),
}).single('file');

const updateStreamerFiles = (baseUbuntuPath, targetUserPath, streamUsername, streamBroadcastKey, streamLiveKey, callback) => {
    async.waterfall([
        (next) => {
            const scriptPaths = [
                `${targetUserPath}/streamer/stream.py`,
                `${targetUserPath}/streamer/scripts/update_config_to_broadcast.py`,
                `${targetUserPath}/streamer/scripts/update_config.py`,
            ];

            async.forEachLimit(scriptPaths, 1, (filePath, fileCallback) => {
                fs.readFile(filePath, 'utf8', (err, fileData) => {
                    if (err) {
                        const readError = new Error(`Error reading ${filePath}`);
                        readError.originalError = err;
                        fileCallback(readError);
                        return;
                    }

                    const updatedContent = fileData.replace(new RegExp(baseUbuntuPath, 'g'), targetUserPath);
                    fs.writeFile(filePath, updatedContent, (writeErr) => {
                        if (writeErr) {
                            const updateError = new Error(`Error updating ${filePath}`);
                            updateError.originalError = writeErr;
                            fileCallback(updateError);
                            return;
                        }
                        fileCallback(null);
                    });
                });
            }, (error) => {
                if (error) {
                    next({
                        error: userError.updateStreamerFilesFailed,
                        message: error.message,
                        info: error.originalError,
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            const shellScriptPaths = [
                `${targetUserPath}/streamer/scripts/stream_status.sh`,
            ];

            async.forEachLimit(shellScriptPaths, 1, (filePath, fileCallback) => {
                fs.readFile(filePath, 'utf8', (err, fileData) => {
                    if (err) {
                        const readError = new Error(`Error reading ${filePath}`);
                        readError.originalError = err;
                        fileCallback(readError);
                        return;
                    }

                    let updatedContent = fileData.replace(new RegExp(baseUbuntuPath, 'g'), targetUserPath);
                    updatedContent = updatedContent.replace('omniflixStream', `streamer-${streamUsername}`);

                    fs.writeFile(filePath, updatedContent, (writeErr) => {
                        if (writeErr) {
                            const updateError = new Error(`Error updating ${filePath}`);
                            updateError.originalError = writeErr;
                            fileCallback(updateError);
                        } else {
                            fileCallback(null);
                        }
                    });
                });
            }, (error) => {
                if (error) {
                    next({
                        error: userError.updateStreamerFilesFailed,
                        message: error.message,
                        info: error.originalError,
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            const configFilePath = `${targetUserPath}/streamer/config.json`;
            fs.readFile(configFilePath, 'utf8', (err, configData) => {
                if (err) {
                    next({
                        error: userError.readFileFailed,
                        message: 'Error reading config.json',
                        info: err,
                    });
                } else if (configData) {
                    next(null, configData, configFilePath);
                } else {
                    next({
                        error: userError.readFileFailed,
                        message: `File ${configFilePath} is empty`,
                    });
                }
            });
        }, (configData, configFilePath, next) => {
            try {
                const config = JSON.parse(configData);

                config.root_dir = config.root_dir.replace(baseUbuntuPath, targetUserPath);
                if (config.default_video_file) {
                    config.default_video_file = config.default_video_file.replace(baseUbuntuPath, targetUserPath);
                }
                if (config.default_playlist) {
                    config.default_playlist = config.default_playlist.replace(baseUbuntuPath, targetUserPath);
                }
                if (config.fonts_dir) {
                    config.fonts_dir = config.fonts_dir.replace(baseUbuntuPath, targetUserPath);
                }

                config.broadcast_config.stream_key = streamBroadcastKey;
                config.live_feed_config.stream_key = streamLiveKey;

                fs.writeFile(configFilePath, JSON.stringify(config, null, 4), (err) => {
                    if (err) {
                        next({
                            error: userError.readFileFailed,
                            message: 'Error updating config.json',
                            info: err,
                        });
                    } else {
                        next(null);
                    }
                });
            } catch (error) {
                next({
                    error: userError.readFileFailed,
                    message: 'Error parsing config.json',
                    info: error,
                });
            }
        },
    ], callback);
};

const createNewUserSetup = (newUser, completionCallback) => {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const newUsername = `user${randomDigits}`;

    const mediaNodeDataPath = `/home/${newUsername}/media-node-data`;
    const baseUbuntuPath = '/home/ubuntu';
    const newUserPath = `/home/${newUsername}`;

    async.waterfall([
        (next) => {
            const newPassword = `pass@${newUser.bc_account_address.slice(-6)}`;
            childProcess.exec(`adduser --disabled-password --gecos "" ${newUsername} && echo "${newUsername}:${newPassword}" | chpasswd`, (error, stdout, stderr) => {
                if (error) {
                    next({
                        error: userError.createUserFailed,
                        message: 'Error occurred while creating the new user.',
                        info: error,
                    });
                } else if (stderr) {
                    next({
                        error: userError.createUserFailed,
                        message: 'Error occurred while creating the new user.',
                        info: stderr,
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            childProcess.exec(`mkdir -p ${mediaNodeDataPath}`, (error, stdout, stderr) => {
                if (error) {
                    next({
                        error: userError.createDirectoryFailed,
                        message: 'Error occurred while creating data folder for the new user.',
                        info: error,
                    });
                } else if (stderr) {
                    next({
                        error: userError.createDirectoryFailed,
                        message: 'Error occurred while creating data folder for the new user.',
                        info: stderr,
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            childProcess.exec(`chown ${newUsername}:${newUsername} ${mediaNodeDataPath}`, (error, stdout, stderr) => {
                if (error || stderr) {
                    next({
                        error: userError.changeOwnershipFailed,
                        message: 'Error occurred while changing ownership of the data folder for the new user.',
                        info: error || stderr,
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            childProcess.exec(`chmod 700 ${mediaNodeDataPath}`, (error, stdout, stderr) => {
                if (error || stderr) {
                    next({
                        error: userError.changePermissionsFailed,
                        message: 'Error occurred while changing permissions of the data folder for the new user.',
                        info: error || stderr,
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            childProcess.exec(`cp -r ${baseUbuntuPath}/streamer ${newUserPath}`, (error, stdout, stderr) => {
                if (error || stderr) {
                    next({
                        error: userError.copyFilesFailed,
                        message: 'Error occurred while copying streamer folder.',
                        info: error || stderr,
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            newUser.username = newUsername;
            mediaSpaceHelper.createMediaSpace(newUser, newUsername, randomDigits, (error, result) => {
                if (error) {
                    next(error);
                } else {
                    next(null, result);
                }
            });
        }, (mediaSpaceId, next) => {
            liveStreamHelper.createLiveStream(newUser, mediaSpaceId, randomDigits, (error, broadcastStreamKey, liveFeedStreamKey) => {
                if (error) {
                    next(error);
                } else {
                    next(null, broadcastStreamKey, liveFeedStreamKey, mediaSpaceId);
                }
            });
        }, (broadcastStreamKey, liveFeedStreamKey, mediaSpaceId, next) => {
            configHelper.updateStreamKeys(config.streamer.stream_keys_path, newUsername, randomDigits, broadcastStreamKey, liveFeedStreamKey, (error) => {
                if (error) {
                    next(error);
                } else {
                    next(null, broadcastStreamKey, liveFeedStreamKey, mediaSpaceId);
                }
            });
        }, (broadcastStreamKey, liveFeedStreamKey, mediaSpaceId, next) => {
            updateStreamerFiles(baseUbuntuPath, newUserPath, newUsername, broadcastStreamKey, liveFeedStreamKey, (error) => {
                if (error) {
                    next(error);
                } else {
                    next(null, broadcastStreamKey, mediaSpaceId);
                }
            });
        }, (broadcastStreamKey, mediaSpaceId, next) => {
            childProcess.exec(`cp ${baseUbuntuPath}/media-node-data/logo.mp4 ${newUserPath}/media-node-data/logo.mp4`,
                (error, stdout, stderr) => {
                    if (error) {
                        next({
                            error: userError.copyFilesFailed,
                            message: 'Error occurred while copying logo.mp4 to the new user.',
                            info: error || stderr,
                        });
                    } else {
                        next(null, broadcastStreamKey, mediaSpaceId);
                    }
                });
        }, (broadcastStreamKey, mediaSpaceId, next) => {
            let configData = `[program:streamer-${newUsername}]\n`;
            configData += `command=${baseUbuntuPath}/venv/bin/python3 /home/${newUsername}/streamer/stream.py\n`;
            configData += 'autostart=false\n';
            configData += 'stopasgroup=true\n';
            configData += 'stopsignal=QUIT\n';
            configData += `stderr_logfile=/var/log/streamer-${newUsername}.err.log\n`;
            configData += `stdout_logfile=/var/log/streamer-${newUsername}.out.log\n`;
            fs.writeFile(`/etc/supervisor/conf.d/streamer-${newUsername}.conf`, configData, (error) => {
                if (error) {
                    next({
                        error: userError.createFileFailed,
                        message: 'Error occurred while creating the service configuration file.',
                        info: error,
                    });
                } else {
                    next(null, broadcastStreamKey, mediaSpaceId);
                }
            });
        }, (broadcastStreamKey, mediaSpaceId, next) => {
            childProcess.exec('supervisorctl update', (error, stdout, stderr) => {
                if (error || stderr) {
                    next({
                        error: userError.reloadSupervisorFailed,
                        message: 'Error occurred while reloading supervisor.',
                        info: error || stderr,
                    });
                } else {
                    next(null, broadcastStreamKey, mediaSpaceId);
                }
            });
        }, (broadcastStreamKey, mediaSpaceId, next) => {
            const totalCpus = os.cpus().length;
            let threads = Math.floor(totalCpus / 2);
            if (threads < 0) {
                threads = 1;
            }
            const nginxConfigData = {
                USER_ID: randomDigits,
                STREAM_USERNAME: newUsername,
                HLS_USERNAME: randomDigits,
                PUSH_DESTINATIONS: '',
                VIEW_KEY: broadcastStreamKey + '1',
                ADDITIONAL_DESTINATIONS: '',
                THREADS: threads,
            };
            let output = templateUtil.getRTMPTemplate();
            Object.keys(nginxConfigData).forEach(key => {
                output = output.replace(new RegExp(`{{${key}}}`, 'g'), nginxConfigData[key]);
            });
            fs.writeFile(`/usr/local/openresty/nginx/conf/rtmp/${randomDigits}.conf`, output, (error) => {
                if (error) {
                    next({
                        error: userError.createFileFailed,
                        message: 'Error occurred while creating the nginx configuration file.',
                        info: error,
                    });
                } else {
                    next(null, newUsername, newUserPath, mediaSpaceId);
                }
            });
        },
    ], completionCallback);
};

const getResourceUsage = (mediaSpace, cb) => {
    async.waterfall([
        (next) => {
            childProcess.exec(`du -sh /home/${mediaSpace.username} 2>/dev/null | awk '{print $1}'`, (error, stdout, stderr) => {
                if (error || stderr) {
                    next({
                        error: mediaSpaceError.getResourceUsageFailed,
                        message: 'Error occurred while getting the disk usage.',
                        info: error || stderr,
                    });
                } else {
                    const diskUsage = stdout ? stdout.trim() : 'null';
                    next(null, diskUsage);
                }
            });
        }, (diskUsage, next) => {
            childProcess.exec(`ps -u ${mediaSpace.username} -o rss= | awk '{sum+=$1} END {print sum/1024 " MB"}'`, (error, stdout, stderr) => {
                if (error || stderr) {
                    next({
                        error: mediaSpaceError.getResourceUsageFailed,
                        message: 'Error occurred while getting the memory usage.',
                        info: error || stderr,
                    });
                } else {
                    const memoryUsage = stdout ? stdout.trim() : 'null';
                    next(null, diskUsage, memoryUsage);
                }
            });
        }, (diskUsage, memoryUsage, next) => {
            childProcess.exec(`ps -u ${mediaSpace.username} -o pid,%cpu --sort=-%cpu | awk '{sum+=$2} END {print sum "%"}'`, (error, stdout, stderr) => {
                if (error || stderr) {
                    next({
                        error: mediaSpaceError.getResourceUsageFailed,
                        message: 'Error occurred while getting the CPU usage.',
                        info: error || stderr,
                    });
                } else {
                    const cpuUsage = stdout ? stdout.trim() : 'null';
                    next(null, diskUsage, memoryUsage, cpuUsage);
                }
            });
        },
    ], cb);
};

module.exports = {
    hashPassword,
    comparePassword,
    saveProfileImage,
    saveAdminProfileImage,
    createNewUserSetup,
    getResourceUsage,
};
