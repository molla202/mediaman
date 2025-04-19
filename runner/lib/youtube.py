# coding: utf-8
import os

import yt_dlp as youtube_dl

from ..logger import NoLogger


class YouTube:
    def __init__(self, key, destination, video_id, hooks):
        self.key = key
        self.destination = destination
        self.hooks = hooks
        self.name = ''

        self.downloading = False
        self.url = 'https://www.youtube.com/watch?v={0}'.format(video_id)
        self.ext = 'mp4'
        self.ydl = youtube_dl.YoutubeDL({
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
        })

    def progress(self, obj):
        if obj['status'] == 'error':
            self.hooks['error'](self.key)
        if not self.downloading and obj['status'] == 'downloading':
            self.downloading = True
            self.hooks['in_progress'](self.key)

    def info(self):
        try:
            return self.ydl.extract_info(self.url, False)
        except Exception as e:
            print(e)

    def download(self):
        try:
            info = self.info()
            self.name = info['title'].strip()
            self.ext = info['ext'].strip()
            for ch in ['#', ' - ', '/', ' | ', ' (', ') ', ': ', '  ', ' ', '-', ':', '(', ')', '|']:
                self.name = self.name.replace(ch, '_')
            self.name = self.name.replace('"', '').replace('\'', '')
            self.name = '{0}.{1}'.format(self.name, self.ext)
            self.ydl = youtube_dl.YoutubeDL({
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                'logger': NoLogger(),
                'progress_hooks': [self.progress],
                'noplaylist': True,
                'outtmpl': os.path.join(self.destination, self.name),
                'merge_output_format': self.ext
            })
            if not os.path.isdir(self.destination):
                os.makedirs(self.destination)
            self.ydl.download([self.url])
            print(self.destination, self.name, self.key)
            self.hooks['complete'](self.key, self.destination, self.name)

        except Exception as e:
            print(e)
            self.hooks['error'](self.key)
