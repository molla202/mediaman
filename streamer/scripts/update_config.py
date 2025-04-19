import json
import sys
import requests

USERNAME = sys.argv[1]
SCRIPT_TOKEN = sys.argv[2]
BROADCAST_KEY = sys.argv[3]

if USERNAME == "main":
    USERNAME = "ubuntu"

with open('/home/ubuntu/update_config.log', 'a') as log_file:
    log_file.write(f'Updating config for {USERNAME}\n')

CONFIG_FILE = f'/home/{USERNAME}/streamer/config.json'

with open(CONFIG_FILE, 'r') as conf_file:
    stream_config = json.loads(conf_file.read())

    stream_config['playing_live_feed'] = True
    studio_url = stream_config['backend_url']

with open(CONFIG_FILE, 'w') as conf_file:
    json.dump(stream_config, conf_file, indent=4)

try:
    requests.put(f'{studio_url}/live-streams/switch-to-live/{USERNAME}', json={'token': SCRIPT_TOKEN, 'broadcast_key': BROADCAST_KEY}, timeout=10)
except Exception as e:
    with open('/home/ubuntu/update_config.log', 'a') as log_file:
        log_file.write(f'Error updating config: {e}\n')