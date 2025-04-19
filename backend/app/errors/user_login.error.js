const MODULE = 'user_login';

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
};
