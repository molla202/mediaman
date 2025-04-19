const controller = require('../controllers/slot_config.controller');
const { isAuthenticated, hasStudioPermission } = require('../middlewares/auth.middleware');
const validation = require('../validations/slot_config.validation');

module.exports = (app) => {
    app.get('/live-streams/:liveStreamId/slots-configuration', isAuthenticated, hasStudioPermission,
        validation.getSlotsConfig, controller.getSlotsConfig);
    app.post('/live-streams/:liveStreamId/slots-configuration', isAuthenticated, hasStudioPermission,
        validation.addSlotConfig, controller.addSlotConfig);
    app.put('/live-streams/:liveStreamId/slots-configuration/:id', isAuthenticated, hasStudioPermission,
        validation.updateSlotConfig, controller.updateSlotConfig);
    app.delete('/live-streams/:liveStreamId/slots-configuration/:id', isAuthenticated, hasStudioPermission,
        validation.deleteSlotConfig, controller.deleteSlotConfig);
};
