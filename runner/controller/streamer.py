# coding: utf-8
import json
import os
import time
import shlex
import subprocess
from datetime import datetime
import requests
import dateparser
from dateutil import tz
from urllib import parse
import xml.etree.ElementTree as ET
from falcon import HTTP_200, HTTP_500, HTTPBadRequest, HTTP_400


from ..config import STREAM_ROOT_DIRECTORY, TIME_ZONE, STREAM_CONFIG_FILE, LIVE_TEXT_FILE
from ..utils.streamer import is_slot_in_playlist
from ..client.file import get_root_path

class StreamGenPlaylist:
    def on_post(self, req, res, userid, stream_id):
        """
        @api {POST} /runner/live-streams/{stream_id}/push 1.Save Playlist
        @apiDescription saves a playlist for given date.
        @apiName StreamPush
        @apiGroup PlayList
        @apiParam {String} stream_id Stream ID.
        @apiParam {String} date Date in string format YYYY-MM-DD.
        @apiParam {Array} slots Slots array
        @apiSuccess {Boolean} success Success key.
        """
        date = req.media.get('date')
        slot = req.media.get('slot')

        date = dateparser.parse(date)
        date = date.replace(tzinfo=tz.tzutc()).astimezone(tz.gettz(TIME_ZONE))

        root_path = get_root_path(userid)
        if root_path:
            playlist_dir = os.path.join(root_path, 'media-node-data', '{0}/playlists/{1}'.format(stream_id, date.strftime('%Y-%m-%d')))
        else:
            playlist_dir = os.path.join(STREAM_ROOT_DIRECTORY, '{0}/playlists/{1}'.format(stream_id, date.strftime('%Y-%m-%d')))
        if not os.path.exists(playlist_dir):
            os.makedirs(playlist_dir)

        playlist_file = os.path.join(playlist_dir, 'playlist.json')
        slots = []
        playlist = None

        if os.path.exists(playlist_file):
            with open(playlist_file, 'r') as plist:
                playlist = json.loads(plist.read())
        if playlist:
            slots = playlist['slots']
        index = is_slot_in_playlist(slot, slots)
        if index > -1:
            slots[index] = slot
        else:
            slots.append(slot)

        file = {
            'date': date.strftime('%Y-%m-%d'),
            'slots': slots
        }

        with open(playlist_file, 'w') as playlist_json:
            json.dump(file, playlist_json, indent=2)
        res.status = HTTP_200
        res.body = json.dumps({
            'success': True
        })


