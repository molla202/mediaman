# coding: utf-8
from tweepy import OAuthHandler, API
import os
import urllib
import shutil
import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from ..config import TWITTER_CONSUMER_API_KEY, TWITTER_CONSUMER_API_SECRET_KEY, TWITTER_ACCESS_TOKEN, \
    TWITTER_ACCESS_TOKEN_SECRET

directory = '/'.join(__file__.split('/')[:-1])

BACKGROUND_VIDEO = directory + '/assets/Background_Videos/BG2.mp4'
TWITTER_BG = directory + '/assets/Background_Layouts/TWITTER_BG_BIG.mov'
TWITTER_BUG_BG = directory + '/assets/Background_Videos/ALPHA.mov'
DEFAULT_PROFILE = directory + '/assets/defaults/default_profile.jpg'
VERIFIED_SYMBOL = directory + '/assets/Background_Images/twitter_verified.png'

FONT_FAMILY = 'Lemonada'
BOLD_FONT = directory + '/assets/fonts/Lemonada/static/Lemonada-Bold.ttf'
REGULAR_FONT = directory + '/assets/fonts/Lemonada/static/Lemonada-Regular.ttf'

TWEET_LINE_LENGTH = 70
TWEET_VIDEO_DURATION = 10

TWITTER_BG_LAYOUT_POSITION = 'x=0:y=0'
PROFILE_PIC_POSITION = 'x=341:y=183'
ACC_NAME_POSITION = 'x=427:y=193'
SCREEN_NAME_POSITION = 'x=425:y=224'
TWEET_TEXT_X_POSITION = 343
TWEET_TEXT_Y_POSITION = 287
TWEET_TIME_POSITION = 'x=341:y=800'

PROFILE_PIC_TIME = 'enable=\'between(t\,1.3,10)\''
ACC_NAME_TIME = 'enable=\'between(t\,1.4,10)\''
SCREEN_NAME_TIME = 'enable=\'between(t\,1.5,10)\''
TWEET_TEXT_START_TIME = 1.6
TWEET_TIME_TIME = 'enable=\'between(t\,2,10)\''
try:
    auth = OAuthHandler(TWITTER_CONSUMER_API_KEY, TWITTER_CONSUMER_API_SECRET_KEY)
    auth.set_access_token(TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET)
    api = API(auth)
    print('oAuth success')
except Exception as e:
    print("Error: Twiiter Auth -- ", e.args)


