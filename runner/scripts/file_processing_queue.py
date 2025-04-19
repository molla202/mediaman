# coding: utf-8
import queue
import time
from ..hooks import studio

MAX_QUEUE_SIZE = 2000
file_process_queue = queue.Queue(maxsize=MAX_QUEUE_SIZE)


def add_file_to_process_queue(file_obj):
    unfinished_tasks = file_process_queue.unfinished_tasks
    print('unfinished tasks', unfinished_tasks)
    if unfinished_tasks >= MAX_QUEUE_SIZE:
        return 'Maximum queue size limit reached, Please add after some time.', None
    file_process_queue.put(file_obj)

    return None, unfinished_tasks


def file_process():
    try:
        print('[FP] Starting file upload process')
        while True:
            if file_process_queue.empty():
                time.sleep(10)
                continue

            file_obj = file_process_queue.get()
            try:
                print('started processing file')
                studio.upload_complete_hook(file_obj['file_path'], file_obj['user_id'])
                file_process_queue.task_done()
                print('task done')
            except Exception as e:
                print('[FP] - unable to process file', e.args)
                file_process_queue.task_done()
    except RuntimeError:
        print("file processing stopped ...")
    except KeyboardInterrupt:
        print("file processing stopped ...")
    except Exception:
        print("Something went wrong")