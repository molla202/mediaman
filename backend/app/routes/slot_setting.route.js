const controller = require('../controllers/slot_setting.controller');
const { isAuthenticated, hasStudioPermission } = require('../middlewares/auth.middleware');
const validation = require('../validations/slot_setting.validation');

module.exports = (app) => {
    app.get('/live-streams/:liveStreamId/slots-setting', isAuthenticated, hasStudioPermission,
        validation.getSlotsSetting, controller.getSlotsSetting);
    app.get('/live-streams/:liveStreamId/slots/:id/settings', isAuthenticated, hasStudioPermission,
        validation.getSlotSetting, controller.getSlotSetting);
    app.post('/live-streams/:liveStreamId/slots/:id/settings', isAuthenticated, hasStudioPermission,
        validation.addSlotSetting, controller.addSlotSetting);
    app.put('/live-streams/:liveStreamId/slots/:slotId/settings/:id', isAuthenticated, hasStudioPermission,
        validation.updateSlotSetting, controller.updateSlotSetting);
    app.delete('/live-streams/:liveStreamId/slots/:slotId/settings/:id', isAuthenticated, hasStudioPermission,
        validation.deleteSlotSetting, controller.deleteSlotSetting);
};