class Twitter:
    def __init__(self, tweet_id, key, hooks, destination):
        self.key = key
        self.destination = destination
        self.hooks = hooks
        self.tweet_id = tweet_id
        self.tweet = api.get_status(tweet_id, tweet_mode='extended')
        self.name = 'tweet_{0}_{1}'.format(self.tweet.author.screen_name, tweet_id)
        self.tweet_temp_folder = '/tmp/{0}'.format(tweet_id)
        if not os.path.exists(self.tweet_temp_folder):
            os.makedirs(self.tweet_temp_folder)
        self.tweet_file = '{0}/tweet_{1}.txt'.format(self.tweet_temp_folder, tweet_id)

    def save_tweet_to_file(self, line_len):
        if not len(self.tweet.full_text):
            return
        lines = self.tweet.full_text.split('\n')
        lines[-1] = ' '.join(
            lines[-1].split(' ')[:-1]) if 'media' in self.tweet.entities and self.is_url(
            lines[-1].split(' ')[-1]) else lines[-1]
        with open(self.tweet_file, 'w') as tf:
            for line in lines:
                line = line.replace('&amp;', '&')
                line = line.replace('►', ' ')
                if len(line) >= line_len:
                    ln = ''
                    for word in line.split(' '):
                        if len(ln + ' ' + word) > line_len:
                            tf.write(ln + '\n')
                            ln = word
                        else:
                            ln = ln + ' ' + word
                    if len(ln):
                        tf.write(ln + '\n')
                else:
                    tf.write(line + '\n')

    def download_profile_image(self):
        profile_image_url = self.tweet.user.profile_image_url.replace('_normal', '')
        profile_image_file = '{0}/{1}'.format(self.tweet_temp_folder, profile_image_url.split('/')[-1])
        if os.path.exists(profile_image_file):
            return profile_image_file
        try:
            urllib.request.urlretrieve(profile_image_url, profile_image_file)
            return profile_image_file
        except:
            return DEFAULT_PROFILE

    def download_media_files(self):
        try:
            media = self.tweet.extended_entities['media']
            count = 0
            media_files = []
            for image in media:
                media_url = image['media_url']
                if not os.path.exists(self.tweet_temp_folder):
                    os.makedirs(self.tweet_temp_folder)
                file_path = os.path.join(self.tweet_temp_folder, '{}_pic{}.jpg'.format(self.tweet_id, count))
                try:
                    urllib.request.urlretrieve(media_url, file_path)
                    im = Image.open(file_path)
                    im = self.add_corners(im, 40)
                    im.save(file_path.replace('jpg', 'png'))
                    media_files.append(file_path.replace('jpg', 'png'))
                    count += 1
                except:
                    continue
            return media_files
        except:
            return []

    @staticmethod
    def convert_to_circular_image(image):
        img = Image.open(image).convert('RGB')
        npImage = np.array(img)
        h, w = img.size
        alpha = Image.new('L', img.size, 0)
        draw = ImageDraw.Draw(alpha)
        draw.pieslice([0, 0, h, w], 0, 360, fill=255)
        npAlpha = np.array(alpha)
        npImage = np.dstack((npImage, npAlpha))
        out_img = ''.join(image.split('.')[:-1]) + '.png'
        Image.fromarray(npImage).save(out_img)
        return out_img

    @staticmethod
    def add_corners(im, rad):
        circle = Image.new('L', (rad * 2, rad * 2), 0)
        draw = ImageDraw.Draw(circle)
        draw.ellipse((0, 0, rad * 2, rad * 2), fill=255)
        alpha = Image.new('L', im.size, 255)
        w, h = im.size
        alpha.paste(circle.crop((0, 0, rad, rad)), (0, 0))
        alpha.paste(circle.crop((0, rad, rad, rad * 2)), (0, h - rad))
        alpha.paste(circle.crop((rad, 0, rad * 2, rad)), (w - rad, 0))
        alpha.paste(circle.crop((rad, rad, rad * 2, rad * 2)), (w - rad, h - rad))
        im.putalpha(alpha)
        return im

    @staticmethod
    def is_url(word):
        return word.startswith('http://') or word.startswith('https://')

    @staticmethod
    def is_tag(word):
        return len(word) > 1 and word.startswith('#')

    @staticmethod
    def is_mention(word):
        return len(word) > 1 and (word.startswith('@') or word.startswith('$'))

    def get_display_url(self, url):
        url = url.replace('\n', '')
        if 'urls' in self.tweet.entities:
            for t_url in self.tweet.entities['urls']:
                if t_url['url'] == url:
                    return t_url['display_url']
        print(url)
        return url

    def get_tweet_text_filter(self, x, y):
        with open(self.tweet_file, 'r') as tf:
            tweet_lines = tf.readlines()
        filters = []
        tweet_text_size = 26
        if len(tweet_lines) > 10 and len(tweet_lines) < 13:
            tweet_text_size = 24
        elif len(tweet_lines) >= 13 and len(tweet_lines) < 15:
            tweet_text_size = 20
        elif len(tweet_lines) >= 15 and len(tweet_lines) < 17:
            tweet_text_size = 16
        elif len(tweet_lines) >= 17:
            tweet_text_size = 12

        if 2 < len(tweet_lines) < 10:
            y += (5 * self.get_line_height('@', tweet_text_size) - (len(tweet_lines) / 2) * self.get_line_height('@',
                                                                                                                 tweet_text_size))
        original_x = x
        start_time = TWEET_TEXT_START_TIME
        for line in tweet_lines:
            line_length = 0
            x = original_x
            for word in line.split(' '):
                color = 'black'
                word = ''.join([char for char in word if ord(char) < 6000])
                font_file = REGULAR_FONT
                if not len(word):
                    continue

                if self.is_tag(word) or self.is_mention(word) or self.is_url(word):
                    color = 'blue'
                if self.is_url(word):
                    word = self.get_display_url(word)

                y_pos = y
                if self.issmall(word) or self.isfall(word):
                    y_pos += 6
                    if 't' in word:
                        y_pos -= 2
                if word == '-':
                    y_pos += 8
                if word == ',' or word == '.':
                    y_pos += 16

                _filter = 'drawtext=fontfile={0}:fontcolor={1}:fontsize={6}:box=1:text=\'{2}\':x={3}:y={4}:expansion=none:enable=\'between(t,{5},10)\''.format(
                    font_file, color, word.replace(':', '\\:').replace("'", '’'), x, y_pos, start_time, tweet_text_size)
                line_length += len(word) + 1
                start_time += 0.1
                x += self.get_text_width(word, tweet_text_size)
                filters.append(_filter)
            y += self.get_line_height(line, tweet_text_size)
        return ','.join(filters)

    @staticmethod
    def get_text_width(word, size):
        font = ImageFont.truetype(REGULAR_FONT, size)
        width, height = font.getsize(word + ' ')
        return width

    @staticmethod
    def get_line_height(line, size):
        font = ImageFont.truetype(REGULAR_FONT, size)
        width, height = font.getsize(line)
        return height + 5

    @staticmethod
    def issmall(word):
        for char in word:
            if char in 'acemnorsuvwxzt:-+.\,\n\t':
                continue
            else:
                return False
        return True

    @staticmethod
    def isfall(word):
        for char in word:
            if char in 'ygqpgacemnorsuvwxz:+-\.,\n\t':
                continue
            else:
                return False
        return True

    @staticmethod
    def get_image_resolution(image):
        im = Image.open(image)
        width, height = im.size
        return width, height

    def get_image_overlays_filter(self, images, index, tweet_lines_len):
        if not len(images):
            return ''

        input_filter = ''
        overlay_filter = ''
        x = 1000
        y = 350
        w = 550
        h = 350
        if tweet_lines_len < 3:
            x = 350
            y = 370
            w = 711
            h = 400
        st = 2
        img_dur = 10 / len(images)
        for image in images:
            width, height = self.get_image_resolution(image)
            if height > width:
                y = 250
                x = 1100
                w = 370
                h = 540
                if tweet_lines_len < 2:
                    y = 360
                    x = 350
                    w = 320
                    h = 426

            elif height == width or width - height < 20:
                y = 300
                x = 1050
                w = 400
                h = 400
                if tweet_lines_len < 2:
                    y = 320
                    x = 350
                    w = 450
                    h = 450
            input_filter += ';[{0}:v]scale={1}x{2},setpts=N/FRAME_RATE/TB,loop=-1:24*{3}[ovr{0}]'.format(
                index, w, h, TWEET_VIDEO_DURATION)
            overlay_filter += ';[out][ovr{0}]overlay=x={3}:y={4}:enable=\'between(t, {1}, {2})\'[out]'.format(
                index, st, st + img_dur, x, y)
            st += img_dur
            index += 1
        return input_filter + overlay_filter

    def get_verified_user_overlay_filter(self, index):
        x = 437 + self.get_text_width(self.tweet.user.name, 28)
        y = 186
        _filter = ';[{0}:v]scale=32:32[ovr{0}];[out][ovr{0}]overlay=x={3}:y={4}:enable=\'between(t, {1}, {2})\'[out]'.format(
            index, 1.4, 10, x, y)
        return _filter

    def generate_tweet_video(self, is_thread=False):
        if not is_thread:
            self.hooks['in_progress'](self.key)
        line_len = TWEET_LINE_LENGTH

        if 'media' in self.tweet.entities:
            line_len = TWEET_LINE_LENGTH - 30
        self.save_tweet_to_file(line_len)
        with open(self.tweet_file, 'r') as tf:
            tweet_lines = tf.readlines()
        profile_image = self.download_profile_image()
        profile_image = self.convert_to_circular_image(profile_image)

        account_name = ''.join([char for char in self.tweet.author.name if ord(char) < 6000])
        screen_name = '@' + self.tweet.author.screen_name
        tweet_time = self.tweet.created_at.strftime('%H:%M (UTC) - %b %d, %Y')

        if not os.path.isdir(self.destination):
            os.makedirs(self.destination)
        filename = 'tweet_{}_{}.mp4'.format(screen_name, self.tweet_id)
        out_file = os.path.join(self.destination, filename)

        intial_cmd = ['ffmpeg', '-y', '-hide_banner', '-v', 'error']

        input_files = [
            '-i', BACKGROUND_VIDEO,
            '-i', TWITTER_BG,
            '-i', profile_image
        ]

        filter_complex = "[2:v]scale=75:75[profileImage];[1:v]scale=1920x1080,setsar=1[layout];[layout][profileImage]overlay=" + \
                         PROFILE_PIC_POSITION + ":" + PROFILE_PIC_TIME + "[twit];[twit]drawtext=fontfile=" + \
                         BOLD_FONT + ":fontcolor=black:fontsize=28:text='" + \
                         valid_text(
                             account_name) + "':" + ACC_NAME_POSITION + ":" + ACC_NAME_TIME + ":expansion=none, drawtext=fontfile=" + \
                         REGULAR_FONT + ":fontcolor=#989898:fontsize=20:text='" + \
                         valid_text(screen_name) + "':" + SCREEN_NAME_POSITION + ":" + SCREEN_NAME_TIME + \
                         ":expansion=none[tweet];[0:v]scale=1920x1080,setsar=1[bg];[bg][tweet]overlay=0:0[out];[out]" + \
                         self.get_tweet_text_filter(TWEET_TEXT_X_POSITION, TWEET_TEXT_Y_POSITION) + \
                         ", drawtext=fontfile=" + \
                         REGULAR_FONT + ":fontcolor=#505050:fontsize=20:text='" + \
                         tweet_time.replace(':',
                                            '\\:') + "':" + TWEET_TIME_POSITION + ":" + TWEET_TIME_TIME + ":expansion=none[out]"

        index = int(len(input_files) / 2)
        media_files = self.download_media_files()
        for image in media_files:
            input_files.extend(['-i', image])

        overlays_filter = self.get_image_overlays_filter(media_files, index, len(tweet_lines))
        filter_complex += overlays_filter
        if self.tweet.user.verified:
            input_index = int(len(input_files) / 2)
            input_files.extend(['-i', VERIFIED_SYMBOL])
            verified_filter = self.get_verified_user_overlay_filter(input_index)
            filter_complex += verified_filter

        cmd = intial_cmd + input_files + [
            '-filter_complex', filter_complex,
            '-map', '[out]',
            '-c:v', 'h264',
            '-profile:v', 'high',
            '-s', '1280x720',
            '-r', '30',
            '-g', '60',
            '-crf', '22',
            '-b:v', '4000k',
            '-t', '10',
            str(out_file)
        ]

        proc = subprocess.call(cmd)
        if not is_thread:
            print('Successfully generated tweet video & saved at ', out_file)
            self.hooks['complete'](self.key, out_file)
            shutil.rmtree(self.tweet_temp_folder)
        return out_file


