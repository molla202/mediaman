const controller = require('../controllers/studio.controller');
const validation = require('../validations/studio.validation');
const { isAuthenticated, hasStudioPermission } = require('../middlewares/auth.middleware');

module.exports = (app) => {
    app.get('/studio/channels', isAuthenticated, hasStudioPermission,
        validation.getStudioChannels, controller.getStudioChannels);
    app.put('/studio/live-streams/:id/channels', isAuthenticated, hasStudioPermission,
        validation.updateLiveStreamAccessToken, controller.updateLiveStreamAccessToken);
    app.delete('/studio/live-streams/:id/channels/:channelId', isAuthenticated, hasStudioPermission,
        validation.removeLiveStreamAccessToken, controller.removeLiveStreamAccessToken);
    app.get('/studio/socials/channels/:channelId', isAuthenticated, hasStudioPermission,
        validation.getStudioSocials, controller.getStudioSocials);
    app.put('/studio/live-streams/:id/channels/:channelId/enable', isAuthenticated, hasStudioPermission,
        validation.enableStudioChannel, controller.enableStudioChannel);
    app.put('/studio/live-streams/:id/channels/:channelId/disable', isAuthenticated, hasStudioPermission,
        validation.disableStudioChannel, controller.disableStudioChannel);
};
