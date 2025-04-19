from _thread import start_new_thread
from .tweet_video_generation_queue import tweet_video_generation_process, add_tweet_to_tweet_video_generation_queue
from .file_processing_queue import file_process, add_file_to_process_queue


def init_scripts():
    pass
    #start_new_thread(tweet_video_generation_process, ())
    #start_new_thread(file_process, ())