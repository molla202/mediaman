# coding: utf-8
import os
from ..client.file import update_asset
from ..utils.file import media_file
from ..utils import ipfs
from ..config import ROOT_DIRECTORY
from ..helpers import ff_mpeg


def error_hook(key):
    update_asset(key['_id'], {
        'file':{
            'status': 'ERROR'
        },
    })


def in_progress_hook(key):
    update_asset(key['_id'], {
        'file':{
            'status': 'PROCESSING'
        },
    })


def complete_hook(key, file_path):
    info = media_file(file_path)
    file_data = {
        'name': info['name'],
        'path': info['parent'].replace(ROOT_DIRECTORY + '/sources/', ''),
        'size': info['size'],
        'MIMEType': info['mime'],
        'duration': info['duration'],
        'status': 'COMPLETE',
    }
    hash = ipfs.add_file(file_path)
    if hash is not None:
        _ = ipfs.pin_file(hash)
        file_data['IPFSHash'] = hash

    thumb_dir = os.path.join(ROOT_DIRECTORY, 'thumbnails')
    thumb_dir = os.path.join(thumb_dir, key['_id'])
    if not os.path.exists:
        os.makedirs(thumb_dir)
    thumbnails = ff_mpeg.generate_thumbnails(key['_id'], file_path, thumb_dir)
    print(thumbnails)
    preview_hash = ipfs.add_file(thumbnails['horizontal'])
    if preview_hash is not None:
        file_data['previewIPFSHash'] = preview_hash
    update_asset(key['_id'], {
        'file': file_data
    })
