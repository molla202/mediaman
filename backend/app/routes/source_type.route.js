const controller = require('../controllers/source_type.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const validation = require('../validations/source_type.validation');

module.exports = (app) => {
    app.get('/source-types', isAuthenticated,
        validation.getSourceTypes, controller.getSourceTypes);
    // app.post('/source-types', isAuthenticated,
    //     validation.addSourceType, controller.addSourceType);
    // app.put('/source-types/:id', isAuthenticated,
    //     validation.updateSourceType, controller.updateSourceType);
    // app.delete('/source-types/:id', isAuthenticated,
    //     validation.deleteSourceType, controller.deleteSourceType);
};
