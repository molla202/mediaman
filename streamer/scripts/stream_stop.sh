broadcast_key="${2%1}"

USERNAME=$(jq -r "to_entries | .[] | select(.value.broadcastKey == \"$broadcast_key\") | .key" /home/ubuntu/.config/stream_keys.json)

MEDIA_SPACE_ID=$(jq -r "to_entries | .[] | select(.value.broadcastKey == \"$broadcast_key\") | .value.mediaSpaceId" /home/ubuntu/.config/stream_keys.json)

suffix="${USERNAME}"

suffixx="${suffix}"

result="streamer-${suffix}"

if [ "$suffix" = "main" ]; then
    suffix="ubuntu"
fi

if [ -z "${SCRIPT_TOKEN}" ]; then
    SCRIPT_TOKEN="default"
fi

sleep 10

xml=$(curl -s http://localhost:8083/stat)

stream_status=$(echo "$xml" | xmlstarlet sel -t -v "count(//application[name='$1']//publishing)")

echo "Stream status: $stream_status" >> /home/ubuntu/stop.log

if [ "$stream_status" -gt "0" ]; then
    echo "Stream 'omniflix' is publishing" >> /home/ubuntu/stop.log
else
    echo "Stream 'omniflix' is not publishing" >> /home/ubuntu/stop.log

    echo "Stopping live feed" >> /home/ubuntu/stop.log

    random_string=$(openssl rand -hex 12)
    target_dir="/mnt/livestream-recordings/$random_string"

    mkdir -p "$target_dir" || {
        echo "Failed to create directory $target_dir" >> /home/ubuntu/stop.log
        exit 1
    }

    mv -f "/mnt/live/$MEDIA_SPACE_ID/"$2* "$target_dir/" || {
        echo "Failed to move files from /mnt/live/$MEDIA_SPACE_ID/ to $target_dir" >> /home/ubuntu/stop.log
        exit 1
    }

    m3u8_files=$(find "$target_dir" -type f -name "index.m3u8")
    for m3u8_file in $m3u8_files; do
        echo "Processing $m3u8_file" >> /home/ubuntu/stop.log
        if [ -f "$m3u8_file" ]; then
            sed -i 's/EXT-X-PLAYLIST-TYPE: EVENT/EXT-X-PLAYLIST-TYPE: VOD/' "$m3u8_file"
            echo "#EXT-X-ENDLIST" >> "$m3u8_file"
            echo "Processed $m3u8_file" >> /home/ubuntu/stop.log
        else
            echo "File $m3u8_file not found" >> /home/ubuntu/stop.log
        fi
    done

    /usr/bin/venv/bin/python3 /home/$suffix/streamer/scripts/stream_stop.py $suffix $SCRIPT_TOKEN $random_string $broadcast_key $suffix

    echo "Reloading nginx" >> /home/ubuntu/stop.log
    nginx -s reload || echo "Failed to reload nginx" >> /home/ubuntu/stop.log
fi
