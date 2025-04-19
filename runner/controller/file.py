# coding: utf-8
import json
import os
import mimetypes
import shutil
import time
from rq import Queue
from redis import Redis
from werkzeug.utils import secure_filename
from pathlib import Path

from falcon import HTTP_200, HTTP_201, HTTP_400, HTTP_404, HTTP_500, HTTP_409, HTTPBadRequest, HTTPInternalServerError
from ..utils.file import media_files, get_disk_usage, file_type, gen_random_id, media_file
from ..utils import ipfs
from ..config import ROOT_DIRECTORY, DISK_PATH, MAX_STORAGE_LIMIT_PERCENTAGE, \
    ALLOWED_FILE_FORMATS, ALLOWED_FILE_EXTENSIONS, MAX_FILE_UPLOAD_SIZE, REDIS_HOST, REDIS_PORT, STREAM_CONFIG_FILE
from ..lib.twitter import Twitter
from ..client.file import update_asset, get_root_path, add_asset
from ..hooks import twitter, studio, youtube
from ..scripts import add_tweet_to_tweet_video_generation_queue

# Redis queue connection
q = Queue(connection=Redis(host=REDIS_HOST, port=REDIS_PORT))


class AssetFiles:
    def on_get(self, req, res, userid):
        root_path = get_root_path(userid)
        if root_path:
            path = os.path.join(root_path, 'media-node-data', 'sources')
        else:
            path = os.path.join(ROOT_DIRECTORY, 'sources')

        files_list = req.params.get('files').split(',') if 'files' in req.params else []
        files = media_files(path, files_list)

        res.status = HTTP_200
        res.body = json.dumps({
            'success': True,
            'result': files
        })


class AddAssetFile:

    def on_post(self, req, res, userid, asset_id):
        asset_category = req.media.get('assetCategory')
        source = req.media.get('source')
        source_id = req.media.get('sourceId')
        root_path = get_root_path(userid)
        if root_path:
            destination = os.path.join(root_path, 'media-node-data',
                                   'sources/{}/{}/{}'.format(source, asset_category, asset_id))
        else:
            destination = os.path.join(ROOT_DIRECTORY,
                                   'sources/{}/{}/{}'.format(source, asset_category, asset_id))
        disk_usage = get_disk_usage(DISK_PATH)
        print(disk_usage)
        if disk_usage and disk_usage > MAX_STORAGE_LIMIT_PERCENTAGE:
            res.status = HTTP_200
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': 'maximum storage limit is exceeded.'
                }
            })
        else:
            if source == 'twitter':
                print(destination)
                try:
                    tvg = Twitter(source_id, {
                        '_id': asset_id,
                    }, {
                        'error': twitter.error_hook,
                        'in_progress': twitter.in_progress_hook,
                        'complete': twitter.complete_hook
                    }, destination)

                    err, pos = add_tweet_to_tweet_video_generation_queue(tvg)
                    if err is not None:
                        res.status = HTTP_500
                        res.body = json.dumps({
                            'success': False,
                            'message': err
                        })
                    else:
                        res.status = HTTP_200
                        res.body = json.dumps({
                            'success': True,
                            'message': 'video added to tvg queue, now at position {}'.format(pos)
                        })

                except Exception as e:
                    print(e)
                    res.status = HTTP_500
                    res.body = json.dumps({
                        'success': False,
                        'message': 'Error while generating tweet video.'
                    })
            elif source == 'youtube':
                try:
                    q.enqueue(youtube.youtube_upload_hook, {'_id': asset_id}, destination, source_id, job_timeout=600)
                    res.status = HTTP_200
                    res.body = json.dumps({
                        'success': True,
                        'message': 'video added to download queue'
                    })
                except Exception as e:
                    print(e)
                    res.status = HTTP_500
                    res.body = json.dumps({
                        'success': False,
                        'message': 'Error while adding youtube video.'
                    })
            else:
                res.status = HTTP_200
                res.body = json.dumps({
                    'success': False,
                    'error': {
                        'message': 'invalid source type'
                    }
                })


