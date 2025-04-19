const controller = require('../controllers/default_ad_campaign.controller');
const { isAuthenticated, hasStudioPermission } = require('../middlewares/auth.middleware');
const validation = require('../validations/default_ad_campaign.validation');

module.exports = (app) => {
    app.get('/live-streams/:liveStreamId/default-ad-campaigns', isAuthenticated, hasStudioPermission,
        validation.getDefaultAdCampaigns, controller.getDefaultAdCampaigns);
    app.post('/live-streams/:liveStreamId/default-ad-campaigns', isAuthenticated, hasStudioPermission,
        validation.addDefaultAdCampaign, controller.addDefaultAdCampaign);
    app.put('/live-streams/:liveStreamId/default-ad-campaigns/:id', isAuthenticated, hasStudioPermission,
        validation.updateDefaultAdCampaign, controller.updateDefaultAdCampaign);
    app.delete('/live-streams/:liveStreamId/default-ad-campaigns/:id', isAuthenticated, hasStudioPermission,
        validation.deleteDefaultAdCampaign, controller.deleteDefaultAdCampaign);
};
