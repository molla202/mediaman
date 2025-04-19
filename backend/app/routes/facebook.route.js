const controller = require('../controllers/facebook.controller');
const { isAuthenticated, isValidFacebookCallback } = require('../middlewares/auth.middleware');
const validation = require('../validations/facebook.validation');

module.exports = (app) => {
    // Facebook Auth
    app.get('/facebook/authenticate', isAuthenticated,
        validation.getAuthUrl, controller.getAuthUrl);
    app.get('/facebook/authenticate/callback', isValidFacebookCallback,
        validation.handleCallback, controller.handleCallback);

    // Facebook Live Streams
    app.put('/facebook/live-streams/:liveStreamId', isAuthenticated,
        validation.updateMediaNodeFacebookDestination, controller.updateMediaNodeFacebookDestination);

    // Facebook Schedule
    app.post('/facebook/schedules', isAuthenticated,
        validation.createFacebookSchedule, controller.createFacebookSchedule);

    app.put('/facebook/schedules/:scheduleId', isAuthenticated,
        validation.reScheduleFacebookSchedule, controller.reScheduleFacebookSchedule);

    app.get('/facebook/broadcasts', isAuthenticated,
        validation.getFacebookLiveStreamBroadcasts, controller.getFacebookLiveStreamBroadcasts);
};
