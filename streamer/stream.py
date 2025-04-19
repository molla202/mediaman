# coding: utf-8
import json
import os
import sys
import random
import shlex
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
import dateparser
import requests
import pytz
import psutil
from dateutil import tz
from _thread import start_new_thread

ID = os.getenv('RUNNER_ID') or ''
TOKEN = os.getenv('RUNNER_TOKEN') or ''
BACKEND_URL = os.getenv('BACKEND_URL') or ''
TIME_ZONE = tz.gettz('UTC') or tz.gettz(os.getenv('TIME_ZONE', 'UTC'))
CPU_THREADS = int(psutil.cpu_count(logical=True) / 2) or 4


class Streamer:

    def __init__(
            self,
            hooks,
            root_directory,
            stream_id,
            fonts_directory,
            default_playlist,
            ads,
            logo,
            text_scroll,
            program_info_overlay,
            program_info_overlay_styles,
            dynamic_overlay,
            watermark,
            default_video_file,
            stream_destination_url,
            stream_quality='SD',
            vcodec='libx264',
            vbr=4000,
            fps=24,
            crf=22,
            resolution='1280x720',
            preset='ultrafast',
            acodec='aac',
            abr=128,
            asamplerate=44100,
            achannels=2,
            slot_duration=10800,
            ext='.mp4',
    ):

        self.hooks = hooks
        self.root_dir = root_directory
        self.stream_id = stream_id
        self.fonts_dir = fonts_directory
        self.default_playlist = default_playlist
        self.ads = ads
        self.logo = logo
        self.text_scroll = text_scroll
        self.program_info_overlay = program_info_overlay
        self.program_info_overlay_styles = program_info_overlay_styles
        self.dynamic_overlay = dynamic_overlay
        self.watermark = watermark
        self.stream_destination_url = stream_destination_url
        self.stream_quality = stream_quality
        self.vcodec = vcodec
        self.vbr = vbr
        self.fps = fps
        self.crf = crf
        self.resolution = resolution
        self.preset = preset
        self.acodec = acodec
        self.abr = abr
        self.asamplerate = asamplerate
        self.achannels = achannels
        self.slot_duration = slot_duration
        self.ext = ext
        self.root_dir = os.path.join(root_directory)
        self.default_video_file = default_video_file

    @staticmethod
    def _get_current_slot(slots, is_default_playlist=False):
        now = datetime.utcnow().replace(tzinfo=pytz.UTC)
        if is_default_playlist:
            return slots[0] if slots else {}
        for slot in slots:
            start = dateparser.parse(slot['startAt'])
            end = dateparser.parse(slot['endAt'])
            print(start, end, now)
            if start <= now <= end:
                return slot
        return None

    @staticmethod
    def get_asset_duration(asset):
        args = 'ffprobe -v quiet \
                        -print_format json \
                        -show_entries format=duration,size'
        args = shlex.split(args)
        args.append(asset)
        try:
            output = subprocess.check_output(args).decode('utf-8')
            output = json.loads(output)

            return float(output['format']['duration'])

        except subprocess.CalledProcessError:
            return None

    def _add_inputfiles_filter_complex(self, filter_complex, n):
        if n == 0:
            return filter_complex

        filter_complex_str = ''
        for i in range(n):
            filter_complex_str += '[{0}:v]scale={1},setsar=1[{0}v];[{0}:a]aresample=async=1:first_pts=0[{0}a];'.format(
                i, self.resolution)

        for i in range(n):
            filter_complex_str += '[{0}v][{0}a]'.format(i)
        filter_complex_str += 'concat=n={0}:v=1:a=1[outv][outa];[outv]realtime[outv]'.format(n)
        filter_complex.append(filter_complex_str)

        return filter_complex

    def _get_logo_file(self):
        logo_path = '{0}/{1}'.format(self.root_dir, self.logo['input']['source'])
        if os.path.exists(logo_path):
            logo_input = ['-i', logo_path]
            return logo_input
        return None

    def _get_watermark_file(self):
        watermark_path = '{0}/{1}'.format(self.root_dir, self.watermark['input']['source'])
        if os.path.exists(watermark_path):
            logo_input = ['-i', watermark_path]
            return logo_input
        return None

    def _get_random_asset(self, category='Music'):
        all_assets_file = '{0}/assets/allAssets.json'.format(self.root_dir)
        if os.path.exists(all_assets_file):
            with open(all_assets_file, 'r') as fp:
                assets = json.loads(fp.read())
            res = [asset for asset in assets if asset['category'] == category]
            obj = random.choice(res)
            return '{0}/assets/{1}/{1}{2}'.format(self.root_dir, obj['assetID'], self.ext), obj['duration']
        else:
            paths = []
            directory = os.path.join(self.root_dir, 'assets')
            for path in Path(directory).rglob('*.mp4'):
                if path.is_file():
                    paths.append(path)
            path = random.choice(paths)
            return str(path), self.get_asset_duration(path)

    def get_overlays_filter(self, overlays, input_files, input_count):
        overlays_str = ''
        overlay_count = 0
        _filter = ''
        for overlay in overlays:
            file = os.path.join(self.root_dir, 'sources/' + overlay['file'])
            now = datetime.utcnow()
            for pt in overlay['pts']:
                pt = dateparser.parse(pt).replace(tzinfo=None)
                if now > pt:
                    continue
                overlay_sec = (pt - now).seconds
                input_files.extend(['-i', file])
                _filter += '[{0}:v]setpts=PTS-STARTPTS+{1}/TB,scale={2},colorchannelmixer=aa=1[overlay{3}];'.format(
                    input_count, overlay_sec, self.resolution, overlay_count)
                overlays_str += '[outv][overlay{0}]overlay=x={1}:y={2}:enable=\'1\':eof_action=pass[outv];'.format(
                    overlay_count, overlay['position']['x'], overlay['position']['y'])
                input_count += 1
                overlay_count += 1
        return _filter + overlays_str[:-1], input_files, input_count

    def _get_filter(self, _type, idx):
        _filter = ''
        if _type == 'logo':
            _filter = '[{0}:v]setpts=N/FRAME_RATE/TB,scale={1}:-1,loop=-1:size=160,format={2},\
            colorchannelmixer={3}[logo];[outv][logo]overlay=x={4}:y={5}[outv]'.format(
                idx,
                self.logo['concat_settings']['scale'][self.stream_quality],
                self.logo['filters']['format'],
                self.logo['concat_settings']['colorchannelmixer'],
                self.logo['filters']['overlay']['x'],
                self.logo['filters']['overlay']['y'],
            )
        elif _type == 'text_scroll':
            text_file = os.path.join(self.root_dir, 'live_stream_text_scroll.txt')
            font_file = self.fonts_dir + self.text_scroll['fontfile']
            if os.path.exists(text_file):
                _filter = '[outv]{0}=textfile=\'{1}\':fontfile=\'{2}\':y={3}:x={4}:fontcolor={5}:fontsize={6}:shadowx={7}:shadowy={8}:reload=1[outv]'.format(
                    self.text_scroll['type'],
                    text_file,
                    font_file,
                    self.text_scroll['y'],
                    self.text_scroll['x'],
                    self.text_scroll['fontcolor'],
                    self.text_scroll['fontsize'],
                    self.text_scroll['shadow_x'],
                    self.text_scroll['shadow_y'],
                )
        elif _type == 'watermark':
            _filter = '[{0}:v]scale={1}:-1,colorchannelmixer={2}[watermark];[out][watermark]overlay={3}:{4}:format={5}[out]'.format(
                idx,
                self.watermark['concat_settings']['scale'][self.stream_quality],
                self.watermark['concat_settings']['colorchannelmixer'],
                self.watermark['filters']['overlay']['x'],
                self.watermark['filters']['overlay']['y'],
                self.watermark['filters']['overlay']['format'],
            )

        return _filter

    def get_playing_now_filter(self, programs, program_elapsed):
        duration = 0
        program_info_overlay_style = '{0}_{1}'.format(self.stream_quality.upper(),
                                                      self.program_info_overlay['default_position'])
        filters = self.program_info_overlay_styles[program_info_overlay_style]['filters']
        playling_now_filters = []

        font_file = self.fonts_dir + filters[1]['fontfile']
        font_file_title = self.fonts_dir + filters[2]['fontfile']
        for program in programs:
            program_name = program['asset']['name']
            if len(program_name) > 20:
                program_name = program_name[:20]

            program_duration = program['asset']['endAt'] - program['asset']['startAt']
            start_sec = duration
            end_sec = duration + program_duration - program_elapsed
            duration = end_sec
            program_elapsed = 0
            if 'category' in program['asset'] and (
                    program['asset']['category'] == 'ad' or program['asset']['category'] == 'ads'):
                continue

            _filter = '[outv]{0}=x={1}:y={2}:w={3}:h={4}:color={5}:t=\'{6}\':enable=\'between(t\, {7}, {8})\',' \
                      'format={9}[outv];'.format(
                filters[0]['type'],
                filters[0]['x'],
                filters[0]['y'],
                filters[0]['w'],
                filters[0]['h'],
                filters[0]['color'],
                filters[0]['t'],
                round(start_sec, 2),
                round(end_sec, 2),
                filters[0]['format'],
            )

            _filter += '[outv]{0}=text=\'{1}\':x={2}:y={3}:fontfile={4}:fontsize={5}:fontcolor={6}:box={7}:' \
                       'boxborderw={8}:boxcolor={9}:shadowcolor={10}:shadowx={11}:shadowy={12}:' \
                       'enable=\'between(t\,{13},{14})\', format={15}[outv];'.format(
                filters[1]['type'],
                filters[1]['text'],
                filters[1]['x'],
                filters[1]['y'],
                font_file,
                filters[1]['fontsize'],
                filters[1]['fontcolor'],
                filters[1]['box'],
                filters[1]['boxborderw'],
                filters[1]['boxcolor'],
                filters[1]['shadowcolor'],
                filters[1]['shadow_x'],
                filters[1]['shadow_y'],
                round(start_sec, 2),
                round(end_sec, 2),
                filters[1]['format'],
            )
            _filter += '[outv]{0}=text={1}:x={2}:y={3}:fontfile={4}:fontsize={5}:fontcolor={6}:box={7}:' \
                       'boxborderw={8}:boxcolor={9}:shadowcolor={10}:shadowx={11}:shadowy={12}:' \
                       'enable=\'between(t\,{13},{14})\', format={15}[outv]'.format(
                filters[2]['type'],
                program_name.replace(':', '\\\\\\\\\\\\:').replace("'", "\\\\\\\\\\\\'").replace(',', '\\\\\\\\\\\\,'),
                filters[2]['x'],
                filters[2]['y'],
                font_file_title,
                filters[2]['fontsize'],
                filters[2]['fontcolor'],
                filters[2]['box'],
                filters[2]['boxborderw'],
                filters[2]['boxcolor'],
                filters[2]['shadowcolor'],
                filters[2]['shadow_x'],
                filters[2]['shadow_y'],
                round(start_sec, 2),
                round(end_sec, 2),
                filters[2]['format'],
            )
            playling_now_filters.append(_filter)
        return ';'.join(playling_now_filters)

    def default_stream_loop(self, filter_complex):
        cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'info']

        if (os.path.exists(self.default_video_file)):
            cmd.extend(['-stream_loop', '-1', '-i', self.default_video_file])
        else:
            cmd.extend(['-stream_loop', '-1', '-i', '/home/ubuntu/media-node-data/logo.mp4'])

        if filter_complex:
            filter_complex_str = ';'.join(filter_complex)
            cmd.extend(['-filter_complex', f'"{filter_complex_str}"'])

        cpu_threads = CPU_THREADS

        cmd.extend([
            '-map', "'[outv]'", 
            '-map', "'[outa]'",
            '-vcodec', str(self.vcodec),
            '-pix_fmt', 'yuv420p',
            '-preset', str(self.preset),
            '-s', str(self.resolution),
            '-crf', str(self.crf),
            '-r', str(self.fps),
            '-g', str(self.fps * 2),
            '-keyint_min', str(self.fps * 2),
            '-maxrate', str(self.vbr),
            '-b:v', str(self.vbr),
            '-acodec', str(self.acodec),
            '-ar', str(self.asamplerate),
            '-ac', str(self.achannels),
            '-threads', str(cpu_threads),
            '-b:a', str(self.abr) + 'k',
            '-bufsize', str(self.vbr * 4),
            '-sc_threshold', '0',
            '-fflags', '+genpts',
            '-movflags', '+faststart',
            '-tune', 'zerolatency',
            '-f', 'flv', str(stream_destination_url)
        ])

        return cmd

    def _generate_stream_cmd(self, input_files, filter_complex, to_secs):
        cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'info']
        if len(input_files):
            cmd.extend(['-re'] + input_files)
        else:
            cmd.extend(['-stream_loop', '-1', '-i', '/home/ubuntu/media-node-data/logo.mp4'])

        if filter_complex:
            filter_complex_str = ';'.join(filter_complex)
            cmd.extend(['-filter_complex', f'"{filter_complex_str}"'])

        cpu_threads = CPU_THREADS

        cmd.extend([
            '-to', str(to_secs),
            '-map', "'[outv]'", 
            '-map', "'[outa]'",
            '-vcodec', str(self.vcodec),
            '-pix_fmt', 'yuv420p',
            '-preset', str(self.preset),
            '-s', str(self.resolution),
            '-crf', str(self.crf),
            '-r', str(self.fps),
            '-g', str(self.fps * 2),
            '-keyint_min', str(self.fps * 2),
            '-maxrate', str(self.vbr),
            '-b:v', str(self.vbr),
            '-acodec', str(self.acodec),
            '-ar', str(self.asamplerate),
            '-ac', str(self.achannels),
            '-threads', str(cpu_threads),
            '-b:a', str(self.abr) + 'k',
            '-bufsize', str(self.vbr * 4),
            '-sc_threshold', '0',
            '-fflags', '+genpts',
            '-movflags', '+faststart',
            '-tune', 'zerolatency',
            '-f', 'flv', str(stream_destination_url)
        ])

        return cmd

    def run_process(self, cmd):
        try:
            process = subprocess.Popen(cmd, shell=False, stdin=subprocess.PIPE, stderr=subprocess.PIPE,
                                       stdout=subprocess.PIPE)
            self.hooks['process']()
            process.wait()
            error = process.stderr.read()
            if error:
                self.hooks['error'](error)
                return
            else:
                print('slot completed')

        except Exception as e:
            message = e
            if hasattr(e, 'message'):
                print(e.message)
                message = e.message
            self.hooks['error'](message)

    def stream(self):
        utc = datetime.now()
        now = utc.astimezone(TIME_ZONE)
        playlist_path = '{0}/{1}/playlists/{2}/playlist.json'.format(self.root_dir, self.stream_id, now.strftime('%Y-%m-%d'))
        playout_folder = '{0}/playoutfiles/{1}/{2}'.format(self.root_dir, now.strftime('%Y-%m-%d'), now.strftime('%H%M'))
        now_playing_folder = '{0}/playoutfiles/nowPlaying'.format(self.root_dir)
        print(playlist_path)
        if not os.path.exists(playout_folder):
            os.makedirs(playout_folder, exist_ok=True)

        if not os.path.exists(now_playing_folder):
            os.makedirs(now_playing_folder, exist_ok=True)

        is_default_playlist = False
        is_same_playout = False
        diff = None
        print(playlist_path)
        prev_playout = []
        previous_playout_path = os.path.join(now_playing_folder, 'playout.json')
        if os.path.exists(previous_playout_path):
            with open(previous_playout_path, 'r') as prev_file:
                prev_playout = json.loads(prev_file.read())

        if not os.path.exists(playlist_path):
            print('today\'s playlist not found ...')
            print('taking default playlist ...')
            playlist_path = self.default_playlist
            print(playlist_path)
            is_default_playlist = True
        fpc = []
        if playlist_path is not None and os.path.exists(playlist_path):
            with open(playlist_path, 'r') as fp:
                playlist = json.loads(fp.read())

            slots = playlist['slots'] if 'slots' in playlist else []
            slot = self._get_current_slot(slots, is_default_playlist)
            if not slot:
                print('slot not found ...')
                print('taking default playlist ...')
                playlist_path = self.default_playlist
                print(playlist_path)
                is_default_playlist = True
                if playlist_path is not None and os.path.exists(playlist_path):
                    with open(playlist_path, 'r') as fp:
                        playlist = json.loads(fp.read())

                    slots = playlist['slots'] if 'slots' in playlist else []
                    slot = self._get_current_slot(slots, is_default_playlist)

            if slot:
                if not is_default_playlist:
                    slot_start_time = dateparser.parse(slot['startAt'])
                else:
                    slot_start_time = dateparser.parse(datetime.utcnow().strftime('%Y-%m-%dT%H:%M:00.000Z'))
                programs = slot['programs'] if 'programs' in slot else []
                input_files = []
                total_duration = 0
                input_count = 0
                to_secs = 0
                programs_to_play = []

                nt = datetime.utcnow()
                for program in programs:
                    asset_id = program['asset']['id']
                    asset_path = program['asset']['path']
                    start_at = program['asset']['startAt']
                    end_at = program['asset']['endAt']
                    asset_duration = end_at - start_at
                    asset = '{0}/{1}'.format(self.root_dir, asset_path)
                    thumbnail = program['asset'].get('thumbnail')
                    if os.path.exists(asset):
                        fpc.append({
                            "title": program['asset']['name'],
                            "file": asset,
                            "thumbnail": thumbnail,
                            "ad": program['asset']['isAd'],
                            "in": total_duration,
                            "out": total_duration + asset_duration,
                            "start_at": (slot_start_time + timedelta(0, total_duration)).isoformat(),
                            "end_at": (slot_start_time + timedelta(0, total_duration + asset_duration)).isoformat(),
                        })
                        total_duration += asset_duration

                        if not is_default_playlist:
                            program_start_time = dateparser.parse(program['startAt'])
                            program_end_time = dateparser.parse(program['endAt'])

                            if nt > program_end_time.replace(tzinfo=None):
                                continue
                            if nt > program_start_time.replace(tzinfo=None):
                                diff = nt - program_start_time.replace(tzinfo=None)
                                if prev_playout and len(prev_playout) >= len(fpc) and fpc[-1]['file'] == \
                                        prev_playout[len(fpc) - 1]['file']:
                                    is_same_playout = True
                                    start_at = start_at + diff.seconds

                        input_files.extend(['-ss', str(start_at), '-t', str(end_at - start_at), '-i', asset])
                        input_count += 1
                        programs_to_play.append(program)
                        to_secs += end_at - start_at

                filter_complex = []
                filter_complex = self._add_inputfiles_filter_complex(filter_complex, input_count)

                overlays_filter, input_files, input_count = self.get_overlays_filter(slot['overlays'], input_files,
                                                                                     input_count)
                if len(overlays_filter):
                    filter_complex.append(overlays_filter)

                fpc_file = os.path.join(playout_folder, 'playout.json')
                with open(fpc_file, 'w') as fpc_f:
                    json.dump(fpc, fpc_f, indent=4)
                elapsed_time = (nt - dateparser.parse(slot['startAt']).replace(tzinfo=None)).seconds
                if not is_same_playout and diff and diff.seconds:
                    elapsed_time -= diff.seconds
                program_elapsed = 0
                if is_same_playout and diff and diff.seconds:
                    program_elapsed = diff.seconds

                details_file = os.path.join(playout_folder, 'details.json')
                with open(details_file, 'w') as details_f:
                    json.dump({
                        'slot_name': slot['name'],
                        'start_time': slot['startAt'],
                        'started_at': now.isoformat(),
                        'diff': elapsed_time,
                    }, details_f, indent=4, ensure_ascii=False)
                shutil.copy(details_file, now_playing_folder)
                shutil.copy(fpc_file, now_playing_folder)

                if self.program_info_overlay['enabled']:
                    playing_now_filter = self.get_playing_now_filter(programs_to_play, program_elapsed)
                    if len(playing_now_filter):
                        filter_complex.append(playing_now_filter)

                if self.logo['enabled']:
                    logo = self._get_logo_file()
                    if logo:
                        input_files.extend(logo)
                        logo_filter = self._get_filter('logo', input_count)
                        if logo_filter:
                            filter_complex.append(logo_filter)
                        input_count += 1
                if self.text_scroll['enabled']:
                    scroll_filter = self._get_filter('text_scroll', input_count)
                    if scroll_filter:
                        filter_complex.append(scroll_filter)

                if self.watermark['enabled']:
                    watermark = self._get_watermark_file()
                    if watermark:
                        input_files.extend(watermark)
                        watermark_filter = self._get_filter('watermark', input_count)
                        if watermark_filter:
                            filter_complex.append(watermark_filter)
                        input_count += 1

                cmd = self._generate_stream_cmd(input_files, filter_complex, to_secs)

                shcmd = ' '.join(cmd)
                print('\n', shcmd, '\n')

                sh_file = os.path.join(playout_folder, 'stream.sh')

                with open(sh_file, 'w') as sh_stream:
                    sh_stream.write('#! /bin/bash \n')
                    sh_stream.write('trap "exit" INT \n')
                    sh_stream.write('\n')
                    sh_stream.write('dt=$(date -u "+%Y%m%d-%H%M%S")\n')
                    sh_stream.write(shcmd + ' 2>' + playout_folder + '/$dt.log\n')
                    sh_stream.write('\n')
                    sh_stream.close()
                shutil.copy(sh_file, now_playing_folder)
                subprocess.call("bash " + sh_file, shell=True)

            else:
                print('current slot not found ...')
                filter_complex = []
                filter_complex = self._add_inputfiles_filter_complex(filter_complex, 1)
                if self.text_scroll['enabled']:
                    scroll_filter = self._get_filter('text_scroll', 1)
                    if scroll_filter:
                        filter_complex.append(scroll_filter)

                cmd = self.default_stream_loop(filter_complex)
                shcmd = ' '.join(cmd)
                print('\n', shcmd, '\n')

                sh_file = os.path.join(playout_folder, 'stream.sh')

                with open(sh_file, 'w') as sh_stream:
                    sh_stream.write('#! /bin/bash \n')
                    sh_stream.write('trap "exit" INT \n')
                    sh_stream.write('\n')
                    sh_stream.write('dt=$(date -u "+%Y%m%d-%H%M%S")\n')
                    sh_stream.write(shcmd + ' 2>' + playout_folder + '/$dt.log\n')
                    sh_stream.write('\n')
                    sh_stream.close()
                shutil.copy(sh_file, now_playing_folder)
                subprocess.call("bash " + sh_file, shell=True)
        else:
            print('playlist not found ...')
            filter_complex = []
            filter_complex = self._add_inputfiles_filter_complex(filter_complex, 1)
            if self.text_scroll['enabled']:
                scroll_filter = self._get_filter('text_scroll', 1)
                if scroll_filter:
                    filter_complex.append(scroll_filter)

            cmd = self.default_stream_loop(filter_complex)
            shcmd = ' '.join(cmd)
            print('\n', shcmd, '\n')

            sh_file = os.path.join(playout_folder, 'stream.sh')

            with open(sh_file, 'w') as sh_stream:
                sh_stream.write('#! /bin/bash \n')
                sh_stream.write('trap "exit" INT \n')
                sh_stream.write('\n')
                sh_stream.write('dt=$(date -u "+%Y%m%d-%H%M%S")\n')
                sh_stream.write(shcmd + ' 2>' + playout_folder + '/$dt.log\n')
                sh_stream.write('\n')
                sh_stream.close()
            shutil.copy(sh_file, now_playing_folder)
            subprocess.call("bash " + sh_file, shell=True)