class AssetFileDelete:

    def on_post(self, req, res, userid, asset_id):
        encoded_path = req.media.get('encodedPath')
        source_path = req.media.get('sourcePath')
        root_path = get_root_path(userid)
        try:
            print(encoded_path, source_path)
            if encoded_path:
                if root_path:
                    file = os.path.join(root_path, 'media-node-data', encoded_path)
                else:
                    file = os.path.join(ROOT_DIRECTORY, encoded_path)
                if os.path.exists(file):
                    os.remove(file)
            if source_path:
                if root_path:
                    file = os.path.join(root_path, 'media-node-data', 'sources/{0}'.format(source_path))
                else:
                    file = os.path.join(ROOT_DIRECTORY, 'sources/{0}'.format(source_path))
                if os.path.exists(file):
                    os.remove(file)
            res.status = HTTP_200
            res.body = json.dumps({
                'success': True
            })

        except Exception as e:
            print(e)
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': 'Error while deleting file'
                }
            })


class AssetFileDownload:
    cors_enabled = False

    def on_get(self, req, res, userid, asset_id):
        path = req.get_param('path')
        root_path = get_root_path(userid)

        if root_path:
            file_path = os.path.join(root_path, 'media-node-data', path)
        else:
            file_path = os.path.join(ROOT_DIRECTORY, path)
        if os.path.exists(path):
            file_path = path
        if not os.path.exists(file_path):
            res.status = HTTP_404
            res.body = json.dumps({
                'success': False,
                'message': 'File not found.'
            })
            return

        c_type = self.guess_type(file_path)
        try:
            f = open(file_path, 'rb')
            f.seek(0)
            res.status = HTTP_200
            res.set_header("Content-type", c_type)
            fs = os.fstat(f.fileno())
            res.set_header("Content-Length", str(fs[6]))
            res.stream = f

        except IOError:
            res.status = HTTP_404
            res.body = json.dumps({
                'success': False,
                'message': 'File not found.'
            })

    def guess_type(self, path):
        try:
            mimetypes.init()
            return mimetypes.guess_type(path)[0]
        except:
            return None


def is_allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_FILE_EXTENSIONS


class AssetFileUpload:
    cors_enabled = False

    def on_post(self, req, res, userid, asset_id):
        try:
            _type = req.get_param('_type')
            print('file type: ', _type)
            uploaded_file = req.get_param('file')

            root_path = get_root_path(userid)
            print('root path: ', root_path)

            if not _type or uploaded_file is None or not uploaded_file.file:
                raise HTTPBadRequest('\'_type\' and \'file\' are required parameters.')

            if not _type:
                raise HTTPBadRequest('\'_type\' is required parameter.')

            uploaded_file = req.get_param('file')
            if uploaded_file is None:
                raise HTTPBadRequest("Missing file", "Please upload a file.")

            # Check if the uploaded file exceeds the maximum size
            '''
            if uploaded_file.content_length > MAX_FILE_UPLOAD_SIZE:
                raise HTTPBadRequest("File too large", f"Maximum file size allowed is {MAX_FILE_UPLOAD_SIZE} bytes.")
            '''
            filename = secure_filename(uploaded_file.filename)

            if not is_allowed_file(filename):
                raise HTTPBadRequest('Invalid file type', f'Allowed file types are: {", ".join(ALLOWED_FILE_EXTENSIONS)}')

            if _type not in ALLOWED_FILE_FORMATS:
                print(_type, 'type is not allowed')
                raise HTTPBadRequest('unsupported type')

            disk_used = get_disk_usage(DISK_PATH)
            if disk_used and disk_used > MAX_STORAGE_LIMIT_PERCENTAGE:
                raise HTTPInternalServerError('no storage', 'maximum storage limit is exceeded.')

            if root_path:
                _storage_path = os.path.join(root_path, 'media-node-data', 'sources/studio/{}'.format(_type))
            else:
                _storage_path = os.path.join(ROOT_DIRECTORY, 'sources/studio/{}'.format(_type))
            if not os.path.exists(_storage_path):
                os.makedirs(_storage_path)

            file_path = os.path.join(_storage_path, filename)

            count = 1
            temp_filename = None
            while os.path.exists(file_path):
                temp_filename = '{}_{}.{}'.format(filename.rsplit('.')[0], count, filename.rsplit('.')[1])
                file_path = os.path.join(_storage_path, temp_filename)
                count += 1
            if temp_filename is not None:
                filename = temp_filename

            with open(file_path, 'wb') as f:
                while True:
                    chunk = uploaded_file.file.read(104857600)  # 10MB chunk size
                    if not chunk:
                        break
                    f.write(chunk)

            print('file upload completed ... ')
            print('file saved at', file_path)

            duration = 0
            if _type == 'video':
                info = media_file(file_path)
                print('info: ', info)
                if info is not None:
                    duration = info['duration']
            # updating asset
            update_asset(asset_id, {'file': {'name': filename, 'status': 'PROCESSING'}, 'downloadPath':  'studio/{}'.format(_type), 'duration': duration})
            ipfs_hash = ipfs.add_file(file_path)
            if ipfs_hash is not None:
                pinned = ipfs.pin_file(ipfs_hash)
                if not pinned:
                    update_asset(asset_id, {'file': {'status': 'IPFS_PIN_FAILED'}})
                update_asset(asset_id, {'file': {'IPFSHash': ipfs_hash, 'previewIPFSHash': ipfs_hash, 'status': 'COMPLETE'}})

            else:
                update_asset(asset_id, {'file': {'status': 'IPFS_PIN_FAILED'}})
            # TODO: recheck
            # Add file to processing queue
            q.enqueue(studio.asset_file_upload_complete_hook, file_path, asset_id, segment_duration=900, root_path=root_path, job_timeout=1200)

            res.status = HTTP_201
            res.body = json.dumps({
                'success': True,
                'message': 'Asset file uploaded successfully.'
            })
        except HTTPBadRequest as e:
            print(e)
            res.status = HTTP_400
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': str(e)
                }
            })

        except Exception as e:
            print(e)
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': 'internal server error'
                }
            })

