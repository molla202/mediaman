import os

import requests
import json

pushMyNextSlotURL = '{0}/live-stream/next-slot'
BACKEND_URL = os.getenv('BACKEND_URL')


def push_my_slot(backend_url):
    url = pushMyNextSlotURL.format(backend_url)
    try:
        resp = requests.put(url)
        print(resp)

    except Exception as e:
        print('Error', e)

if __name__ == '__main__':
    with open('/app/streamer/config.json', 'r') as conf:
        stream_config = json.loads(conf.read())

    backend_url = stream_config['backend_url']
    push_my_slot(backend_url)
    
