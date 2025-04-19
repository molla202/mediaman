# coding: utf-8
import json
import os
import re
import random
import shutil
import subprocess
import tempfile

from .ff_probe import info, get_resolution
from ..utils.file import is_valid_encode


class FFMPEG:
    def __init__(self, key, file_path, destination_path, hooks, chapter_duration=300, scene_cut_threshold=0.5,
                 video_codec='libx264', video_bitrate=4000, audio_codec='aac', audio_bitrate=320, frames_per_sec=25,
                 resolution='1920x1080', preset='superfast', ext='.mp4'):
        self.key = key
        self.file_path = file_path
        self.destination_path = destination_path
        self.chapter_duration = chapter_duration
        self.scene_cut_threshold = scene_cut_threshold
        self.video_codec = video_codec
        self.video_bitrate = video_bitrate
        self.audio_codec = audio_codec
        self.audio_bitrate = audio_bitrate
        self.frames_per_sec = frames_per_sec
        self.resolution = resolution
        self.width = int(resolution.split('x')[0])
        self.height = int(resolution.split('x')[1])
        self.preset = preset
        self.hooks = hooks
        self.ext = ext
        self.video_nft_folder = os.path.join(self.destination_path)
        self.segments_folder = os.path.join(self.video_nft_folder, 'segments')
        self.m3u8_file = '{0}/master.m3u8'.format(self.segments_folder)
        self.mp4_file = '{0}/default.mp4'.format(self.destination_path)

    def _get_scene_cuts(self):
        temp_file_name, scene_cuts = '', []
        try:
            if not (0 <= self.scene_cut_threshold <= 1):
                raise RuntimeError('scene_cut threshold must be between 0 and 1')

            temp_dir = tempfile.gettempdir()
            temp_file_name = os.path.join(
                temp_dir, next(tempfile._get_candidate_names()) + '.txt'
            )

            cmd = [
                'ffmpeg',
                '-hide_banner', '-loglevel', 'error',
                '-y', '-i', self.file_path,
                '-vf', 'select=gte(scene\,0),metadata=print:file=' + temp_file_name,
                '-an', '-f', 'null', '-']
            subprocess.check_call(cmd)

            lines = []
            if os.path.isfile(temp_file_name):
                with open(temp_file_name, 'r') as out:
                    lines = out.readlines()

            frame_info = {}
            for line in lines:
                line = line.strip()

                if line.startswith('frame'):
                    frame_regex = r'frame:(?P<frame>\d+)\s+pts:(?P<pts>[\d\.]+)\s+pts_time:(?P<pts_time>[\d\.]+)'
                    match = re.match(frame_regex, line)
                    if match:
                        matches = match.groupdict()
                        frame_info['frame'] = int(matches['frame'])
                        frame_info['pts'] = float(matches['pts'])
                        frame_info['pts_time'] = float(matches['pts_time'])
                    else:
                        raise RuntimeError('wrongly formatted line: ' + line)

                elif line.startswith('lavfi.scene_score'):

                    score = line.split('=')[1]
                    frame_info['score'] = float(score)
                    if float(score) >= self.scene_cut_threshold:
                        scene_cuts.append(frame_info)
                        frame_info = {}
            if not len(scene_cuts):
                scene_cuts.append(frame_info)

        except Exception as e:
            print(e)
        finally:
            if os.path.isfile(temp_file_name):
                os.remove(temp_file_name)

        return scene_cuts

    def _generate_chapters(self, scenes):
        chapters, last_scene_time = [], 0
        for scene in scenes:
            if 'frame' in scene and scene['pts_time'] - last_scene_time > self.chapter_duration:
                last_scene_time = scene['pts_time']
                chapters.append(scene['pts_time'])

        return chapters

    def _save_scenecuts(self, scenes, scenes_file, duration):
        scenes_list = []
        count = 0
        start_time = 0
        for scene in scenes:
            name = 'scene{}'.format(count)
            end_time = scene['pts_time']
            scenes_list.append({
                'name': name,
                'start_time': start_time,
                'end_time': end_time,
                'duration': end_time - start_time
            })
            start_time = end_time
            count += 1
        if start_time < duration:
            name = 'scene{}'.format(count)
            end_time = duration
            scenes_list.append({
                'name': name,
                'start_time': start_time,
                'end_time': end_time,
                'duration': end_time - start_time
            })

        with open(scenes_file, 'w') as f:
            json.dump(scenes_list, f, indent=2)

    def _get_segments_count(self):
        count = 0
        for path, dirs, files in os.walk(self.video_nft_folder):
            for filename in files:
                if filename.endswith(self.ext):
                    count = count + 1

        return count

    def _check_m3u8(self):
        if os.path.exists(self.m3u8_file):
            with open(self.m3u8_file) as f:
                for line in f.readlines():
                    if '#EXT-X-ENDLIST' in line:
                        return True

        return False

    def generate_m3u8_playlist(self):
        if not os.path.exists(self.segments_folder):
            os.makedirs(self.segments_folder)
        cmd = [
            'ffmpeg', '-y',
            '-hide_banner', '-v', 'warning',
            '-i', str(self.file_path),
            '-c:a', self.audio_codec,
            '-b:a', self.audio_bitrate,
            '-ar', '44100',
            '-c:v', self.video_codec,
            '-crf', '22',
            '-sc_threshold', '0',
            '-g', str(self.frames_per_sec * 2),
            '-keyint_min', str(self.frames_per_sec * 2),
            '-vf', 'scale={}:force_original_aspect_ratio=decrease'.format(self.resolution),
            '-b:v', str(self.video_bitrate) + 'k',
            '-maxrate', str(self.video_bitrate) + 'k',
            '-f', 'hls',
            '-hls_time', '2',
            '-hls_playlist_type', 'vod',
            '-hls_list_size', '0',
            '-hls_segment_filename', self.segments_folder + '/' + 'seg_%05d.ts',
            str(self.m3u8_file)
        ]
        subprocess.call(cmd)
        print('generated m3u8 playlist for ', self.file_path, 'at ', self.m3u8_file)

    def generate_scenes_file(self, duration):
        scenes_file = os.path.join(self.video_nft_folder, 'scenes.json')
        scenes = self._get_scene_cuts()
        self._save_scenecuts(scenes, scenes_file, duration)

    def generate_thumbnails(self):
        try:
            thumbnails_folder = os.path.join(self.video_nft_folder, 'thumbnails')
            if not os.path.exists(thumbnails_folder):
                os.makedirs(thumbnails_folder)
            thumbnail_file_h = os.path.join(thumbnails_folder, self.key['_id'] + '_horizontal.jpg')
            _, duration = info(self.file_path)
            cmd_h = ['ffmpeg', '-y',
                     '-hide_banner', '-v', 'error',
                     '-i', self.file_path,
                     '-ss', str(random.choice(range(int(duration) % 100))),
                     '-vframes', '1',
                     '-s', f'{self.width}x{self.height}',
                     thumbnail_file_h,
                     ]
            print(' '.join(cmd_h))
            subprocess.check_call(cmd_h)
            thumbnail_file_v = os.path.join(thumbnails_folder, self.key['_id'] + '_vertical.jpg')
            cmd_v = ['ffmpeg', '-y',
                     '-hide_banner', '-v', 'error',
                     '-i', self.file_path,
                     '-ss', str(random.choice(range(int(duration) % 100))),
                     '-vframes', '1',
                     '-s', f'{self.height}x{self.width}',
                     thumbnail_file_v,
                     ]
            subprocess.check_call(cmd_v)
            thumbnail_file_s = os.path.join(thumbnails_folder, self.key['_id'] + '_square.jpg')
            cmd_s = ['ffmpeg', '-y',
                     '-hide_banner', '-v', 'error',
                     '-i', self.file_path,
                     '-ss', str(random.choice(range(int(duration) % 100))),
                     '-vframes', '1',
                     '-s', f'{self.height}x{self.height}',
                     thumbnail_file_s,
                     ]
            subprocess.check_call(cmd_s)
            thumbnails = {
                'horizontal': thumbnail_file_h,
                'vertical': thumbnail_file_v,
                'square': thumbnail_file_s,
            }
            print('generated thumbnail : ', thumbnails)
            return thumbnails
        except Exception as e:
            print(e)
            return None

    @staticmethod
    def _get_segments(chapters):
        segments = []
        start = 0
        for i in range(len(chapters)):
            segments.append({
                "startAt": start,
                "endAt": chapters[i]
            })
            start = chapters[i]
        return segments

    def encode(self):
        try:
            self.hooks['in_progress'](self.key)
            shutil.rmtree(self.video_nft_folder, ignore_errors=True)
            os.makedirs(self.video_nft_folder)
            scenes_file = os.path.join(self.video_nft_folder, 'scenes.json')
            scenes = self._get_scene_cuts()
            _, duration = info(self.file_path)
            self._save_scenecuts(scenes, scenes_file, duration)
            chapters = self._generate_chapters(scenes)

            if len(chapters) == 0 or (len(chapters) and duration - chapters[-1] >= 3):
                chapters.append(duration)

            chapters_file = os.path.join(self.video_nft_folder, 'chapters.json')
            with open(chapters_file, 'w', encoding='utf-8') as file:
                json.dump(chapters, file, ensure_ascii=False, indent=4)
            segments = self._get_segments(chapters)
            meta = {
                'assetID': self.key['_id'],
                'duration': duration,
                'file': self.file_path,
                'fps': self.frames_per_sec,
                'inMins': round(duration / 60, 2),
                'type': 'video',
                'width': self.resolution.split('x')[0],
                'height': self.resolution.split('x')[1]
            }
            vf = 'scale={0}:{1},setsar=1'.format(self.width, self.height)
            i_width, i_height = get_resolution(self.file_path)
            if i_width != None and i_width == i_height:
                vf_scale = 'scale={0}:{0}'.format(self.height)
                vf_pad = 'pad={0}:{1}:-{1}/2:0'.format(self.width, self.height)
                vf = '{0},{1}'.format(vf_scale, vf_pad)

            elif i_width != None and i_width < i_height:
                if self.width > i_width:
                    vf_scale = 'scale={0}:{1}'.format(i_width, self.height)
                    vf_pad = 'pad={0}:{1}:-{2}/2:50'.format(self.width, self.height, self.width - i_width)
                    vf = '{0},{1}'.format(vf_scale, vf_pad)
                else:
                    vf_scale = 'scale={0}:{1}'.format(i_width, self.height)
                    vf_crop = 'crop={0}:{1}:{2}/2:50'.format(self.width, self.height, (i_width - self.width) / 2)
                    vf = '{0},{1}'.format(vf_scale, vf_crop)
            print('vf', vf)
            meta_file = os.path.join(self.video_nft_folder, '{0}.json'.format(self.key['_id']))
            with open(meta_file, 'w', encoding='utf-8') as file:
                json.dump(meta, file, ensure_ascii=False, indent=4)

            if not os.path.exists(self.segments_folder):
                os.makedirs(self.segments_folder)

            resolutions = {
                "720p": {"width": 1280, "height": 720, "bitrate": 3000},
                "1080p": {"width": 1920, "height": 1080, "bitrate": 5000},
            }

            master_playlist_content = "#EXTM3U\n"

            for resolution, config in resolutions.items():
                resolution_folder = os.path.join(self.segments_folder, resolution)
                os.makedirs(resolution_folder, exist_ok=True)

                vf = f"scale={config['width']}:{config['height']}"
                output_m3u8 = f"{resolution_folder}/master.m3u8"
                segment_filename = f"{resolution_folder}/seg_%05d.ts"

                encode_cmd = [
                    'ffmpeg',
                    '-hide_banner', '-v', 'error',
                    '-f', 'lavfi', '-i', 'aevalsrc=0',
                    '-i', self.file_path,
                    '-vf', vf,
                    '-vcodec', self.video_codec,
                    '-r', str(self.frames_per_sec),
                    '-g', str(self.frames_per_sec * 2),
                    '-crf', '22',
                    '-preset', self.preset,
                    '-keyint_min', str(self.frames_per_sec * 2),
                    '-maxrate', str(config['bitrate']) + 'k',
                    '-b:v', str(config['bitrate']) + 'k',
                    '-acodec', self.audio_codec,
                    '-ar', '44100',
                    '-ac', '2',
                    '-b:a', str(self.audio_bitrate) + 'k',
                    '-shortest',
                    '-f', 'hls',
                    '-hls_time', '4',
                    '-hls_playlist_type', 'vod',
                    '-hls_list_size', '0',
                    '-hls_segment_filename', segment_filename,
                    '-tune', 'fastdecode',
                    '-tune', 'zerolatency',
                    '-max_muxing_queue_size', '1024',
                    '-max_interleave_delta', '0',
                    '-reset_timestamps', '1',
                    '-async', '1',
                    '-y', output_m3u8
                ]

                print(' '.join(encode_cmd))
                subprocess.check_call(encode_cmd)

                master_playlist_content += f"#EXT-X-STREAM-INF:BANDWIDTH={config['bitrate']*1000},RESOLUTION={config['width']}x{config['height']}\n"
                master_playlist_content += f"{resolution}/master.m3u8\n"

            master_playlist_content += "#EXT-X-ENDLIST\n"
            master_playlist_path = os.path.join(self.segments_folder, "master.m3u8")
            with open(master_playlist_path, "w") as master_playlist:
                master_playlist.write(master_playlist_content)
            
            lower_resolution_file_path = os.path.join(self.segments_folder, "720p/master.m3u8")
            if not is_valid_encode(self.file_path, lower_resolution_file_path) or not self._check_m3u8():
                print('not a valid encode, re-encoding file')
                subprocess.check_call(encode_cmd)
            
            path_parts = self.m3u8_file.split('media-node-data/assets/')
            if len(path_parts) > 1:
                m3u8_file_path = '/assets/' + path_parts[1]
            else:
                m3u8_file_path = self.m3u8_file
                
            self.hooks['complete'](self.key, segments, m3u8_file_path)
            return self.segments_folder
        except Exception as e:
            print(e)
            self.hooks['error'](self.key)
    
    def encode_default_stream(self):
        try:
            if not os.path.exists(self.segments_folder):
                os.makedirs(self.segments_folder)

            vf = 'scale={0}:{1},setsar=1'.format(self.width, self.height)

            encode_cmd = [
                'ffmpeg',
                '-hide_banner', '-v', 'error',
                '-f', 'lavfi', '-i', 'aevalsrc=0',
                '-i', self.file_path,
                '-vf', vf,
                '-vcodec', self.video_codec,
                '-r', str(self.frames_per_sec),
                '-g', str(self.frames_per_sec * 2),
                '-crf', '22',
                '-preset', self.preset,
                '-keyint_min', str(self.frames_per_sec * 2),
                '-maxrate', str(self.video_bitrate) + 'k',
                '-b:v', str(self.video_bitrate) + 'k',
                '-acodec', self.audio_codec,
                '-ar', '44100',
                '-ac', '2',
                '-b:a', str(self.audio_bitrate) + 'k',
                '-shortest',
                '-f', 'mp4',
                '-movflags', '+faststart',
                '-tune', 'fastdecode',
                '-tune', 'zerolatency',
                '-max_muxing_queue_size', '1024',
                '-max_interleave_delta', '0',
                '-reset_timestamps', '1',
                '-async', '1',
                '-y', str(self.mp4_file)
            ]
            print(' '.join(encode_cmd))
            subprocess.check_call(encode_cmd)
            if not is_valid_encode(self.file_path, self.mp4_file):
                print('not a valid encode, re-encoding file')
                subprocess.check_call(encode_cmd)
            return self.mp4_file
        except Exception as e:
            print(e)
    
