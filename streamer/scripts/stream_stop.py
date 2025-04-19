import json
import sys
import requests
import os
import shutil

USERNAME = sys.argv[1]
SCRIPT_TOKEN = sys.argv[2]
PLAYBACK_ID = sys.argv[3]
BROADCAST_KEY = sys.argv[4]
USER_ID = sys.argv[5]

if USERNAME == "main":
    USERNAME = "ubuntu"

CONFIG_FILE = f'/home/{USERNAME}/streamer/config.json'
if __name__ == '__main__':
    with open('/home/ubuntu/update_config.log', 'a') as log_file:
        log_file.write(f'USERNAME: {USERNAME} SCRIPT_TOKEN: {SCRIPT_TOKEN} PLAYBACK_ID: {PLAYBACK_ID} BROADCAST_KEY: {BROADCAST_KEY} USER_ID: {USER_ID}\n')

    with open(CONFIG_FILE, 'r') as conf_file:
        stream_config = json.loads(conf_file.read())

    studio_url = stream_config['backend_url']
    runner_url = stream_config['runner_url']

    stream_config['playing_live_feed'] = False

    with open(CONFIG_FILE, 'w') as conf_file:
        json.dump(stream_config, conf_file, indent=4)

    print("Stopping live feed")

    try:
        requests.put(f'{studio_url}/live-streams/stop-stream/{USERNAME}', json={'token': SCRIPT_TOKEN, 'playback_id': PLAYBACK_ID, 'broadcast_key': BROADCAST_KEY}, timeout=10)

        response = requests.get(f'{studio_url}/runner/users/{USER_ID}/get-id', timeout=10)
        with open('/home/ubuntu/update_config.log', 'a') as log_file:
            log_file.write(f'response: {response.json()}\n')
        if response.status_code == 200:
            data = response.json()
            userid = data.get('result')
        
        
        response = requests.post(f'{studio_url}/script/assets', json={'token': SCRIPT_TOKEN, 'type': 'video', 'name': PLAYBACK_ID, 'user_id': userid}, timeout=10)
        if response.status_code == 200:
            with open('/home/ubuntu/update_config.log', 'a') as log_file:
                log_file.write(f'response: {response.json()}\n')
            data = response.json()
            result = data.get('result')
            asset_id = result.get('_id')

        source_dir = f'/mnt/livestream-recordings/{PLAYBACK_ID}'
        destination_dir = f'/home/{USERNAME}/media-node-data/assets/{asset_id}'

        if not os.path.exists(destination_dir):
            os.makedirs(destination_dir)

        for filename in os.listdir(source_dir):
            file_path = os.path.join(source_dir, filename)
            if os.path.isfile(file_path):
                shutil.copy(file_path, destination_dir)
            elif os.path.isdir(file_path):
                shutil.copytree(file_path, os.path.join(destination_dir, filename))
        
        encode_path = f'/assets/{asset_id}/{BROADCAST_KEY}1.m3u8'
        requests.put(f'{studio_url}/script/assets/{asset_id}', json={'token': SCRIPT_TOKEN, 'encodeStatus': 'COMPLETE', 'encodePath': encode_path, 'encodeSegments': []}, timeout=10)

        requests.post(f'{runner_url}/runner/users/{USER_ID}/assets/{asset_id}/add-to-ipfs', json={'token': SCRIPT_TOKEN, 'filePath': encode_path}, timeout=10)
    except Exception as e:
        with open('/home/ubuntu/update_config.log', 'a') as log_file:
            log_file.write(f'Error updating config: {e}\n')
