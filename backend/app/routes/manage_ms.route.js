const controller = require('../controllers/manage_ms.controller');
const validation = require('../validations/manage_ms.validation');
const {
    isAuthenticated,
    hasStudioPermission,
    hasStreamerPermission,
    isAdminUser,
} = require('../middlewares/auth.middleware');

module.exports = (app) => {
    app.post('/media-node/restart/studio', isAuthenticated, hasStudioPermission,
        validation.restartStudio, controller.restartStudio);
    app.post('/media-node/restart/nginx', isAuthenticated, hasStreamerPermission,
        validation.restartNginx, controller.restartNginx);
    app.get('/media-node/studio/config', isAuthenticated, hasStudioPermission,
        validation.getStudioConfig, controller.getStudioConfig);
    app.get('/status', controller.getStatus);
    app.get('/media-space/slots', isAuthenticated, isAdminUser,
        validation.getMediaSpaceSlots, controller.getMediaSpaceSlots);
    app.get('/hardware-specs',
        validation.getHardwareSpecs, controller.getHardwareSpecs);
    app.get('/hardware-stats',
        validation.getHardwareStats, controller.getHardwareStats);
    app.get('/check-config', isAuthenticated,
        validation.checkConfig, controller.checkConfig);
    app.get('/geolocation',
        validation.getGeolocation, controller.getGeolocation);
};
