# coding: utf-8
import queue
import time
from ..config import DISK_PATH, MAX_STORAGE_LIMIT_PERCENTAGE
from ..utils.file import get_disk_usage

MAX_QUEUE_SIZE = 50
tweet_video_generation_queue = queue.Queue(maxsize=MAX_QUEUE_SIZE)


def add_tweet_to_tweet_video_generation_queue(video):
    unfinished_tasks = tweet_video_generation_queue.unfinished_tasks
    print('unfinished tasks', unfinished_tasks)
    if unfinished_tasks >= MAX_QUEUE_SIZE:
        return 'Maximum queue size limit reached, Please add after some time.', None
    tweet_video_generation_queue.put(video)

    return None, unfinished_tasks


def tweet_video_generation_process():
    try:
        print('[TVG] Starting tweet video generation process')
        while True:
            if tweet_video_generation_queue.empty():
                time.sleep(2)
                continue

            tweet = tweet_video_generation_queue.get()
            try:
                disk_usage = get_disk_usage(DISK_PATH)
                print('disk usage', disk_usage)
                if disk_usage and disk_usage > MAX_STORAGE_LIMIT_PERCENTAGE:
                    print('[TVG] - disk usage is more than threshold limit .. '
                          'please increase disk size .. waiting(5 Min) ...')
                    time.sleep(300)
                    tweet_video_generation_queue.put(tweet)
                else:
                    print('started generating video')
                    tweet.generate_tweet_video()
                    tweet_video_generation_queue.task_done()
                    print('task done')
            except Exception as e:
                print('[TVG] - unable to generate video', e.args)
                tweet_video_generation_queue.task_done()
    except RuntimeError:
        print("Tweet video generating process stopped ...")
    except KeyboardInterrupt:
        print("Tweet video generating process stopped ...")
    except Exception:
        print("Something went wrong")
