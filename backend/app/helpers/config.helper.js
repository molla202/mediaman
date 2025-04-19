const async = require('async');
const fs = require('fs');
const os = require('os');
const path = require('path');
const manageMsErrors = require('../errors/manage_ms.error');
const templateUtil = require('../utils/template.util');
const config = require('../../config');

const updateConfig = (filePath, data, cb) => {
    async.waterfall([
        (next) => {
            const backendConfPath = filePath;

            try {
                const config = fs.readFileSync(backendConfPath, 'utf8');
                const configLines = config.split('\n');
                const newConfigLines = configLines.map(line => {
                    if (line.match(/^\s+[A-Z_]+=/)) {
                        const [spaces, keyValue] = line.match(/^(\s+)(.*)$/).slice(1);
                        const [key] = keyValue.split('=');

                        if (data[key]) {
                            return `${spaces}${key}=${data[key]},`;
                        }
                    }
                    return line;
                });

                const newConfig = newConfigLines.join('\n');
                fs.writeFileSync(backendConfPath, newConfig);
                next(null);
            } catch (err) {
                next({
                    error: manageMsErrors.configUpdateFailed,
                    message: 'Error occurred while updating environment variables',
                    info: `${err.message}`,
                });
            }
        },
    ], (error, result) => {
        cb(error, result);
    });
};

const nginxConfig = (filePath, data, cb) => {
    async.waterfall([
        (next) => {
            let output = templateUtil.getNginxTemplate();
            Object.keys(data).forEach(key => {
                output = output.replace(new RegExp(`{{${key}}}`, 'g'), data[key]);
            });

            fs.writeFile(filePath, output, (err) => {
                if (err) {
                    next({
                        error: manageMsErrors.createNginxFileFailed,
                        message: 'Error occurred while creating NGINX config',
                        info: `${err.message}`,
                    });
                } else {
                    next(null, {
                        status: 200,
                        message: 'NGINX Conf. created successfully!',
                    });
                }
            });
        },
    ], (error, result) => {
        cb(error, result);
    });
};

const rtmpConfig = (filePath, data, broadcastEnabled, cb) => {
    async.waterfall([
        (next) => {
            let output = templateUtil.getRTMPTemplate();
            Object.keys(data).forEach(key => {
                output = output.replace(new RegExp(`{{${key}}}`, 'g'), data[key]);
            });

            if (!broadcastEnabled) {
                output = output.replace('switching2broadcast.sh', 'stream_stop.sh');
            }

            fs.writeFile(filePath, output, (err) => {
                if (err) {
                    next(err);
                } else {
                    next(null);
                }
            });
        },
    ], cb);
};

