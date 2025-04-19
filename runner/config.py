# coding: utf-8
import os

# Backend config
API_ACCESS_TOKEN = os.getenv('API_ACCESS_TOKEN') or ''
API_URL = os.getenv('BACKEND_API_URL') or ''

# Runner config
ID = os.getenv('RUNNER_ID') or ''
TOKEN = os.getenv('RUNNER_TOKEN') or ''
ROOT_DIRECTORY = os.getenv('ROOT_DIR') or os.path.expanduser('~')
STREAM_ROOT_DIRECTORY = os.getenv('STREAM_ROOT_DIR') or '/home/ubuntu/media-node-data'
STREAM_CONFIG_FILE = os.getenv('STREAM_CONFIG_FILE') or '/home/ubuntu/streamer/config.json'
LIVE_TEXT_FILE = os.getenv('LIVE_TEXT_FILE') or '/home/ubuntu/media-node-data/live_stream_text_scroll.txt'
TIME_ZONE = os.getenv('TIME_ZONE') or 'UTC'

# disk config
DISK_PATH = '/'
MAX_STORAGE_LIMIT_PERCENTAGE = os.getenv('MAX_STORAGE_LIMIT_PERCENTAGE') or 90
MAX_CPU_LIMIT_PERCENTAGE = os.getenv('MAX_CPU_LIMIT_PERCENTAGE') or 90
MAX_RAM_LIMIT_PERCENTAGE = os.getenv('MAX_RAM_LIMIT_PERCENTAGE') or 90

# twitter config
TWITTER_CONSUMER_API_KEY = os.getenv('TWITTER_CONSUMER_API_KEY') or ''
TWITTER_CONSUMER_API_SECRET_KEY = os.getenv('TWITTER_CONSUMER_API_SECRET_KEY') or ''
TWITTER_ACCESS_TOKEN = os.getenv('TWITTER_ACCESS_TOKEN') or ''
TWITTER_ACCESS_TOKEN_SECRET = os.getenv('TWITTER_ACCESS_TOKEN_SECRET') or ''


# ipfs api config
IPFS_API_HOST = os.getenv('IPFS_API_HOST') or '127.0.0.1'
IPFS_API_PORT = os.getenv('IPFS_API_PORT') or 5001

# Redis Queue config
REDIS_HOST = os.getenv('REDIS_HOST') or '127.0.0.1'
REDIS_PORT = os.getenv('REDIS_PORT') or 6379

# supported file formats
ALLOWED_FILE_EXTENSIONS = {'mp4', 'mov', 'webm', 'mp3', 'm4a', 'wav', 'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_FILE_FORMATS = ['video', 'audio', 'image', 'raster-image', 'raw-image', 'document', 'vector-image']
MAX_FILE_UPLOAD_SIZE = os.getenv('MAX_FILE_UPLOAD_SIZE') or 500 * 1024 * 1024