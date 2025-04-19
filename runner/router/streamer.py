# coding: utf-8
from ..controller.streamer import StreamStart, StreamStop, StreamGenPlaylist, StreamLiveText, StreamStatus, \
    StreamConfiguration, StreamDetails


def router(app):
    app.add_route('/live-streams/users/{userid}/streams/{stream_id}/generate-playlist', StreamGenPlaylist())
    app.add_route('/live-streams/users/{userid}/streams/{stream_id}/start', StreamStart())
    app.add_route('/live-streams/users/{userid}/streams/{stream_id}/stop', StreamStop())
    app.add_route('/live-streams/users/{userid}/streams/{stream_id}/configuration', StreamConfiguration())
    app.add_route('/live-streams/users/{userid}/streams/{stream_id}/live-text', StreamLiveText())
    app.add_route('/live-streams/users/{userid}/streams/{stream_id}/status', StreamStatus())
    app.add_route('/live-streams/details', StreamDetails())