class AssetFileEncode:
    def on_post(self, req, res, userid, asset_id):
        path = req.media.get('path')
        root_path = get_root_path(userid)

        if root_path:
            file_path = os.path.join(root_path, 'media-node-data', 'sources/{0}'.format(path))
        else:
            file_path = os.path.join(ROOT_DIRECTORY, 'sources/{0}'.format(path))
        if os.path.exists(path):
            file_path = path
        if not os.path.exists(file_path):
            res.status = HTTP_200
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': 'source path doesn\'t exist'
                }
            })
            return
        
        _type = file_type(file_path)
        disk_used = get_disk_usage(DISK_PATH)
        if disk_used and disk_used > MAX_STORAGE_LIMIT_PERCENTAGE:
            res.status = HTTP_200
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': 'Maximum storage limit is exceeded.'
                }
            })
        elif not _type or _type != 'video':
            res.status = HTTP_200
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': 'Invalid file format.'
                }
            })
        else:
            try:
                q.enqueue(studio.file_encode_hook, file_path, asset_id, root_path, job_timeout=600)
                res.status = HTTP_200
                res.body = json.dumps({
                    'success': True,
                    'message': 'Added to encoding queue',
                })      
            except Exception as e:
                print(e)
                res.status = HTTP_200
                res.body = json.dumps({
                    'success': False,
                    'error': {
                        'message': 'Error while adding file to the encode queue'
                    }
                })


class UploadAssetThumbnail:
    def on_post(self, req, res, userid):
        try:
            _type = req.get_param('type')
            input_file = req.get_param('file')
            root_path = get_root_path(userid)
            if root_path:
                _storage_path = os.path.join(root_path, 'media-node-data', 'thumbnails')
            else:
                _storage_path = os.path.join(ROOT_DIRECTORY, 'thumbnails')
            raw = input_file.file

            filename = '{}_{}.{}'.format(gen_random_id(16), _type, input_file.filename.split('.')[-1])
            file_path = os.path.join(_storage_path, filename)

            disk_used = get_disk_usage(DISK_PATH)
            if disk_used and disk_used > MAX_STORAGE_LIMIT_PERCENTAGE:
                res.status = HTTP_500
                res.body = json.dumps({
                    'success': False,
                    'error': {
                        'message': 'maximum storage limit is exceeded.'
                    }
                })
            else:
                count = 1
                if not os.path.exists(_storage_path):
                    os.makedirs(_storage_path)
                while os.path.exists(file_path):
                    filename = '{}_{}'.format(count, filename)
                    file_path = os.path.join(_storage_path, filename)
                    count += 1
                if not os.path.exists(file_path):
                    temp_file_path = file_path + '~'
                    with open(temp_file_path, 'wb') as output_file:
                        shutil.copyfileobj(raw, output_file)

                    os.rename(temp_file_path, file_path)
                    res.status = HTTP_201
                    res.body = json.dumps({
                        'success': True,
                        'message': 'thumbnail file uploaded successfully.',
                        'img_path': f'/asset-thumbnails/{filename}',
                    })
                else:
                    res.status = HTTP_409
                    res.body = json.dumps({
                        'success': False,
                        'error': {
                            'message': 'thumbnail file already exists.'
                        }
                    })
        except HTTPBadRequest as e:
            print(e)
            res.status = HTTP_400
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': str(e)
                }
            })


