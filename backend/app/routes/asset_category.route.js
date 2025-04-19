const controller = require('../controllers/asset_category.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const validation = require('../validations/asset_category.validation');

module.exports = (app) => {
    app.get('/asset-categories', isAuthenticated,
        validation.getAssetCategories, controller.getAssetCategories);
    app.post('/asset-categories', isAuthenticated,
        validation.addAssetCategory, controller.addAssetCategory);
    app.put('/asset-categories/:id', isAuthenticated,
        validation.updateAssetCategory, controller.updateAssetCategory);
    app.delete('/asset-categories/:id', isAuthenticated,
        validation.deleteAssetCategory, controller.deleteAssetCategory);
};
