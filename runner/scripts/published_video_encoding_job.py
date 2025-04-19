import time


def get_published_videos_to_encode():
    pass


def update_hls_hash_to_video():
    pass


def get_published_videos_and_encode():
    pass


def video_encoding_process():
    try:
        print('[FP] Starting hls video encoding process')
        while True:
            get_published_videos_and_encode()
            time.sleep(30)

    except RuntimeError:
        print("hls video encoding stopped ...")
    except KeyboardInterrupt:
        print("hls video encoding stopped ...")
    except Exception as e:
        print("Something went wrong", e)