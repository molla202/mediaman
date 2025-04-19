import json
import os
from pathlib import Path
import time

from ..utils.file import media_file
from ..client.file import update_asset, add_asset
from ..utils import ipfs
from ..config import ROOT_DIRECTORY, MAX_CPU_LIMIT_PERCENTAGE, MAX_RAM_LIMIT_PERCENTAGE
from ..helpers import ff_mpeg
from ..lib.ffmpeg import FFMPEG
from ..utils.file import gen_random_id, file_type as fileType, get_cpu_usage, get_ram_usage
from ..helpers.file import generate_multiple_thumbnails

def upload_complete_hook(file_path, user_id, root_path=None):
    info = media_file(file_path)
    print('info: ', info)
    if root_path:
        path = os.path.join(root_path, 'media-node-data')
    else:
        path = ROOT_DIRECTORY
    if info is not None:
        try:
            file_data = {
                'name': info['name'],
                'path': info['parent'].replace(path + '/sources/', ''),
                'size': info['size'],
                'MIMEType': info['mime'],
                'length': info['duration'],
            }
            file_hash = ipfs.add_file(file_path)
            if file_hash is not None:
                _ = ipfs.pin_file(file_hash)
                file_data['IPFSHash'] = file_hash
            print('file details: ', file_data)
            data = {
                'name': Path(file_data['name']).stem,
                'file': file_data
            }

            file_type = file_data['MIMEType'].lower().split('/')[0]
            if file_type in ['video', 'image', 'raster-image', 'raw-image']:
                thumb_dir = os.path.join(path, 'thumbnails')
                t_id = gen_random_id(10)
                thumb_dir = os.path.join(thumb_dir, t_id)
                if not os.path.exists(thumb_dir):
                    os.makedirs(thumb_dir)
                thumbnails = ff_mpeg.generate_thumbnails(t_id, file_path, thumb_dir)
                if 'image' in file_type and thumbnails is None:
                    thumbnails = {
                        'horizontal': file_path,
                    }
                if thumbnails is not None and len(thumbnails) > 0:
                    preview_hash = ipfs.add_file(thumbnails['horizontal'])
                    if preview_hash is not None:
                        file_data['previewIPFSHash'] = preview_hash
                        data['file'] = file_data
                    thumbnails_data = generate_multiple_thumbnails(t_id, thumbnails, root_path)
                    data['file']['thumbnail'] = thumbnails_data
            data['userId'] = user_id
            add_asset(data)

        except Exception as e:
            raise e

def asset_file_upload_complete_hook(file_path, asset_id, segment_duration=900, root_path=None):
    info = media_file(file_path)
    print('info: ', info)
    if root_path:
        root_path = os.path.join(root_path, 'media-node-data')
    else:
        root_path = ROOT_DIRECTORY
    if info is not None:
        try:
            file_data = {
                'name': info['name'],
                'path': info['parent'].replace(root_path + '/sources/', ''),
                'size': info['size'],
                'MIMEType': info['mime'],
                'length': info['duration'],
            }
            data = {
                'file': file_data,
                'encodeStatus': 'PROCESSING',
            }
            update_asset(asset_id, file_data)

            destination = os.path.join(root_path, 'assets', asset_id)
            type = fileType(file_path)
            video, encoded_file_path = None, None
            if type and type == 'video':
                video = FFMPEG({
                    '_id': asset_id,
                }, file_path, destination, {
                    'error': ff_mpeg.error_hook,
                    'in_progress': ff_mpeg.in_progress_hook,
                    'complete': ff_mpeg.complete_hook,
                }, chapter_duration=segment_duration)
            try:
                if get_cpu_usage() > MAX_CPU_LIMIT_PERCENTAGE or get_ram_usage() > MAX_RAM_LIMIT_PERCENTAGE:
                    print("[FFmpeg] - Warning - CPU/RAM usage is more than threshold limit. waiting (30sec)..")
                    time.sleep(30)
                    asset_file_upload_complete_hook(file_path, asset_id, segment_duration, root_path)
                elif video:
                    encoded_file_path = video.encode()
            except Exception as e:
                print('[FFmpeg] - unable to encode video')
                print('Error: ', str(e))

            # Adding file to ipfs

            ipfs_hash = ipfs.add_file(file_path)
            if ipfs_hash is not None:
                update_asset(asset_id, {'file': {'IPFSHash': ipfs_hash, 'previewIPFSHash': ipfs_hash, 'status': 'COMPLETE'}})
            else:
                update_asset(asset_id, {'file': {'status': 'IPFS_PIN_FAILED'}})

            # Adding encoded file to ipfs

            encoded_file_ipfs_hash = ipfs.add_file(encoded_file_path)
            if encoded_file_ipfs_hash is not None:
                update_asset(asset_id, {'file': {'encodedFileIPFSHash': encoded_file_ipfs_hash}})

            file_type = file_data['MIMEType'].lower().split('/')[0]
            if file_type in ['video', 'image']:
                thumb_dir = os.path.join(root_path, 'thumbnails')
                thumb_dir = os.path.join(thumb_dir, asset_id)
                if not os.path.exists(thumb_dir):
                    os.makedirs(thumb_dir)
                thumbnails = ff_mpeg.generate_thumbnails(asset_id, file_path, thumb_dir)
                if file_type == 'image' and thumbnails is None:
                    thumbnails = {
                        'horizontal': file_path,
                    }
                if thumbnails is not None and len(thumbnails) > 0:
                    data = {}
                    preview_hash = ipfs.add_file(thumbnails['horizontal'])
                    if preview_hash is not None:
                        data['file'] = {'previewIPFSHash': preview_hash}
                    thumbnails_data = generate_multiple_thumbnails(asset_id, thumbnails, root_path=root_path)
                    data['file']['thumbnail'] = thumbnails_data
                    update_asset(asset_id, data)

        except Exception as e:
            print(e)
            update_asset(asset_id, {'file': {'status': 'ERROR'}})
    else:
        file_data = {
            'status': 'ERROR',
        }
        update_asset(asset_id, {
            'file': file_data,
        })