class StreamStart:
    def on_post(self, req, res, userid, stream_id):
        """
        @api {POST} /runner/live-streams/{stream_id}/start 1.Start Stream
        @apiDescription starts a stream.
        @apiName StreamStart
        @apiGroup Streamer
        @apiParam {String} stream_id Stream ID.
        @apiParam {String} url url to stream.
        @apiSuccess {Boolean} success Success key.
        """
        stream_config_data = req.media.get('configuration')
        username = req.media.get('username')
        root_path = get_root_path(userid)
        try:
            if root_path:
                stream_config_file_path = os.path.join(root_path, 'streamer', 'config.json')
            else:
                stream_config_file_path = STREAM_CONFIG_FILE
            with open(stream_config_file_path, 'r') as stream_config_file:
                stream_config = json.loads(stream_config_file.read())

            if 'playing_live_feed' in stream_config and stream_config['playing_live_feed']:
                res.status = HTTP_200
                res.body = json.dumps({
                    'success': False,
                    'error': {
                        'message': 'cann\'t start linear stream while live stream is playing ..'
                    }
                })
                return
            if stream_config_data:
                stream_config['stream_id'] = stream_id
                stream_config['slot_length'] = stream_config_data['slot_length']
                stream_config['stream_destinations'] = stream_config_data['stream_destinations']
                stream_config['ads']['enabled'] = stream_config_data['in_stream_config']['ads_enabled']
                stream_config['logo']['enabled'] = stream_config_data['in_stream_config']['logo_enabled']
                stream_config['watermark']['enabled'] = stream_config_data['in_stream_config']['watermark_enabled']
                stream_config['text_scroll']['enabled'] = stream_config_data['in_stream_config']['text_scroll_enabled']
                stream_config['show_time_code'] = stream_config_data['in_stream_config']['show_time_code']
                stream_config['stream_logo']['enabled'] = stream_config_data['in_stream_config']['stream_logo_enabled']
                stream_config['stream_quality'] = stream_config_data['stream_quality']
                if stream_config_data['stream_quality_settings']:
                    if stream_config_data['stream_quality_settings'] and stream_config_data['stream_quality_settings']['SD']:
                        if stream_config_data['stream_quality_settings']['SD']['resolution']:
                            stream_config['stream_quality_settings']['SD']['resolution'] = stream_config_data['stream_quality_settings']['SD']['resolution']
                        if stream_config_data['stream_quality_settings']['SD']['bitrate']:
                            stream_config['stream_quality_settings']['SD']['bitrate'] = stream_config_data['stream_quality_settings']['SD']['bitrate']
                    if stream_config_data['stream_quality_settings'] and stream_config_data['stream_quality_settings']['HD']:
                        if stream_config_data['stream_quality_settings']['HD']['resolution']:
                            stream_config['stream_quality_settings']['HD']['resolution'] = stream_config_data['stream_quality_settings']['HD']['resolution']
                        if stream_config_data['stream_quality_settings']['HD']['bitrate']:
                            stream_config['stream_quality_settings']['HD']['bitrate'] = stream_config_data['stream_quality_settings']['HD']['bitrate']
                if stream_config_data['broadcast_config']:
                    stream_config['broadcast_config']['url'] = stream_config_data['broadcast_config']['stream_url']
                    stream_config['broadcast_config']['key'] = stream_config_data['broadcast_config']['stream_key']
                if stream_config_data['live_feed_config']:
                    stream_config['live_feed_config']['url'] = stream_config_data['live_feed_config']['stream_url']
                    stream_config['live_feed_config']['key'] = stream_config_data['live_feed_config']['stream_key']
                stream_config['broadcast_state'] = 'running'
                if 'stream_live_text' in stream_config_data:
                    if root_path:
                        live_text_file = os.path.join(root_path, 'media-node-data', 'live_stream_text_scroll.txt')
                    else:
                        live_text_file = LIVE_TEXT_FILE
                    with open(live_text_file, 'w') as conf:
                        conf.write(stream_config_data['stream_live_text'])

            with open(stream_config_file_path, 'w') as conf:
                json.dump(stream_config, conf, indent=4)

            if username:
                service = 'streamer-{0}'.format(username)
            else:
                service = 'omniflixStream'
            args = 'supervisorctl restart {0}'.format(service)
            args = shlex.split(args)
            proc = subprocess.Popen(args)
            proc.wait()
            time.sleep(3)
            status = 'dead'
            args = 'supervisorctl status {0}'.format(service)
            args = shlex.split(args)
            status = subprocess.check_output(args)
            status = str(status.strip(), 'utf-8')
            status = status.split()
            if 'RUNNING' in status:
                res.status = HTTP_200
                res.body = json.dumps({
                    'success': True
                })
            else:
                res.status = HTTP_500
                res.body = json.dumps({
                    'success': False
                })
        except Exception as e:
            print(e)
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False
            })


class StreamStop:
    def on_post(self, req, res, userid, stream_id):
        """
        @api {POST} /runner/live-streams/{stream_id}/stop 2.Stop Stream
        @apiDescription Used to stop a stream.
        @apiName StreamStop
        @apiGroup Streamer
        @apiParam {String} stream_id Stream ID.
        @apiSuccess {Boolean} success Success key.
        """
        username = req.media.get('username')
        root_path = get_root_path(userid)
        try:
            if username:
                service = 'streamer-{0}'.format(username)
            else:
                service = 'omniflixStream'
            args = 'supervisorctl stop {0}'.format(service)
            args = shlex.split(args)
            result = subprocess.run(args=args, 
                        capture_output=True, 
                        text=True, 
                        check=False)
            status = result.stdout
            status = status.replace('(', '').replace(')', '').strip().split()

            if root_path:
                stream_config_file_path = os.path.join(root_path, 'streamer', 'config.json')
            else:
                stream_config_file_path = STREAM_CONFIG_FILE
            with open(stream_config_file_path, 'r') as stream_config_file:
                stream_config = json.loads(stream_config_file.read())
            
            stream_config['broadcast_state'] = 'stopped'

            with open(stream_config_file_path, 'w') as stream_config_file:
                json.dump(stream_config, stream_config_file, indent=4)

            if 'stopped' in status or 'not' in status:
                res.status = HTTP_200
                res.body = json.dumps({
                    'success': True
                })
            else:
                res.status = HTTP_500
                res.body = json.dumps({
                    'success': False
                })
        except Exception as e:
            print(e)
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False
            })


