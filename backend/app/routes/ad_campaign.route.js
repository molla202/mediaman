const controller = require('../controllers/ad_compaign.controller');
const { isAuthenticated, hasStudioPermission } = require('../middlewares/auth.middleware');
const validation = require('../validations/ad_campaign.validation');

module.exports = (app) => {
    app.get('/live-streams/:liveStreamId/slots/:slotId/ad-campaigns', isAuthenticated, hasStudioPermission,
        validation.getAdCampaigns, controller.getAdCampaigns);
    app.post('/live-streams/:liveStreamId/slots/:slotId/ad-campaigns', isAuthenticated, hasStudioPermission,
        validation.addAdCampaign, controller.addAdCampaign);
    app.put('/live-streams/:liveStreamId/slots/:slotId/ad-campaigns/:id', isAuthenticated, hasStudioPermission,
        validation.updateAdCampaign, controller.updateAdCampaign);
    app.delete('/live-streams/:liveStreamId/slots/:slotId/ad-campaigns/:id', isAuthenticated, hasStudioPermission,
        validation.deleteAdCampaign, controller.deleteAdCampaign);
};
