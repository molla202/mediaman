const controller = require('../controllers/user.controller');
const { isAuthenticated, hasStudioPermission, isAdminUser, isMediaNodeAdminUser, isValidToken } = require('../middlewares/auth.middleware');
const validation = require('../validations/user.validation');

module.exports = (app) => {
    app.post('/user/connect-bc-account',
        validation.connectBCAccount, controller.connectBCAccount);
    app.post('/user/:userId/verify-bc-account',
        validation.verifyBCAccount, controller.verifyBCAccount);
    app.post('/user/auth/refresh-token',
        validation.refreshUserAccessToken, controller.refreshUserAccessToken);

    app.get('/user/profile/details', isAuthenticated, hasStudioPermission,
        validation.getUserProfileDetails, controller.getUserProfileDetails);
    app.get('/user/fee-grant', isAuthenticated,
        validation.allowFeeGrant, controller.allowFeeGrant);
    app.put('/user/profile/details', isAuthenticated,
        validation.updateUserProfileDetails, controller.updateUserProfileDetails);

    app.post('/user/media-space', isAuthenticated, isMediaNodeAdminUser,
        validation.addMediaNodeUser, controller.addMediaNodeUser);
    app.get('/user/media-space', isAuthenticated, controller.getMediaSpaces);
    app.get('/users', isAuthenticated, isAdminUser, controller.getUsers);
    app.get('/user/resource-usage', isAuthenticated, hasStudioPermission,
        controller.getResourceUsageOfUser);

    app.post('/user', isAuthenticated, validation.addUser, controller.addUser);
    app.put('/user/:id', isAuthenticated, validation.updateUser, controller.updateUser);
    app.get('/verifyjwt', isAuthenticated, controller.verifyJWT);
    app.get('/verify-token', isValidToken);

    app.get('/runner/users/:userId/path', controller.getUserRootPath);
    app.get('/runner/users/:username/get-id', controller.getUserId);
};
