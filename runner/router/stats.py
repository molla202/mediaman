# coding: utf-8
from ..controller.stats import SystemStats


def router(app):
    app.add_route('/system-stats', SystemStats())
