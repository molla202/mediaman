from pathlib import Path
import sys
import requests
import os
import json

param1 = sys.argv[1]
param2 = sys.argv[2]
username = sys.argv[3]

if username == "main":
    username = "ubuntu"

CONFIG_FILE = f'/home/{username}/streamer/config.json'

with open(CONFIG_FILE, 'r') as conf_file:
    stream_config = json.loads(conf_file.read())

studio_url = stream_config['backend_url']
runner_url = stream_config['runner_url']

if __name__ == '__main__':
    try:
        response = requests.get(f'{studio_url}/runner/users/{param1}/get-id', timeout=10)
        if response.status_code == 200:
            data = response.json()
            userid = data.get('result')

            file_path = Path(param2)
            with open(file_path, 'rb') as f:
                files = {'file': f}
                payload = {'_type': 'video'}
                response = requests.post(f'{runner_url}/runner/users/{userid}/assets/file-upload', data=payload, files=files)
                print(response.json(), response.status_code)
            if response.status_code == 201:
                print("Successfully used IDs in the request.")
                os.remove(file_path)
            else:
                print("Failed to use IDs in the request.")
        else:
            print("Failed to fetch user ID and asset ID.")
    except Exception as e:
        print(f"An error occurred: {e}")
