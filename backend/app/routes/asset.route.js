const controller = require('../controllers/asset.controller');
const { isAuthenticated, hasStudioPermission, isValidScriptCall } = require('../middlewares/auth.middleware');
const isValidRunner = require('../middlewares/runner.middleware');
const validation = require('../validations/asset.validation');

module.exports = (app) => {
    app.get('/assets/tags', isAuthenticated, hasStudioPermission,
        validation.getAssetTags, controller.getAssetTags);
    app.get('/assets', isAuthenticated, hasStudioPermission,
        validation.getAssets, controller.getAssets);
    app.get('/assets/:id', isAuthenticated, hasStudioPermission,
        validation.getAsset, controller.getAsset);
    app.post('/assets', isAuthenticated, hasStudioPermission,
        validation.addAsset, controller.addAsset);
    app.put('/assets/:id', isAuthenticated, hasStudioPermission,
        validation.updateAsset, controller.updateAsset);

    app.delete('/assets/:id', isAuthenticated, hasStudioPermission,
        validation.deleteAsset, controller.deleteAsset);

    app.put('/assets/:id/encode', isAuthenticated, hasStudioPermission,
        validation.encodeAsset, controller.encodeAsset);
    app.get('/assets-overview', isAuthenticated, hasStudioPermission,
        validation.getAssetsOverview, controller.getAssetsOverview);

    app.get('/assets/:id/watch-url', isAuthenticated, hasStudioPermission,
        validation.getAssetWatchUrl, controller.getAssetWatchURL);

    // runner routes
    app.post('/runner/assets', isValidRunner,
        validation.addRunnerAssets, controller.addRunnerAssets);
    app.put('/runner/assets/:id', isValidRunner,
        validation.updateRunnerAsset, controller.updateRunnerAsset);

    app.post('/script/assets', isValidScriptCall,
        validation.addScriptAsset, controller.addScriptAsset);
    app.put('/script/assets/:id', isValidScriptCall,
        validation.updateScriptAsset, controller.updateScriptAsset);
};