class StreamConfiguration:
    def on_get(self, req, res, userid, stream_id):
        root_path = get_root_path(userid)
        try:
            if root_path:
                stream_config_file_path = os.path.join(root_path, 'streamer', 'config.json')
            else:
                stream_config_file_path = STREAM_CONFIG_FILE
            with open(stream_config_file_path, 'r') as stream_config_file:
                stream_config = json.loads(stream_config_file.read())
            res.status = HTTP_200
            res.body = json.dumps({
                'success': True,
                'result': stream_config,
            })
        except Exception as e:
            print(e)
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False
            })

    def on_put(self, req, res, userid, stream_id):
        """
        @api {PUT} /runner/live-streams/{stream_id}/configuration 4.Update Stream Configuration
        @apiDescription updates a stream config.
        @apiName StreamConfigUpdate
        @apiGroup Streamer
        @apiParam {String} stream_id Stream ID.
        @apiParam {String} url url to stream.
        @apiSuccess {Boolean} success Success key.
        """
        logo = req.media.get('logo')
        text_scroll = req.media.get('text_scroll')
        watermark = req.media.get('watermark')
        broadcast_stream_destination = req.media.get('broadcast_stream_destination')
        logo_stream_destination = req.media.get('logo_stream_destination')
        stream_quality = req.media.get('stream_quality')
        stream_keys = req.media.get('stream_keys')
        stream_url = req.media.get('url')
        root_path = get_root_path(userid)

        try:
            if root_path:
                stream_config_file_path = os.path.join(root_path, 'streamer', 'config.json')
            else:
                stream_config_file_path = STREAM_CONFIG_FILE
            with open(stream_config_file_path, 'r') as stream_config_file:
                stream_config = json.loads(stream_config_file.read())
            if logo:
                stream_config['logo']['enabled'] = logo['enabled']
            if text_scroll:
                stream_config['text_scroll']['enabled'] = text_scroll['enabled']
            if watermark:
                stream_config['watermark']['enabled'] = watermark['enabled']
            if broadcast_stream_destination:
                stream_config['broadcast_stream_destination'] = broadcast_stream_destination
            if logo_stream_destination:
                stream_config['logo_stream_destination'] = logo_stream_destination
            if stream_quality:
                stream_config['stream_quality'] = stream_quality
            if stream_keys:
                stream_config['stream_keys'] = stream_keys
            if stream_url:
                stream_config['stream_url'] = stream_url

            with open(stream_config_file_path, 'w') as stream_config_file:
                json.dump(stream_config, stream_config_file, indent=4)

            res.status = HTTP_200
            res.body = json.dumps({
                'success': True
            })

        except Exception as e:
            print(e)
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False
            })


class StreamLiveText:
    def on_post(self, req, res, userid, stream_id):
        """
        @api {POST} /runner/live-streams/{stream_id}/live-text 1.Insert text in Stream
        @apiDescription insert given text into stream.
        @apiName StreamLiveText
        @apiGroup Streamer
        @apiParam {String} stream_id Stream ID.
        @apiParam {String} time time in string format HH-MM-SS.
        @apiParam {String} text text
        @apiSuccess {Boolean} success Success key.
        """
        try:
            text = req.media.get('text')
            schedule = req.params.get('schedule') if 'schedule' in req.params else False
            root_path = get_root_path(userid)
            if schedule:
                pass
            else:
                if root_path:
                    livetext_file = os.path.join(root_path, 'media-node-data', 'live_stream_text_scroll.txt')
                else:
                    livetext_file = os.path.join(STREAM_ROOT_DIRECTORY, 'live_stream_text_scroll.txt')
                with open(livetext_file, 'w') as livetext:
                    livetext.write(text)

                res.status = HTTP_200
                res.body = json.dumps({
                    'success': True
                })

        except Exception as e:
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False
            })


