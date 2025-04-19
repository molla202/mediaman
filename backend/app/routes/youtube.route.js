const controller = require('../controllers/youtube.controller');
const { isAuthenticated, isValidYoutubeCallback } = require('../middlewares/auth.middleware');
const validation = require('../validations/youtube.validation');

module.exports = (app) => {
    // Youtube Auth
    app.get('/youtube/authenticate', isAuthenticated,
        validation.getAuthUrl, controller.getAuthUrl);
    app.get('/youtube/authenticate/callback', isValidYoutubeCallback,
        validation.handleCallback, controller.handleCallback);

    // Youtube Live Streams
    app.get('/youtube/live-streams', isAuthenticated,
        validation.getLiveStreams, controller.getLiveStreams);
    app.post('/youtube/live-streams', isAuthenticated,
        validation.addLiveStream, controller.addLiveStream);
    app.put('/youtube/streams/:streamId/media-node/live-streams/:liveStreamId', isAuthenticated,
        validation.updateMediaNodeYoutubeDestination, controller.updateMediaNodeYoutubeDestination);

    // Youtube Live Broadcasts
    app.get('/youtube/live-broadcasts', isAuthenticated,
        validation.getLiveBroadcasts, controller.getLiveBroadcasts);
    app.post('/youtube/live-broadcasts', isAuthenticated,
        validation.addLiveBroadcast, controller.addLiveBroadcast);
    app.put('/youtube/live-broadcasts/:broadcastId', isAuthenticated,
        validation.updateLiveBroadcast, controller.updateLiveBroadcast);
    app.post('/youtube/live-broadcasts/:broadcastId/bind', isAuthenticated,
        validation.bindLiveBroadcast, controller.bindAndUnbindLiveBroadcast);
    app.post('/youtube/live-broadcasts/:broadcastId/unbind', isAuthenticated,
        validation.unbindLiveBroadcast, controller.bindAndUnbindLiveBroadcast);

    // Youtube asset upload
    app.post('/youtube/assets/:assetId/upload', isAuthenticated,
        validation.uploadAsset, controller.uploadAsset);
    app.put('/youtube/assets/:assetId/update', isAuthenticated,
        validation.updateYoutubeAsset, controller.updateYoutubeAsset);
    app.get('/youtube/assets/:id', isAuthenticated,
        validation.getYoutubeAsset, controller.getYoutubeAsset);
};
