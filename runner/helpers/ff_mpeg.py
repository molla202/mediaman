import os
import json
import subprocess
import random

from ..lib.ff_probe import info, get_resolution
from ..client import update_asset

def generate_thumbnails(asset_id, file_path, destination):
    try:
        if not os.path.exists(destination):
            os.makedirs(destination)
        thumbnail_file_h = os.path.join(destination, asset_id + '_horizontal.jpg')
        _, duration = info(file_path)
        width, height = get_resolution(file_path)
        if width is None and height is None:
            width, height = 1280,720
        start_sec = 0
        if int(duration) > 5:
            start_sec = 5
        end_sec = int(duration) % 100

        if end_sec <= start_sec:
            end_sec += start_sec + 1
        cmd_h = ['ffmpeg', '-y',
                 '-hide_banner', '-v', 'error',
                 '-i', file_path,
                 '-ss', str(random.choice(range(start_sec, end_sec))),
                 '-vframes', '1',
                 '-s', f'{width}x{height}',
                 thumbnail_file_h,
                 ]
        print(' '.join(cmd_h))
        subprocess.check_call(cmd_h)
        thumbnail_file_v = os.path.join(destination, asset_id + '_vertical.jpg')
        cmd_v = ['ffmpeg', '-y',
                 '-hide_banner', '-v', 'error',
                 '-i', file_path,
                 '-ss', str(random.choice(range(start_sec, end_sec))),
                 '-vframes', '1',
                 '-s', f'{height}x{width}',
                 thumbnail_file_v,
                 ]
        subprocess.check_call(cmd_v)
        thumbnail_file_s = os.path.join(destination, asset_id + '_square.jpg')
        cmd_s = ['ffmpeg', '-y',
                 '-hide_banner', '-v', 'error',
                 '-i', file_path,
                 '-ss', str(random.choice(range(start_sec, end_sec))),
                 '-vframes', '1',
                 '-s', f'{height}x{height}',
                 thumbnail_file_s,
                 ]
        subprocess.check_call(cmd_s)
        thumbnails = {
            'horizontal': thumbnail_file_h,
            'vertical': thumbnail_file_v,
            'square': thumbnail_file_s,
        }
        print('generated thumbnails : ', thumbnails)
        return thumbnails
    except Exception as e:
        print(e)
        return None

def in_progress_hook(key):
    update_asset(key['_id'], {
        'encodeStatus': 'IN_PROGRESS'
    })


def error_hook(key):
    update_asset(key['_id'], {
        'encodeStatus': 'ERROR'
    })


def complete_hook(key, segments, path):
    update_asset(key['_id'], {
        'encodeStatus': 'COMPLETE',
        "encodeSegments": segments,
        "encodePath": path
    })