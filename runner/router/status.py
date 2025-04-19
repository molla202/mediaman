# coding: utf-8
from ..controller.status import Status


def router(app):
    app.add_route('/status', Status())