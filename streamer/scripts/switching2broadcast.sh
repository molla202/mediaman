#!/bin/bash
broadcast_key="${2%1}"

USERNAME=$(jq -r "to_entries | .[] | select(.value.broadcastKey == \"$broadcast_key\") | .key" /home/ubuntu/.config/stream_keys.json)

MEDIA_SPACE_ID=$(jq -r "to_entries | .[] | select(.value.broadcastKey == \"$broadcast_key\") | .value.mediaSpaceId" /home/ubuntu/.config/stream_keys.json)

result="streamer-${USERNAME}"

if [ "$USERNAME" = "main" ]; then
    USERNAME="ubuntu"
fi

if [ -z "${SCRIPT_TOKEN}" ]; then
    SCRIPT_TOKEN="default"
fi

BROADCAST_STATE=$(jq -r .broadcast_state /home/$USERNAME/streamer/config.json)

sleep 10

xml=$(curl -s http://localhost:8083/stat)

stream_status=$(echo "$xml" | xmlstarlet sel -t -v "count(//application[name='$1']//publishing)")

echo "Stream status: $stream_status" >> /home/ubuntu/switching2fpc.log

if [ "$stream_status" -gt "0" ]; then
    echo "Stream 'omniflix' is publishing" >> /home/ubuntu/switching2fpc.log
else
    echo "Stream 'omniflix' is not publishing" >> /home/ubuntu/switching2fpc.log

    random_string=$(openssl rand -hex 12)
    target_dir="/mnt/livestream-recordings/$random_string"

    mkdir -p "$target_dir" || {
        echo "Failed to create directory $target_dir" >> /home/ubuntu/switching2fpc.log
        exit 1
    }

    mv -f "/mnt/live/$MEDIA_SPACE_ID/"$2* "$target_dir/" || {
        echo "Failed to move files from /mnt/live/$MEDIA_SPACE_ID/ to $target_dir" >> /home/ubuntu/switching2fpc.log
        exit 1
    }

    m3u8_files=$(find "$target_dir" -type f -name "index.m3u8")
    for m3u8_file in $m3u8_files; do
        echo "Processing $m3u8_file" >> /home/ubuntu/switching2fpc.log
        if [ -f "$m3u8_file" ]; then
            sed -i 's/EXT-X-PLAYLIST-TYPE: EVENT/EXT-X-PLAYLIST-TYPE: VOD/' "$m3u8_file"
            echo "#EXT-X-ENDLIST" >> "$m3u8_file"
            echo "Processed $m3u8_file" >> /home/ubuntu/switching2fpc.log
        else
            echo "File $m3u8_file not found" >> /home/ubuntu/switching2fpc.log
        fi
    done

    echo "Switching to FPC" >> /home/ubuntu/ffmpeg.log

    /usr/bin/venv/bin/python3 /home/$USERNAME/streamer/scripts/update_config_to_broadcast.py $USERNAME $SCRIPT_TOKEN $broadcast_key $random_string $USERNAME

    echo "Reloading nginx" >> /home/ubuntu/ffmpeg.log

    nginx -s reload

    if [ "$BROADCAST_STATE" = "running" ]; then
        echo "Restarting supervisor $result" >> /home/ubuntu/ffmpeg.log
        supervisorctl restart $result
    else
        echo "Broadcast is not running" >> /home/ubuntu/ffmpeg.log
    fi
fi