def generate_tweet_thread_video(tvg, encode=True):
    if tvg.tweet.in_reply_to_status_id_str:
        tweets = []
        last_tweet = tvg.tweet
        tweets.append(last_tweet)
        print('Retrieving tweets ...')
        while True:
            prev_tweet = api.get_status(last_tweet.in_reply_to_status_id_str, tweet_mode='extended')
            last_tweet = prev_tweet
            tweets.append(last_tweet)
            if not last_tweet.in_reply_to_status_id_str:
                break
        filter_complex = []
        input_files = []
        tvg.hooks['in_progress'](tvg.key)
        temp_paths = []
        for tweet in tweets[::-1]:
            destination = '/tmp/{}'.format(tweet.id)
            temp_paths.append(destination)
            twe = Twitter(tweet.id, tvg.key, tvg.hooks, destination)
            out_video_file = twe.generate_tweet_video(is_thread=True)
            input_files.extend(['-i', out_video_file])
        cmd = [
            'ffmpeg', '-y',
            '-hide_banner', '-v', 'error',
        ]
        input_filter_str = ''
        concat_filter = ''
        for i in range(len(tweets)):
            input_filter_str += '[{0}:v]scale={1},setsar=1[{0}v];'.format(
                i, '1280x720')
            concat_filter += '[{0}v]'.format(i)
        if concat_filter:
            concat_filter += 'concat=n={0}:v=1:a=0[outv]'.format(len(tweets))

        if input_filter_str and concat_filter:
            filter_complex.append(input_filter_str + concat_filter)
        filter_complex_str = ';'.join(filter_complex)

        if not os.path.exists(tvg.destination):
            os.makedirs(tvg.destination)
        out_file = os.path.join(tvg.destination,
                                'tweet_thread_@{}_{}.mp4'.format(tvg.tweet.user.screen_name, tvg.tweet_id))

        cmd = cmd + input_files + [
            '-filter_complex', filter_complex_str,
            '-map', '[outv]',
            '-c:v', 'h264',
            '-profile:v', 'high',
            '-s', '1280x720',
            '-r', '30',
            '-g', '60',
            '-crf', '22',
            '-b:v', '4000k',
            '-to', str(len(tweets) * 10),
            out_file
        ]
        subprocess.call(cmd)
        print('tweet video generated successfully & saved at', out_file)
        tvg.hooks['complete'](tvg.key, out_file, encode=encode)
        for dir_path in temp_paths:
            shutil.rmtree(dir_path)

    else:
        tvg.generate_tweet_video(encode=encode)


def valid_text(name):
    spl_characters = ["'", ':', '%', ',']

    text = ''
    for char in name:
        if char == '\'':
            text += '\\"'
        elif char in spl_characters:
            text += '\\' + char
        else:
            text += char
    return text
