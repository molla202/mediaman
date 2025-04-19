echo "Switching to live feed" >> /home/ubuntu/ffmpeg.log

broadcast_key="${2%1}"

USERNAME=$(jq -r "to_entries | .[] | select(.value.broadcastKey == \"$broadcast_key\") | .key" /home/ubuntu/.config/stream_keys.json)

result="streamer-${USERNAME}"

supervisorctl stop $result

if [ "$USERNAME" = "main" ]; then
    USERNAME="ubuntu"
fi

echo "Stopping $1" >> /home/ubuntu/ffmpeg.log

if [ -z "${SCRIPT_TOKEN}" ]; then
    SCRIPT_TOKEN="default"
fi

echo "Updating config" >> /home/ubuntu/ffmpeg.log

/usr/bin/venv/bin/python3 /home/$USERNAME/streamer/scripts/update_config.py $USERNAME $SCRIPT_TOKEN $broadcast_key

echo "Updated config" >> /home/ubuntu/ffmpeg.log
