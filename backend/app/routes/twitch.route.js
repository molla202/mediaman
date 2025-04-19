const controller = require('../controllers/twitch.controller');
const { isAuthenticated, isValidTwitchCallback } = require('../middlewares/auth.middleware');
const validation = require('../validations/twitch.validation');

module.exports = (app) => {
    // Twitch Auth
    app.get('/twitch/authenticate', isAuthenticated,
        validation.getAuthUrl, controller.getAuthUrl);
    app.get('/twitch/authenticate/callback', isValidTwitchCallback,
        validation.handleCallback, controller.handleCallback);

    // Twitch Live Streams
    app.put('/twitch/media-node/live-streams/:liveStreamId', isAuthenticated,
        validation.updateMediaNodeTwitchDestination, controller.updateMediaNodeTwitchDestination);

    // Twitch Live Streams Broadcast
    app.put('/twitch/media-node/live-streams/:liveStreamId/broadcast', isAuthenticated,
        validation.broadcastTwitchLiveStream, controller.broadcastTwitchLiveStream);

    // Twitch Schedule Segment
    app.put('/twitch/media-node/schedule-segments/:segmentId', isAuthenticated,
        validation.updateTwitchScheduleSegment, controller.updateTwitchScheduleSegment);
    app.delete('/twitch/media-node/schedule-segments/:segmentId', isAuthenticated,
        validation.deleteTwitchScheduleSegment, controller.deleteTwitchScheduleSegment);

    app.get('/twitch/broadcasts', isAuthenticated,
        validation.getTwitchLiveStreamBroadcasts, controller.getTwitchLiveStreamBroadcasts);
};
