# coding: utf-8
import os
import time
from ..client.file import update_asset
from ..utils.file import media_file
from ..utils import ipfs
from ..config import ROOT_DIRECTORY, MAX_CPU_LIMIT_PERCENTAGE, MAX_RAM_LIMIT_PERCENTAGE
from ..helpers import ff_mpeg
from ..lib.youtube import YouTube
from ..utils.file import get_cpu_usage, get_ram_usage

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


def complete_hook(key, file_path, name):
    path = os.path.join(file_path, name)
    info = media_file(path)
    file_data = {
        'name': info['name'],
        'path': info['parent'].replace(ROOT_DIRECTORY + '/sources/', ''),
        'size': info['size'],
        'MIMEType': info['mime'],
        'duration': info['duration'],
        'status': 'COMPLETE',
    }
    update_asset(key['_id'], {
        'file': file_data
    })


def youtube_upload_hook(key, destination, video_id):
    print(key, destination, video_id)
    yt = YouTube(key, destination, video_id, {
        'error': error_hook,
        'in_progress': in_progress_hook,
        'complete': complete_hook
    })

    try:
        if get_cpu_usage() > MAX_CPU_LIMIT_PERCENTAGE or get_ram_usage() > MAX_RAM_LIMIT_PERCENTAGE:
            print("[YouTube] - Warning - CPU/RAM usage is more than threshold limit. waiting (30sec)..")
            time.sleep(30)
            youtube_upload_hook(key, destination, video_id)
        else:
            yt.download()
    except Exception as e:
        print('[YouTube] - unable to download video')
        print('Error: ', str(e))

