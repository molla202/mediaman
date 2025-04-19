const MODULE = 'auth';

module.exports = {
    jwtTokenRequired: {
        module: MODULE,
        code: 1,
    },
    jwtVerificationFailed: {
        module: MODULE,
        code: 2,
    },
    findUserFailed: {
        module: MODULE,
        code: 3,
    },
    userDoesNotExist: {
        module: MODULE,
        code: 4,
    },
    updateUserFailed: {
        module: MODULE,
        code: 5,
    },
    comparePasswordsFailed: {
        module: MODULE,
        code: 6,
    },
    passwordsDoesNotMatch: {
        module: MODULE,
        code: 7,
    },
    invalidStudioToken: {
        module: MODULE,
        code: 8,
    },
};
