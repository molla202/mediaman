# coding: utf-8
from .file import router as file_router
from .stats import router as stats_router
from .status import router as status_router
from .twitter import router as twitter_router
from .streamer import router as streamer_router


def router(app):
    file_router(app)
    stats_router(app)
    status_router(app)
    streamer_router(app)
    twitter_router(app)
