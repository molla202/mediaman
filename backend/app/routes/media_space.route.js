const controller = require('../controllers/media_space.controller');
const validation = require('../validations/media_space.validation');
const {
    isAuthenticated,
    isMediaNodeAdminUser,
    isValidStudioCall,
    isAdminUser,
} = require('../middlewares/auth.middleware');

module.exports = (app) => {
    app.get('/media-space', isAuthenticated, isMediaNodeAdminUser,
        validation.getMediaSpaces, controller.getMediaSpaces);
    app.post('/media-space', isValidStudioCall,
        validation.addMediaNodeUser, controller.addMediaNodeUser);
    app.put('/media-space', isAuthenticated, isAdminUser,
        validation.updateMediaSpace, controller.updateMediaSpace);
};