class StreamStatus:
    def on_get(self, req, res, userid, stream_id):
        """
        @api {POST} /runner/live-streams/{stream_id}/status 1. Status Of Stream
        @apiDescription gives status of requested stream.
        @apiName StreamStatus
        @apiGroup Streamer
        @apiParam {String} stream_id Stream ID.
        """
        root_path = get_root_path(userid)
        username = root_path.split('/')[2] if root_path else None
        if username == 'ubuntu':
            username = 'main'
        try:
            utc = datetime.utcnow()
            now = utc.astimezone(tz.gettz(TIME_ZONE))
            if username:
                service = 'streamer-{0}'.format(username)
            else:
                service = 'omniflixStream'
            args = 'supervisorctl status {0}'.format(service)
            args = shlex.split(args)
            result = subprocess.run(args=args, 
                        capture_output=True, 
                        text=True, 
                        check=False)
            status = result.stdout
            status = status.replace('(', '').replace(')', '').strip().split()
            if 'RUNNING' in status:
                stream = {}
                args = ['bash', '/usr/local/runner/scripts/stream_status.sh', service]
                out = subprocess.check_output(args)
                out = str(out.strip(), 'utf-8')
                lines = out.split('\n')
                for line in lines:
                    if 'Elapsed' in line:
                        stream['elapsed'] = int(line.split('/')[0].split(':')[-1].strip())
                    if 'Remaining' in line:
                        stream['remaining'] = int(line.split('/')[0].split(':')[-1].strip())

                if root_path:
                    stream_directory = os.path.join(root_path, 'media-node-data')
                else:
                    stream_directory = os.path.join(STREAM_ROOT_DIRECTORY)
                playout_folder = '{0}/playoutfiles/nowPlaying'.format(stream_directory, now.strftime('%Y-%m-%d'))
                playout_file = os.path.join(playout_folder, 'playout.json')
                print(playout_file)

                playout = []
                if os.path.exists(playout_file):
                    with open(playout_file, 'r') as playout_f:
                        playout = json.loads(playout_f.read())

                stream['playout'] = playout
                details_file = os.path.join(playout_folder, 'details.json')
                details = None
                if os.path.exists(details_file):
                    with open(details_file, 'r') as details_f:
                        details = json.loads(details_f.read())
                if details and 'diff' in details.keys() and details['diff']:
                    stream['elapsed'] += int(details['diff'])
                    stream['remaining'] -= int(details['diff'])
                for item in playout:
                    if stream['elapsed'] >= item['in'] and stream['elapsed'] <= item['out']:
                        stream['nowPlaying'] = {
                            'index': playout.index(item),
                            'title': item['title'],
                            'thumbnail': item.get('thumbnail'),
                            'poc': ((stream['elapsed'] - item['in']) / (item['out'] - item['in'])) * 100,
                        }
                        break

                res.status = HTTP_200
                res.body = json.dumps({
                    'success': True,
                    'status': 'running',
                    'stream': stream,
                })
            else:
                res.status = HTTP_200
                res.body = json.dumps({
                    'success': True,
                    'status': 'dead'
                })
        except Exception as e:
            print(e)
            res.status = HTTP_500
            res.body = json.dumps({
                'success': False
            })

class StreamDetails:
    def on_get(self, req, res):
        try:
            stream_url = req.get_param('stream_url')
            if stream_url is None:
                raise HTTPBadRequest('stream_url is required')

            rtmp_stat_url = "http://localhost:8083/stat"
            response = requests.get(rtmp_stat_url)
            
            if response.status_code != 200:
                raise Exception('Failed to retrieve RTMP stats')

            xml_data = response.text
            root = ET.fromstring(xml_data)
            bitrate = 0
            stream_found = False

            for app in root.findall(".//application"):
                name_elem = app.find("name")
                if name_elem is not None and name_elem.text == stream_url:
                    print(f"Application: {name_elem.text}")
                    for stream in app.findall(".//stream"):
                        stream_name = stream.find("name").text if stream.find("name") is not None else "Unknown"
                        bw_in = stream.find("bw_in").text if stream.find("bw_in") is not None else "0"
                        bitrate = int(bw_in)
                        stream_found = True
                    break

            if not stream_found:
                print(f"No application found with name '{stream_url}'")
                res.status = HTTP_400
                res.body = json.dumps({
                    'success': False,
                    'error': {
                        'message': 'Stream not found'
                    }
                })
                return

            res.status = HTTP_200
            res.body = json.dumps({
                'success': True,
                'result': bitrate
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
                    'message': str(e)
                }
            })

