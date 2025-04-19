# coding: utf-8
import json
import shlex
import subprocess


def info(path):
    args = 'ffprobe -v quiet \
                -print_format json \
                -show_entries format=duration,size'
    args = shlex.split(args)
    args.append(path)
    try:
        output = subprocess.check_output(args).decode('utf-8')
        output = json.loads(output)

        return int(output['format']['size']), float(output['format']['duration'])
    except subprocess.CalledProcessError:
        return 0, 0
    except Exception as e:
        return 0, 0


def get_resolution(path):
    args = 'ffprobe -v quiet \
                -print_format json \
                -show_entries stream=width,height'
    args = shlex.split(args)
    args.append(path)
    try:
        output = subprocess.check_output(args).decode('utf-8')
        output = json.loads(output)
        if len(output['streams']):
            for stream in output['streams']:
                if 'width' in stream:
                    return int(stream['width']), int(stream['height'])
        return None, None

    except subprocess.CalledProcessError:
        return None, None

    except Exception as e:
        return None, None