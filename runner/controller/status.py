# coding: utf-8
import json
from falcon import HTTP_200


class Status:
    def on_get(self, req, res):
        res.status = HTTP_200
        res.body = json.dumps({
            'success': True,
        })