def update_stream(body):
    body['token'] = TOKEN
    url = '{0}/streamer/update-live-stream'.format(BACKEND_URL)

    try:
        requests.put(url, json=body)
    except Exception as e:
        print(e)


def process_hook():
    update_stream({
        'status': 'SUCCESS',
        'message': 'successfully started'
    })


def error_hook(message):
    update_stream({
        'status': 'FAILED',
        'message': message
    })


if __name__ == '__main__':
    with open('/home/ubuntu/streamer/config.json', 'r') as conf:
        stream_config = json.loads(conf.read())

    if 'playing_live' in stream_config and stream_config['playing_live_feed']:
        print('live stream playing ...')
        sys.exit(1)

    root_directory = stream_config['root_dir']
    stream_id = stream_config['stream_id']
    fonts_directory = stream_config['fonts_dir']
    default_playlist = stream_config.get('default_playlist', None)
    ads = stream_config['ads']
    logo = stream_config['logo']
    text_scroll = stream_config['text_scroll']
    program_info_overlay = stream_config['program_info_overlay']
    program_info_overlay_styles = stream_config['program_info_overlay_styles']
    dynamic_overlay = stream_config['dynamic_overlay']
    watermark = stream_config['watermark']
    stream_destination_url = stream_config['broadcast_config']['url'] + '/' + stream_config['broadcast_config']['key']

    slotDuration = stream_config['slot_length']
    streamQuality = stream_config['stream_quality']

    video_codec = stream_config['encoder_settings']['video']['codec']
    video_resolution = stream_config['stream_quality_settings'][streamQuality]['resolution']
    video_bitrate = stream_config['stream_quality_settings'][streamQuality]['bitrate']
    video_fps = stream_config['encoder_settings']['video']['fps']
    video_crf = stream_config['encoder_settings']['video']['crf']
    video_preset = stream_config['encoder_settings']['video']['preset']

    audio_codec = stream_config['encoder_settings']['audio']['codec']
    audio_bitrate = stream_config['encoder_settings']['audio']['bitrate']
    audio_samplerate = stream_config['encoder_settings']['audio']['samplerate']
    audio_channels = stream_config['encoder_settings']['audio']['channels']

    default_video_file = stream_config['default_video_file']

    hooks = {
        'process': process_hook,
        'error': error_hook
    }
    streamer = Streamer(hooks, root_directory, stream_id, fonts_directory, default_playlist, ads, logo, text_scroll,
                        program_info_overlay, program_info_overlay_styles, dynamic_overlay, watermark, default_video_file,
                        stream_destination_url, stream_quality=streamQuality,
                        vcodec=video_codec, vbr=video_bitrate, fps=video_fps, crf=video_crf,
                        resolution=video_resolution,
                        acodec=audio_codec, abr=audio_bitrate, achannels=audio_channels, asamplerate=audio_samplerate,
                        slot_duration=slotDuration)

    streamer.stream()
