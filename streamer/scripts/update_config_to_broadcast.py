import json
import sys
import requests

param1 = sys.argv[1]
script_token = sys.argv[2]
broadcast_key = sys.argv[3]
random_string = sys.argv[4]
suffix = sys.argv[5]

if param1 == "main":
    param1 = "ubuntu"

CONFIG_FILE = f'/home/{param1}/streamer/config.json'

if __name__ == '__main__':

    with open(CONFIG_FILE, 'r') as conf_file:
        stream_config = json.loads(conf_file.read())

    stream_config['playing_live_feed'] = False
    studio_url = stream_config['backend_url']
    runner_url = stream_config['runner_url']

    with open(CONFIG_FILE, 'w') as conf_file:
        json.dump(stream_config, conf_file, indent=4)

    try:
        requests.put(f'{studio_url}/live-streams/switch-to-broadcast/{param1}', json={'token': script_token, 'broadcast_key': broadcast_key, 'playback_id': random_string}, timeout=10)
    except Exception as e:
        with open('/home/ubuntu/update_config.log', 'a') as log_file:
            log_file.write(f'Error updating config: {e}\n')
