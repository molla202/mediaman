#!/bin/bash

broadcast_key="${2%1}"

USERNAME=$(jq -r "to_entries | .[] | select(.value.broadcastKey == \"$broadcast_key\") | .key" /home/ubuntu/.config/stream_keys.json)

suffix="${USERNAME}"

suffixx="${suffix}"

if [ "$suffix" = "main" ]; then
    suffix="ubuntu"
fi

if [ -z "${SCRIPT_TOKEN}" ]; then
    SCRIPT_TOKEN="default"
fi

sleep 10

xml=$(curl -s http://localhost:8083/stat)

stream_status=$(echo "$xml" | xmlstarlet sel -t -v "count(//application[name='$1']//publishing)")

echo "Stream status: $stream_status" >> /home/ubuntu/record_done.log

if [ "$stream_status" -gt "0" ]; then
    echo "Stream 'omniflix' is publishing" >> /home/ubuntu/record_done.log
else
    echo "Merging flv to mp4" >> /home/ubuntu/record_done.log

    flv_files=("/home/$suffix/live-feed-recordings/"*.flv)
    txt_file="/home/$suffix/live-feed-recordings/flv_list.txt"

    for flv_file in "${flv_files[@]}"; do
        echo "file '$flv_file'" >> "$txt_file"
    done

    output_mp4="/home/$suffix/live-feed-recordings/recording_$(date +%Y%m%d%H%M%S).mp4"
    ffmpeg -f concat -safe 0 -i "$txt_file" -c copy "$output_mp4"

    rm -f "${flv_files[@]}"
    rm -f "$txt_file"

    echo "FLV files merged and cleaned up." >> /home/ubuntu/record_done.log

    /usr/bin/venv/bin/python3 /home/$suffix/streamer/scripts/record_done.py $suffixx $output_mp4 $USERNAME
fi