class FileUpload:
    cors_enabled = False

    def on_post(self, req, res, userid):
        try:
            print(time.time(), 'upload ...')
            _type = req.get_param('_type')
            print('file_type: ', _type)

            root_path = get_root_path(userid)
            print('root path: ', root_path)

            if not _type:
                raise HTTPBadRequest('\'_type\' is required parameter.')

            uploaded_file = req.get_param('file')
            if uploaded_file is None:
                raise HTTPBadRequest("Missing file", "Please upload a file.")

            # Check if the uploaded file exceeds the maximum size
            '''
            if uploaded_file.content_length > MAX_FILE_UPLOAD_SIZE:
                raise HTTPBadRequest("File too large", f"Maximum file size allowed is {MAX_FILE_UPLOAD_SIZE} bytes.")
            '''
            filename = secure_filename(uploaded_file.filename)

            if not is_allowed_file(filename):
                raise HTTPBadRequest('Invalid file type', f'Allowed file types are: {", ".join(ALLOWED_FILE_EXTENSIONS)}')

            if _type not in ALLOWED_FILE_FORMATS:
                print(_type, 'type is not allowed')
                raise HTTPBadRequest('unsupported type')

            disk_used = get_disk_usage(DISK_PATH)
            if disk_used and disk_used > MAX_STORAGE_LIMIT_PERCENTAGE:
                raise HTTPInternalServerError('no storage', 'maximum storage limit is exceeded.')

            if root_path:
                _storage_path = os.path.join(root_path, 'media-node-data', 'sources/studio/{}'.format(_type))
            else:
                _storage_path = os.path.join(ROOT_DIRECTORY, 'sources/studio/{}'.format(_type))
            if not os.path.exists(_storage_path):
                os.makedirs(_storage_path)

            file_path = os.path.join(_storage_path, filename)

            count = 1
            temp_filename = None
            while os.path.exists(file_path):
                temp_filename = '{}_{}.{}'.format(filename.rsplit('.')[0], count, filename.rsplit('.')[1])
                file_path = os.path.join(_storage_path, temp_filename)
                count += 1

            if temp_filename is not None:
                filename = temp_filename
            file_data = {
                'name': filename,
                'path': 'studio/{}'.format(_type),
                'source': 'studio',
                'MIMEType': _type,
            }
            data = {
                'name': filename,
                'file': file_data,
                'userId': userid,
            }

            success, result = add_asset(data)
            if not success:
                raise HTTPBadRequest('Error while adding asset', 'Error while adding asset')

            with open(file_path, 'wb') as f:
                while True:
                    chunk = uploaded_file.file.read(104857600)  # 10MB chunk size
                    if not chunk:
                        break
                    f.write(chunk)

            print('file upload completed ... ')
            print('file saved at', file_path)
            update_asset(result['_id'], {'file': {'status': 'COMPLETE'}})

            # Add file processing to queue
            # TODO: recheck
            q.enqueue(studio.asset_file_upload_complete_hook, file_path, result['_id'], segment_duration=900, root_path=root_path, job_timeout=1200)
            res.status = HTTP_201
            res.body = json.dumps({
                'success': True,
                'message': 'file uploaded successfully.'
            })

        except HTTPBadRequest as e:
            print(e)
            res.status = HTTP_400
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': str(e)
                }
            })
        except Exception as e:
            print(e)
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': 'internal server error'
                }
            })


class AddAssetFileToIpfs:

    def on_post(self, req, res, userid, asset_id):
        file_path = req.media.get('filePath')
        root_path = get_root_path(userid)
        try:
            if file_path:
                if root_path:
                    file = os.path.join(root_path, 'media-node-data', 'sources/{0}'.format(file_path))
                else:
                    file = os.path.join(ROOT_DIRECTORY, 'sources/{0}'.format(file_path))
                if os.path.exists(file):
                    success = studio.add_file_to_ipfs(asset_id, file)
                    if success:
                        res.status = HTTP_200
                        res.body = json.dumps({
                            'success': True
                        })
                    else:
                        res.status = HTTP_500
                        res.body = json.dumps({
                            'success': False,
                            'error': {
                                'message': 'Error while adding file to ipfs'
                            }
                        })

                else:
                    res.status = HTTP_500
                    res.body = json.dumps({
                        'success': False,
                        'error': {
                            'message': 'Error while adding file to ipfs'
                        }
                    })
            else:
                res.status = HTTP_500
                res.body = json.dumps({
                    'success': False,
                    'error': {
                        'message': 'Error while adding file to ipfs'
                    }
                })

        except Exception as e:
            print(e)
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': 'Error while adding file to ipfs'
                }
            })