const getConfig = (filepath, cb) => {
    async.waterfall([
        (next) => {
            fs.readFile(filepath, 'utf8', (err, content) => {
                if (err) {
                    console.error(`Error reading env file: ${err}`);
                    next({
                        error: manageMsErrors.readConfigFailed,
                        message: 'Error occurred while reading environment variables',
                        info: `${err.message}`,
                    });
                } else {
                    next(null, content);
                }
            });
        }, (content, next) => {
            const lines = content.split('\n');
            const env = {};
            const envlines = [];
            let isProgramSection = false;
            for (const line of lines) {
                if (line.includes('environment=')) {
                    isProgramSection = true;
                    continue;
                }
                if (line.includes('stderr_logfile')) {
                    isProgramSection = false;
                    break;
                }
                if (isProgramSection) {
                    envlines.push(line);
                }
            }
            envlines.forEach(line => {
                const [key, value] = line.trim().split('=');
                if (key && value) {
                    env[key.trim()] = value.trim().replace(/^['"]|['"]$/g, '').replace(/,$/, '');
                }
            });
            next(null, env);
        },
    ], (error, result) => {
        cb(error, result);
    });
};

const updateStreamKeys = (path, username, mediaSpaceId, broadcastKey, liveFeedKey, cb) => {
    async.waterfall([
        (next) => {
            fs.readFile(path, 'utf8', (err, content) => {
                if (err) {
                    next({
                        error: manageMsErrors.readConfigFailed,
                        message: 'Error occurred while reading environment variables',
                        info: `${err.message}`,
                    });
                } else if (content) {
                    next(null, content);
                } else {
                    next({
                        error: manageMsErrors.readConfigFailed,
                        message: 'Error occurred while reading environment variables',
                        info: 'File is empty',
                    });
                }
            });
        }, (content, next) => {
            const data = JSON.parse(content);
            data[`${username}`] = {
                broadcastKey,
                liveFeedKey,
                mediaSpaceId,
            };

            fs.writeFile(path, JSON.stringify(data, null, 2), (err) => {
                if (err) {
                    next({
                        error: manageMsErrors.readConfigFailed,
                        message: 'Error occurred while reading environment variables',
                        info: `${err.message}`,
                    });
                } else {
                    next(null);
                }
            });
        },
    ], cb);
};

const configureRTMPandNGINXSettings = (streamConfigData) => {
    const rtmpPath = path.join(config.nginx.rtmp_files_path, `${streamConfigData.media_space.id}.conf`);
    const totalCpus = os.cpus().length;
    let threads = Math.floor(totalCpus / 2);
    if (threads < 0) {
        threads = 1;
    }
    const rtmpConfigDetails = {
        USER_ID: streamConfigData.media_space.id,
        PUSH_DESTINATIONS: '',
        HLS_USERNAME: streamConfigData.media_space.id,
        ADDITIONAL_DESTINATIONS: '',
        STREAM_USERNAME: streamConfigData.username,
        THREADS: threads,
    };
    if (streamConfigData.username === 'main') {
        rtmpConfigDetails.STREAM_USERNAME = 'ubuntu';
    }
    if (streamConfigData.extra_destinations && streamConfigData.extra_destinations.length > 0) {
        rtmpConfigDetails.ADDITIONAL_DESTINATIONS = streamConfigData.extra_destinations.map((destination) => `push ${destination};`).join('\n');
    }
    if (streamConfigData.configuration && streamConfigData.configuration.broadcast_config && streamConfigData.configuration.broadcast_config.stream_key) {
        rtmpConfigDetails.VIEW_KEY = streamConfigData.configuration.broadcast_config.stream_key + '1';
    }
    if (streamConfigData.configuration && streamConfigData.configuration.stream_destinations) {
        let servers = '';
        for (const destination of streamConfigData.configuration.stream_destinations) {
            if (destination.enabled) {
                if (destination.name && destination.name === 'facebook') {
                    servers += `push rtmp://localhost:1936/rtmp/${destination.key};\n`;
                } else if (destination.name && destination.name === 'x') {
                    servers += `push rtmp://localhost:1938/x/${destination.key};\n`;
                } else if (destination.name && destination.name === 'instagram') {
                    servers += `push rtmp://localhost:1937/rtmp/${destination.key};\n`;
                } else if (destination.name && destination.name === 'OmniFlixTV') {
                    continue;
                } else if (destination.url && destination.key) {
                    servers += `push ${destination.url}/${destination.key};\n`;
                }
            }
        }
        rtmpConfigDetails.PUSH_DESTINATIONS = servers;
    }

    const nginxConfigDetails = {
        TOKEN_SECRET: config.hls.token,
        ROOT_DIR: config.nginx.root_dir,
        RUNNER_HOST: config.runner.ip,
        RUNNER_PORT: config.runner.port,
        RUNNER_TOKEN: config.runner.tokenId,
        BACKEND_HOST: config.server.address,
        BACKEND_PORT: config.server.port,
        RTMP_PATH: config.nginx.rtmp_files_path,
        WS_PORT: config.ws.port,
    };

    return { rtmpPath, rtmpConfigDetails, nginxConfigDetails };
};

module.exports = {
    updateConfig,
    nginxConfig,
    getConfig,
    updateStreamKeys,
    rtmpConfig,
    configureRTMPandNGINXSettings,
};
