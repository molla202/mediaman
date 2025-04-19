# coding: utf-8
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import psutil
import fleep
import random
import re
import string
from ..lib import ff_probe


def media_files(directory, exclude, pattern='*'):
    _files = []
    paths = []
    for path in Path(directory).rglob(pattern):
        if path.is_file() and str(path).replace(directory + '/', '') not in exclude:
            paths.append(path)

    with ThreadPoolExecutor() as executor:
        results = executor.map(media_file, paths)
        for result in results:
            if result is not None:
                file = {
                    'name': result['name'],
                    'path': result['parent'].replace(directory + '/', ''),
                    'size': result['size'],
                    'MIMEType': result['mime'],
                    'length': result['duration'],
                }
                _files.append(file)

    return _files


def list_files(directory, pattern='*.mp4'):
    _files = []
    for path in Path(directory).rglob(pattern):
        info = media_file(path)
        if info:
            _files.append(info)
    return _files


def media_file(path):
    _path = Path(path)
    with open(str(_path), 'rb') as file:
        info = fleep.get(file.read(128))
    if len(info.mime) > 0:
        mime = info.mime[0]
    else:
        mime = 'media/unknown'
    meta = {
        'name': _path.name,
        'parent': str(_path.parent),
        'mime': mime
    }
    if meta['mime'] and 'application' in meta['mime']:
        name, extension = os.path.splitext(path)
        if extension is None:
            extenstion = ".unknown"
        meta['mime'] = 'document/{}'.format(extension[1:])

    if info.type_matches('video') or info.type_matches('audio') or info.type_matches('image') or info.type_matches(
            'raster-image') or info.type_matches('raw-image'):
        size, duration = ff_probe.info(str(_path))
        if not size:
            size = os.path.getsize(path)
            meta['size'] = size

        if not duration:
            meta['duration'] = 0
        else:
            meta['size'] = size
            meta['duration'] = duration
    else:
        duration = 0
        size = os.path.getsize(path)
        meta['size'] = size
        meta['duration'] = duration

    return meta


def get_disk_usage(disk_path):
    disk = psutil.disk_usage(disk_path)
    return disk.percent


def get_cpu_usage():
    return psutil.cpu_percent()


def get_ram_usage():
    return psutil.virtual_memory().percent


def is_valid_encode(input_file, output_file):
    input_size, input_duration = ff_probe.info(input_file)
    output_size, output_duration = ff_probe.info(output_file)
    return int(input_duration) <= int(output_duration)


def file_type(file_path):
    with open(file_path, 'rb') as file:
        file_info = fleep.get(file.read(128))
    type = file_info.type[0] if file_info.type else None
    return type


def is_valid_user_id(user_id):
    # Define the pattern for a valid MongoDB ID (ObjectID)
    pattern = re.compile(r'^[0-9a-fA-F]{24}$')

    if pattern.match(user_id):
        return True
    else:
        return False

def gen_random_id(n):
    return ''.join(random.choice(string.ascii_uppercase + string.ascii_lowercase + string.digits) for _ in range(n))