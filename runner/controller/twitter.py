# coding: utf-8
import json
from falcon import HTTP_200, HTTP_500

from ..lib.twitter import api

class GetTweetInfoByID:
    def on_get(self, req, res, tweet_id):
        try:
            status = api.get_status(tweet_id, tweet_mode='extended')
            print(status)
            data = {
                'text': status.full_text,
                'entities': status.entities,
            }
            res.status = HTTP_200
            res.body = json.dumps({
                'success': True,
                'data': data,
            })
        except Exception as e:
            print(e)
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': 'Unable to fetch tweet',
                },
            })