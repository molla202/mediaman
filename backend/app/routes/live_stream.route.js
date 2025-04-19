const controller = require('../controllers/live_stream.controller');
const { isAuthenticated, hasStreamerPermission, isValidScriptCall, isValidStudioToken } = require('../middlewares/auth.middleware');
const isValidRunner = require('../middlewares/runner.middleware');
const validation = require('../validations/live_stream.validation');

module.exports = (app) => {
    app.get('/live-streams', isAuthenticated,
        validation.getLiveStreams, controller.getLiveStreams);
    app.put('/live-streams/:id', isAuthenticated, hasStreamerPermission,
        validation.updateLiveStream, controller.updateLiveStream);
    app.post('/live-streams', isAuthenticated, hasStreamerPermission,
        validation.addLiveStream, controller.addLiveStream);
    app.get('/live-streams/:id/config', isAuthenticated,
        validation.getLiveStreamConfig, controller.getLiveStreamConfig);
    app.post('/live-streams/:id/destinations', isAuthenticated, hasStreamerPermission,
        validation.addLiveStreamDestination, controller.addLiveStreamDestination);
    app.get('/live-streams/:id/destinations/:destinationId', isAuthenticated, hasStreamerPermission,
        validation.getLiveStreamDestination, controller.getLiveStreamDestination);
    app.put('/live-streams/:id/destinations/:destinationId', isAuthenticated, hasStreamerPermission,
        validation.updateLiveStreamDestination, controller.updateLiveStreamDestination);
    app.delete('/live-streams/:id/destinations/:destinationId', isAuthenticated, hasStreamerPermission,
        validation.deleteLiveStreamDestination, controller.deleteLiveStreamDestination);

    app.post('/live-streams/:id/start', isAuthenticated, hasStreamerPermission,
        validation.startLiveStream, controller.startLiveStream);
    app.post('/live-streams/:id/stop', isAuthenticated, hasStreamerPermission,
        validation.stopLiveStream, controller.stopLiveStream);

    app.put('/studio/live-streams/:id/destinations', isValidStudioToken,
        validation.updateDestinationsFromStudio, controller.updateDestinationsFromStudio);
    app.get('/studio/live-streams', isValidStudioToken,
        validation.getLiveStreams, controller.getLiveStreams);

    app.post('/live-streams/:id/live-text', isAuthenticated, hasStreamerPermission,
        validation.updateLiveStreamLiveText, controller.updateLiveStreamLiveText);
    app.get('/live-streams/:id/status', isAuthenticated,
        validation.getLiveStreamsStatus, controller.getLiveStreamStatus);
    app.get('/live-streams/:id/watch-url', isAuthenticated,
        validation.getLiveStreamWatchUrl, controller.getLiveStreamWatchUrl);

    app.get('/runner/live-streams', isValidRunner,
        validation.getRunnerLiveStreams, controller.getRunnerLiveStreams);
    app.put('/runner/live-streams/:id', isValidRunner,
        validation.updateRunnerLiveStream, controller.updateRunnerLiveStream);

    app.put('/live-streams/switch-to-live/:username', isValidScriptCall,
        validation.switchToLive, controller.switchToLive);
    app.put('/live-streams/switch-to-broadcast/:username', isValidScriptCall,
        validation.switchToBroadcast, controller.switchToBroadcast);
    app.put('/live-streams/stop-stream/:username', isValidScriptCall,
        validation.stopStream, controller.stopStream);
};
