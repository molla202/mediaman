const controller = require('../controllers/slot_template.controller');
const { isAuthenticated, hasStudioPermission } = require('../middlewares/auth.middleware');
const validation = require('../validations/slot_template.validation');

module.exports = (app) => {
    app.get('/slot-templates', isAuthenticated, hasStudioPermission,
        validation.getSlotTemplates, controller.getSlotTemplates);
    app.post('/slot-templates', isAuthenticated, hasStudioPermission,
        validation.addSlotTemplate, controller.addSlotTemplate);
    app.put('/slot-templates/:id', isAuthenticated, hasStudioPermission,
        validation.updateSlotTemplate, controller.updateSlotTemplate);
    app.delete('/slot-templates/:id', isAuthenticated, hasStudioPermission,
        validation.deleteSlotTemplate, controller.deleteSlotTemplate);
};
