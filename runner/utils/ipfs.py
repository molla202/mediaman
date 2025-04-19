# coding: utf-8

import ipfsapi
import requests
import os
from ..config import IPFS_API_HOST, IPFS_API_PORT

api = ipfsapi.Client(IPFS_API_HOST, IPFS_API_PORT)

def add_file(file_path):
    try:
        dir = '/'.join(file_path.split('/')[:-1])
        filename = file_path.replace(dir+'/', '')
        cur_dir = os.getcwd()
        os.chdir(dir)
        resp = api.add(filename, pin=True)
        os.chdir(cur_dir)
        if isinstance(resp, list):
            last_item = resp[-1]
            print('ipfs hash for file: ', file_path, last_item['Hash'])
            return last_item['Hash']
        elif isinstance(resp, dict):
            print('ipfs hash for file: ', file_path, resp['Hash'])
            return resp['Hash']
        else:
            return None

    except Exception as e:
        print(e)
        return None


def pin_file(hash):
    try:
        params = (
            ('arg', hash),
        )
        url = 'http://{}:{}/api/v0/pin/add'.format(IPFS_API_HOST, IPFS_API_PORT)
        print('Pinning on IPFS ...')
        print(url, params)
        response = requests.post(url, params=params)
        response = response.json()
        if 'Pins' in dict(response).keys() and len(response['Pins']) > 0:
            return True
        else:
            return False

    except Exception as e:
        print(e)
        return False