def add_file_to_ipfs(asset_id, file_path):
    data = {}
    file_hash = ipfs.add_file(file_path)
    if file_hash is not None:
        _ = ipfs.pin_file(file_hash)
        file_data = {}
        file_data['IPFSHash'] = file_hash
        file_data['previewIPFShash'] = file_hash
        data['file'] = file_data
        success = update_asset(asset_id, data)
        return success
    return False

def file_encode_hook(file_path, asset_id, root_path):
    if root_path:
        destination = os.path.join(root_path, 'media-node-data', 'assets', asset_id)
    else:
        destination = os.path.join(ROOT_DIRECTORY, 'assets', asset_id)
    type = fileType(file_path)
    video = None
    if type and type == 'video':
        video = FFMPEG({
            '_id': asset_id,
        }, file_path, destination, {
            'error': ff_mpeg.error_hook,
            'in_progress': ff_mpeg.in_progress_hook,
            'complete': ff_mpeg.complete_hook,
        })
    try:
        if get_cpu_usage() > MAX_CPU_LIMIT_PERCENTAGE or get_ram_usage() > MAX_RAM_LIMIT_PERCENTAGE:
            print("[FFmpeg] - Warning - CPU/RAM usage is more than threshold limit. waiting (30sec)..")
            time.sleep(30)
            file_encode_hook(file_path, asset_id, root_path)
        elif video:
            encoded_file_path = video.encode()
            encoded_file_ipfs_hash = ipfs.add_file(encoded_file_path)
            if encoded_file_ipfs_hash is not None:
                update_asset(asset_id, {'file': {'encodedFileIPFSHash': encoded_file_ipfs_hash}})
    except Exception as e:
        print('[FFmpeg] - unable to encode video')
        print('Error: ', str(e))


def default_file_encode_hook(file_path, root_path):
    if root_path:
        destination = os.path.join(root_path, 'media-node-data')
    else:
        destination = os.path.join(ROOT_DIRECTORY)
    type = fileType(file_path)
    video = None
    if type and type == 'video':
        video = FFMPEG({}, file_path, destination, {})
    try:
        if get_cpu_usage() > MAX_CPU_LIMIT_PERCENTAGE or get_ram_usage() > MAX_RAM_LIMIT_PERCENTAGE:
            print("[FFmpeg] - Warning - CPU/RAM usage is more than threshold limit. waiting (30sec)..")
            time.sleep(30)
            default_file_encode_hook(file_path, root_path)
        elif video:
            m3u8_file = video.encode_default_stream()
            if m3u8_file is not None:
                config_file = os.path.join(root_path, 'streamer', 'config.json')
                with open(config_file, 'r') as f:
                    config = json.load(f)
                config['default_video_file'] = m3u8_file
                with open(config_file, 'w') as f:
                    json.dump(config, f, indent=4)
    except Exception as e:
        print('[FFmpeg] - unable to encode video')
        print('Error: ', str(e))