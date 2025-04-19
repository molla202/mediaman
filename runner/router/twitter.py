# coding: utf-8
from ..controller.twitter import GetTweetInfoByID


def router(app):
    app.add_route('/twitter/status/{tweet_id}', GetTweetInfoByID())