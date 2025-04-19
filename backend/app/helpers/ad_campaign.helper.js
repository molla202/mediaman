const async = require('async');
const adCampaignDBO = require('../dbos/ad_compaign.dbo');
const adCampaignError = require('../errors/ad_compaign.error');
const defaultAdCampaignDBO = require('../dbos/default_ad_campaign.dbo');

const deleteAdCampaignsOfMediaSpace = (mediaSpace, cb) => {
    async.waterfall([
        (next) => {
            adCampaignDBO.deleteMany({
                media_space: mediaSpace,
            }, {}, (error) => {
                if (error) {
                    next({
                        error: adCampaignError.deleteAdCampaignFailed,
                        message: 'Error occurred while deleting the ad campaign.',
                    });
                } else {
                    next(null);
                }
            });
        }, (next) => {
            defaultAdCampaignDBO.deleteMany({
                media_space: mediaSpace,
            }, {}, (error) => {
                if (error) {
                    next({
                        error: adCampaignError.deleteAdCampaignFailed,
                        message: 'Error occurred while deleting the default ad campaign.',
                    });
                } else {
                    next(null);
                }
            });
        },
    ], (error) => {
        cb(error);
    });
};

module.exports = {
    deleteAdCampaignsOfMediaSpace,
};
