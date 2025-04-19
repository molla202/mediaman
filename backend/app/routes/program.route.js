const controller = require('../controllers/program.controller');
const { isAuthenticated, hasStudioPermission } = require('../middlewares/auth.middleware');
const validation = require('../validations/program.validation');

module.exports = (app) => {
    app.get('/live-streams/:liveStreamId/slots/:id/programs', isAuthenticated, hasStudioPermission,
        validation.getPrograms, controller.getPrograms);
    app.post('/live-streams/:liveStreamId/slots/:id/programs', isAuthenticated, hasStudioPermission,
        validation.addProgram, controller.addProgram);
    app.put('/live-streams/:liveStreamId/slots/:id/programs', isAuthenticated, hasStudioPermission,
        validation.updatePrograms, controller.updatePrograms);
    app.put('/live-streams/:liveStreamId/slots/:id/fill-programs', isAuthenticated, hasStudioPermission,
        validation.fillPrograms, controller.fillPrograms);
    app.delete('/live-streams/:liveStreamId/slots/:id/clear-programs', isAuthenticated, hasStudioPermission,
        validation.clearPrograms, controller.clearPrograms);
    app.put('/live-streams/:liveStreamId/slots/:slotId/programs/:id', isAuthenticated, hasStudioPermission,
        validation.updateProgram, controller.updateProgram);
    app.delete('/live-streams/:liveStreamId/slots/:slotId/programs/:id', isAuthenticated, hasStudioPermission,
        validation.deleteProgram, controller.deleteProgram);

    app.post('/live-streams/:liveStreamId/slots/:slotId/programs/:id/overlays', isAuthenticated, hasStudioPermission,
        validation.addProgramOverlay, controller.addProgramOverlay);
    app.put('/live-streams/:liveStreamId/slots/:slotId/programs/:programId/overlays/:id', isAuthenticated, hasStudioPermission,
        validation.updateProgramOverlay, controller.updateProgramOverlay);
    app.delete('/live-streams/:liveStreamId/slots/:slotId/programs/:programId/overlays/:id', isAuthenticated, hasStudioPermission,
        validation.deleteProgramOverlay, controller.deleteProgramOverlay);

    app.get('/live-streams/:id/programs', isAuthenticated, hasStudioPermission,
        validation.getLiveStreamPrograms, controller.getLiveStreamPrograms);
};