class AllowedFileTypes:

    def on_get(self, req, res):
        res.status = HTTP_200
        res.body = json.dumps({
            'success': True,
            'allowed_file_formats': ALLOWED_FILE_FORMATS,
            'allowed_file_extensions': ALLOWED_FILE_EXTENSIONS,
        }) 


class AddDefaultStream:
    def on_post(self, req, res, userid):
        try:
            print(time.time(), 'upload ...')
            _type = req.get_param('_type')
            print('file_type: ', _type)

            root_path = get_root_path(userid)
            print('root path: ', root_path)

            if not _type:
                raise HTTPBadRequest('\'_type\' is required parameter.')

            uploaded_file = req.get_param('file')
            if uploaded_file is None:
                raise HTTPBadRequest("Missing file", "Please upload a file.")

            # Check if the uploaded file exceeds the maximum size
            '''
            if uploaded_file.content_length > MAX_FILE_UPLOAD_SIZE:
                raise HTTPBadRequest("File too large", f"Maximum file size allowed is {MAX_FILE_UPLOAD_SIZE} bytes.")
            '''
            filename = secure_filename(uploaded_file.filename)

            if not is_allowed_file(filename):
                raise HTTPBadRequest('Invalid file type', f'Allowed file types are: {", ".join(ALLOWED_FILE_EXTENSIONS)}')

            if _type != 'video':
                print(_type, 'type is not allowed for default stream')
                raise HTTPBadRequest('unsupported type')

            disk_used = get_disk_usage(DISK_PATH)
            if disk_used and disk_used > MAX_STORAGE_LIMIT_PERCENTAGE:
                raise HTTPInternalServerError('no storage', 'maximum storage limit is exceeded.')

            if root_path:
                _storage_path = os.path.join(root_path, 'media-node-data')
            else:
                _storage_path = os.path.join(ROOT_DIRECTORY)
            if not os.path.exists(_storage_path):
                os.makedirs(_storage_path)

            file_path = os.path.join(_storage_path, filename)

            count = 1
            while os.path.exists(file_path):
                temp_filename = '{}_{}.{}'.format(filename.rsplit('.', 1)[0], count, filename.rsplit('.', 1)[1])
                file_path = os.path.join(_storage_path, temp_filename)
                count += 1

            with open(file_path, 'wb') as f:
                while True:
                    chunk = uploaded_file.file.read(104857600)  # 10MB chunk size
                    if not chunk:
                        break
                    f.write(chunk)

            print('file upload completed ... ')
            print('file saved at', file_path)

            # Adding file to config
            if root_path:
                config_file = os.path.join(root_path, 'streamer', 'config.json')
            else:
                config_file = os.path.join(STREAM_CONFIG_FILE)
            print('config_file: ', config_file)
            if os.path.exists(config_file):
                q.enqueue(studio.default_file_encode_hook, file_path, root_path)
            else:
                raise HTTPBadRequest('config file not found', 'config file not found')
            
            res.status = HTTP_201
            res.body = json.dumps({
                'success': True,
                'message': 'file uploaded successfully.'
            })

        except HTTPBadRequest as e:
            print(e)
            res.status = HTTP_400
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': str(e)
                }
            })
        except Exception as e:
            print(e)
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False,
                'error': {
                    'message': 'internal server error'
                }
            })

class GetDefaultStream:
    def on_get(self, req, res, userid):
        root_path = get_root_path(userid)
        config_file = os.path.join(root_path, 'streamer', 'config.json')
        with open(config_file, 'r') as f:
            config = json.load(f)
        file_path = config['default_video_file']

        c_type = self.guess_type(file_path)
        try:
            f = open(file_path, 'rb')
            f.seek(0)
            res.status = HTTP_200
            res.set_header("Content-type", c_type)
            fs = os.fstat(f.fileno())
            res.set_header("Content-Length", str(fs[6]))
            res.stream = f

        except IOError:
            res.status = HTTP_404
            res.body = json.dumps({
                'success': False,
                'message': 'File not found.'
            })

    def guess_type(self, path):
        try:
            mimetypes.init()
            return mimetypes.guess_type(path)[0]
        except:
            return None
