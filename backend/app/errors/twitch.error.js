const MODULE = 'twitch';

module.exports = {
    findUserLoginFailed: {
        module: MODULE,
        code: 1,
    },
    userLoginDoesNotExist: {
        module: MODULE,
        code: 2,
    },
    updateUserLoginFailed: {
        module: MODULE,
        code: 3,
    },
    saveUserLoginFailed: {
        module: MODULE,
        code: 4,
    },
    userLoginAlreadyExist: {
        module: MODULE,
        code: 5,
    },
    loginRequestExpired: {
        module: MODULE,
        code: 6,
    },
    getAuthUrlFailed: {
        module: MODULE,
        code: 7,
    },
    getLiveStreamFailed: {
        module: MODULE,
        code: 8,
    },
    getLiveStreamsDoesNotExist: {
        module: MODULE,
        code: 9,
    },
    setCredentialsFailed: {
        module: MODULE,
        code: 10,
    },
    getTokenFailed: {
        module: MODULE,
        code: 11,
    },
    updateTwitchScheduleFailed: {
        module: MODULE,
        code: 12,
    },
    findTwitchScheduleSegmentFailed: {
        module: MODULE,
        code: 13,
    },
    scheduleSegmentDoesNotExist: {
        module: MODULE,
        code: 14,
    },
    scheduleSegmentIsCancelled: {
        module: MODULE,
        code: 15,
    },
    scheduleSegmentIsPast: {
        module: MODULE,
        code: 16,
    },
    scheduleSegmentIsRecurring: {
        module: MODULE,
        code: 17,
    },
    saveTwitchScheduleFailed: {
        module: MODULE,
        code: 18,
    },
};
