const MODULE = 'manage_ms';

module.exports = {
    configUpdateFailed: {
        module: MODULE,
        code: 1,
    },
    restartFailed: {
        module: MODULE,
        code: 2,
    },
    readConfigFailed: {
        module: MODULE,
        code: 3,
    },
    writeConfigFailed: {
        module: MODULE,
        code: 4,
    },
    createNginxFileFailed: {
        module: MODULE,
        code: 5,
    },
    reloadFailed: {
        module: MODULE,
        code: 6,
    },
};
