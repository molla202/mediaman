import requests
import os
from PIL import Image
from ..config import API_URL, TOKEN, ID, ROOT_DIRECTORY
from ..utils.file import gen_random_id


def add_asset(body):
    body['token'] = TOKEN
    url = '{0}/runner/assets'.format(API_URL)

    try:
        print('add asset: \n', body)
        resp = requests.post(url, json=body)
        print(resp.json())
        if not resp.status_code == 200:
            return False, resp.json()
        return True, resp.json()['result']
    except Exception as e:
        print(e)
        return False, None


def update_asset(_id, body):
    body['token'] = TOKEN
    url = '{0}/runner/assets/{1}'.format(API_URL, _id)

    try:
        print(url)
        print('updated asset: \n', body)
        resp = requests.put(url, json=body)
        print(resp.json())
        return True
    except Exception as e:
        print(e)
        return False

def get_root_path(_id):
    body = {
        'token': TOKEN,
    }
    try: 
        url = '{0}/runner/users/{1}/path'.format(API_URL, _id)
        resp = requests.get(url, json=body)
        return resp.json()['result']
    except Exception as e:
        print(e)
        return None
