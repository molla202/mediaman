const controller = require('../controllers/slot.controller');
const { isAuthenticated, hasStudioPermission } = require('../middlewares/auth.middleware');
const validation = require('../validations/slot.validation');

module.exports = (app) => {
    app.get('/live-streams/:id/slots', isAuthenticated, hasStudioPermission,
        validation.getSlots, controller.getSlots);
    app.post('/live-streams/:id/slots', isAuthenticated, hasStudioPermission,
        validation.addSlot, controller.addSlot);
    app.put('/live-streams/:liveStreamId/slots/:id', isAuthenticated, hasStudioPermission,
        validation.updateSlot, controller.updateSlot);
    app.delete('/live-streams/:liveStreamId/slots/:id', isAuthenticated, hasStudioPermission,
        validation.deleteSlot, controller.deleteSlot);
    app.put('/live-streams/:liveStreamId/slots/:id/push', isAuthenticated, hasStudioPermission,
        validation.pushSlot, controller.pushSlot);
    app.put('/live-streams/:id/next-slot', isAuthenticated, hasStudioPermission,
        validation.pushNextSlot, controller.pushNextSlot);

    app.get('/live-streams/:liveStreamId/slots/:id/overlays', isAuthenticated, hasStudioPermission,
        validation.getSlotOverlays, controller.getSlotOverlays);
    app.post('/live-streams/:liveStreamId/slots/:id/overlays', isAuthenticated, hasStudioPermission,
        validation.addSlotOverlay, controller.addSlotOverlay);
    app.put('/live-streams/:liveStreamId/slots/:slotId/overlays/:id', isAuthenticated, hasStudioPermission,
        validation.updateSlotOverlay, controller.updateSlotOverlay);
    app.delete('/live-streams/:liveStreamId/slots/:slotId/overlays/:id', isAuthenticated, hasStudioPermission,
        validation.deleteSlotOverlay, controller.deleteSlotOverlay);

    app.post('/live-streams/:liveStreamId/slots/:id/dynamic-overlays', isAuthenticated, hasStudioPermission,
        validation.addSlotDynamicOverlay, controller.addSlotDynamicOverlay);
};
