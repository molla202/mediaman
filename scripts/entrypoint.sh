#!/bin/bash

# Check for required ADMIN_ADDRESS if MEDIA_SPACE_FOR_LEASE is false
if [ $MEDIA_SPACE_FOR_LEASE = false ] && [ -z "$ADMIN_ADDRESS" ]; then
    echo -e "\n\033[31mFor Media Node without lease, ADMIN_ADDRESS is required\033[0m\n"
    exit 1
fi

CONFIG_FILE="/home/ubuntu/.config/config.json"

# Set default ports if not defined in env file
RUNNER_PORT=${RUNNER_PORT:-8091}
STUDIO_PORT=${STUDIO_PORT:-8090}
RUNNER_HOST=${RUNNER_HOST:-0.0.0.0}
STUDIO_HOST=${STUDIO_HOST:-localhost}
RTMP_PORT=${RTMP_PORT:-1935}

CHAIN_DETAILS=${CHAIN_DETAILS:-'{
"devnet": {
    "chain_id": "devnet-alpha-3", 
    "chain_name": "devnet", 
    "rpc": "https://rpc.devnet-alpha.omniflix.network", 
    "rest": "https://api.devnet-alpha.omniflix.network", 
    "denom": "uflix", 
    "prefix": "omniflix", 
    "studio_api": "https://dev-api.omniflix.studio", 
    "studio_dev_api": "https://dev-api.omniflix.studio"
}, 
"mainnet": {
    "chain_id": "omniflixhub-1",
    "chain_name": "mainnet",
    "rpc": "https://rpc.omniflix.network",
    "rest": "https://rest.omniflix.network",
    "denom": "uflix",
    "prefix": "omniflix",
    "studio_api": "https://api.omniflix.studio",
    "studio_dev_api": "https://dev-api.omniflix.studio"
},
"testnet": {
    "chain_id": "flixnet-4",
    "chain_name": "testnet",
    "rpc": "https://rpc.testnet.omniflix.network",
    "rest": "https://api.testnet.omniflix.network",
    "denom": "uflix",
    "prefix": "omniflix",
    "studio_api": "https://testnet-api.omniflix.studio",
    "studio_dev_api": "https://dev-api.omniflix.studio"
},
"framefest": {
    "chain_id": "framefest-1",
    "chain_name": "framefest",
    "rpc": "https://rpc.framefest-testnet.omniflix.network",
    "rest": "https://api.framefest-testnet.omniflix.network",
    "denom": "utflix",
    "prefix": "omniflix",
    "studio_api": "https://dev-api-framefest.omniflix.studio",
    "studio_dev_api": "https://dev-api-framefest.omniflix.studio"
}}'
}

DEFAULT_CHAIN=${DEFAULT_CHAIN:-'framefest'}

CHAIN_ID=$(jq -r --arg chain "$DEFAULT_CHAIN" '.[$chain].chain_id' <<< "$CHAIN_DETAILS")
DENOM=$(jq -r --arg chain "$DEFAULT_CHAIN" '.[$chain].denom' <<< "$CHAIN_DETAILS")
OMNIFLIX_STUDIO_API_ADDRESS=$(jq -r --arg chain "$DEFAULT_CHAIN" '.[$chain].studio_api' <<< "$CHAIN_DETAILS")
OMNIFLIX_API_ADDRESS=$(jq -r --arg chain "$DEFAULT_CHAIN" '.[$chain].rest' <<< "$CHAIN_DETAILS")
DEV=$(jq -r --arg chain "$DEFAULT_CHAIN" '.[$chain].studio_dev_api' <<< "$CHAIN_DETAILS")

DB_USERNAME=${DB_USERNAME:-''}
DB_PASSWORD=${DB_PASSWORD:-''}
MEDIA_SPACE_FOR_LEASE=${MEDIA_SPACE_FOR_LEASE:-false}
BROADCAST_ENABLED=${BROADCAST_ENABLED:-true}
REDIS_HOST=${REDIS_HOST:-'redis'}
REDIS_PORT=${REDIS_PORT:-'6379'}

DB_HOST=${DB_HOST:-'mongo'}
DB_PORT=${DB_PORT:-'27017'}
DB_NAME=${DB_NAME:-'omniflix_media_node'}

if [ -n "$DB_USERNAME" ] && [ -n "$DB_PASSWORD" ]; then
    MONGO_URL="mongodb://$DB_USERNAME:$DB_PASSWORD@$DB_HOST:$DB_PORT"
else
    MONGO_URL="mongodb://$DB_HOST:$DB_PORT"
fi

if [ -f "$CONFIG_FILE" ] && grep -q '"Started":' "$CONFIG_FILE"; then

    for conf_file in /usr/local/openresty/nginx/conf/rtmp/*.conf; do
        dir_name=$(basename "$conf_file" .conf)
        mkdir -p "/mnt/live/$dir_name/broadcast"
    done

    echo "ENABLE=1" >> /etc/default/stunnel4

    service stunnel4 start

    STUDIO_CONFIG_FILE="/etc/supervisor/conf.d/backend.conf"

    sed -i -E "s/^(\s*PORT=).*/\1${STUDIO_PORT},/" "$STUDIO_CONFIG_FILE"
    sed -i -E "s/^(\s*RUNNER_PORT=).*/\1${RUNNER_PORT},/" "$STUDIO_CONFIG_FILE"
    sed -i -E "s/^(\s*RUNNER_IP=).*/\1${RUNNER_HOST},/" "$STUDIO_CONFIG_FILE"
    sed -i -E "s/^(\s*CHAIN_ID=).*/\1${CHAIN_ID},/" "$STUDIO_CONFIG_FILE"
    sed -i -E "s/^(\s*DENOM=).*/\1${DENOM},/" "$STUDIO_CONFIG_FILE"
    sed -i -E "s|^(\s*API_ADDRESS=).*|\1${OMNIFLIX_API_ADDRESS},|" "$STUDIO_CONFIG_FILE"
    sed -i -E "s|^(\s*DEV=).*|\1${DEV},|" "$STUDIO_CONFIG_FILE"
    sed -i -E "s|^(\s*OMNIFLIX_STUDIO_API_ADDRESS=).*|\1${OMNIFLIX_STUDIO_API_ADDRESS},|" "$STUDIO_CONFIG_FILE"
    sed -i -E "s/^(\s*MEDIA_SPACE_FOR_LEASE=).*/\1${MEDIA_SPACE_FOR_LEASE},/" "$STUDIO_CONFIG_FILE"
    sed -i -E "s/^(\s*BROADCAST_ENABLED=).*/\1${BROADCAST_ENABLED},/" "$STUDIO_CONFIG_FILE"
    sed -i -E "s/^(\s*OF_STUDIO_DATABASE_ADDRESS=).*/\1${DB_HOST},/" "$STUDIO_CONFIG_FILE"
    sed -i -E "s/^(\s*OF_STUDIO_DATABASE_PORT=).*/\1${DB_PORT},/" "$STUDIO_CONFIG_FILE"
    sed -i -E "s/^(\s*OF_STUDIO_DATABASE_USERNAME=).*/\1'${DB_USERNAME}',/" "$STUDIO_CONFIG_FILE"
    sed -i -E "s/^(\s*OF_STUDIO_DATABASE_PASSWORD=).*/\1'${DB_PASSWORD}',/" "$STUDIO_CONFIG_FILE"
    sed -i -E "s/^(\s*OF_STUDIO_DATABASE_NAME=).*/\1${DB_NAME},/" "$STUDIO_CONFIG_FILE"
    sed -i -E "s/^(\s*RTMP_PORT=).*/\1${RTMP_PORT},/" "$STUDIO_CONFIG_FILE"

    if [ -n "$MEDIA_NODE_ID" ]; then
        sed -i -E "s/^(\s*MEDIA_SPACE_ID=).*/\1${MEDIA_NODE_ID},/" "$STUDIO_CONFIG_FILE"
    fi

    RUNNER_CONFIG_FILE="/etc/supervisor/conf.d/runner.conf"

    sed -i -E "s/^(\s*REDIS_HOST=).*/\1${REDIS_HOST},/" "$RUNNER_CONFIG_FILE"
    sed -i -E "s/^(\s*REDIS_PORT=).*/\1${REDIS_PORT},/" "$RUNNER_CONFIG_FILE"
    sed -i -E "s|^(\s*BACKEND_API_URL=).*|\1http://localhost:${STUDIO_PORT},|" "$RUNNER_CONFIG_FILE"
    sed -i -E "s|(-b :)8091|\1${RUNNER_PORT}|" "$RUNNER_CONFIG_FILE"
    sed -i -E "s|(-b :)0.0.0.0|\1${RUNNER_HOST}|" "$RUNNER_CONFIG_FILE"
    sed -i -E "s|(-b :)localhost|\1${STUDIO_HOST}|" "$RUNNER_CONFIG_FILE"

    REDIS_CONFIG_FILE="/etc/supervisor/conf.d/redis.conf"

    sed -i -E "s|(redis://)[^:]+:[0-9]+|\1${REDIS_HOST}:${REDIS_PORT}|" "$REDIS_CONFIG_FILE"
    sed -i -E "s/^(\s*REDIS_HOST=).*/\1${REDIS_HOST},/" "$REDIS_CONFIG_FILE"
    sed -i -E "s/^(\s*REDIS_PORT=).*/\1${REDIS_PORT},/" "$REDIS_CONFIG_FILE"
    sed -i -E "s|^(\s*BACKEND_API_URL=).*|\1http://localhost:${STUDIO_PORT},|" "$REDIS_CONFIG_FILE"

    if [ $MEDIA_SPACE_FOR_LEASE = false ]; then
        AUTH_TOKEN=${AUTH_TOKEN:-$(openssl rand -base64 12 | tr -dc A-Za-z0-9 | head -c 16)}
        MONGO_OUTPUT="/tmp/mongo_output.txt"
        mongosh $MONGO_URL > $MONGO_OUTPUT <<EOF
        use $DB_NAME
        let existingUser = db.users.findOne({bc_account_address: "$ADMIN_ADDRESS"});
        if (!existingUser) {
            print("User does not exist")
        } else {
            print("User already exists: " + existingUser.bc_account_address);
        }
        exit
EOF

        cat $MONGO_OUTPUT

        USER_EXISTS=$(grep "User already exists" $MONGO_OUTPUT)
        if [ ! -n "$USER_EXISTS" ]; then
            echo "User does not exist"
            echo "Creating user"
            mongosh $MONGO_URL > $MONGO_OUTPUT <<EOF
            use $DB_NAME
            let mediaSpaceId = db.media_spaces.findOne({username: "main"})._id;
            let result = db.users.insertOne(
                {
                    bc_account_address: "$ADMIN_ADDRESS",
                    auth_token: "$AUTH_TOKEN",
                    root_path: "/home/ubuntu",
                    is_admin: true,
                    media_space: mediaSpaceId,
                }
            );
            print("User inserted: " + result.insertedId);
            exit
EOF
            cat $MONGO_OUTPUT

            jq '.AUTH_TOKEN = "'$AUTH_TOKEN'"' /home/ubuntu/.config/config.json > /tmp/config.json.tmp && mv /tmp/config.json.tmp /home/ubuntu/.config/config.json
        fi
    fi

    cat /home/ubuntu/.config/config.json

    service supervisor start & 

    cp /usr/local/assets.zip /home/ubuntu/media-node-data/

    unzip -o /home/ubuntu/media-node-data/assets.zip -d /home/ubuntu/media-node-data > /dev/null 2>&1

    rm /home/ubuntu/media-node-data/assets.zip

    ipfs add -r /home/ubuntu/media-node-data/thumbnails --pin > /dev/null 2>&1

    ipfs add -r /home/ubuntu/media-node-data/assets --pin > /dev/null 2>&1

    echo "Assets have been downloaded and moved to /home/ubuntu/media-node-data/assets"

    while true; do
        sleep 1
    done
fi

mkdir -p /home/ubuntu/media-node-data /home/ubuntu/live-feed-recordings

cp -r /usr/local/streamer /home/ubuntu/

cp /home/ubuntu/streamer/assets/logo.mp4 /home/ubuntu/media-node-data/

cp -r /usr/local/.config /home/ubuntu/

cp -r /usr/local/scripts /home/ubuntu/

echo "ENABLE=1" >> /etc/default/stunnel4

service stunnel4 start

HLS_TOKEN=${HLS_TOKEN:-$(openssl rand -base64 12 | tr -dc A-Za-z0-9 | head -c 16)}
LIVE_STREAM_KEY=${LIVE_STREAM_KEY:-$(openssl rand -base64 12 | tr -dc A-Za-z0-9 | head -c 16)}
BROADCAST_KEY=${BROADCAST_KEY:-$(openssl rand -base64 12 | tr -dc A-Za-z0-9 | head -c 16)}
RUNNER_TOKEN=${RUNNER_TOKEN:-$(openssl rand -base64 12 | tr -dc A-Za-z0-9 | head -c 16)}

RANDOM_STRING=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 6)
LAST_6_DIGITS=${ADMIN_ADDRESS: -6}
AUTH_TOKEN="${LAST_6_DIGITS}${RANDOM_STRING}"

generate_random_string() {
    local prefix="mn"
    local random_hex=$(openssl rand -hex 16)
    echo "${prefix}${random_hex}"
}

MEDIA_NODE_ID=${MEDIA_NODE_ID:-$(generate_random_string)}

IP=$(curl ifconfig.me)

MONGO_OUTPUT="/tmp/mongo_output.txt"

MEDIA_SPACE_ID=$(($RANDOM % 900000 + 100000))
echo "MEDIA_SPACE_ID: $MEDIA_SPACE_ID"
sleep 4
mongosh $MONGO_URL > $MONGO_OUTPUT <<EOF
use $DB_NAME
let existingMediaSpace = db.media_spaces.findOne({username: "main"});
let mediaSpaceId;
if (existingMediaSpace) {
    mediaSpaceId = existingMediaSpace.id;
    print("Media Space ID: " + mediaSpaceId);
} else {
    let result = db.media_spaces.insertOne(
        {
            username: "main",
            name: "MEDIA_SPACE",
            id: $MEDIA_SPACE_ID,
            broadcast_enabled: $BROADCAST_ENABLED,
        }
    );
    mediaSpaceId = result.insertedId;
    print("Media Space ID: " + $MEDIA_SPACE_ID);
}
exit
EOF

MEDIA_SPACE_ID_FROM_MONGO=$(grep "Media Space ID:" $MONGO_OUTPUT | awk '{print $NF}')
cat "$MONGO_OUTPUT"

if [ -z "$MEDIA_SPACE_ID_FROM_MONGO" ]; then
    MEDIA_SPACE_ID=$MEDIA_SPACE_ID
    echo "Using Media Space ID: $MEDIA_SPACE_ID"
else
    MEDIA_SPACE_ID=$MEDIA_SPACE_ID_FROM_MONGO
    echo "Using Media Space ID from MongoDB: $MEDIA_SPACE_ID_FROM_MONGO"
fi

echo '{
    "main": {
        "broadcastKey": "'$BROADCAST_KEY'",
        "liveFeedKey": "'$LIVE_STREAM_KEY'",
        "mediaSpaceId": '$MEDIA_SPACE_ID'
    }
}' > /home/ubuntu/.config/stream_keys.json

if [ $MEDIA_SPACE_FOR_LEASE = false ]; then
    if [ ! -n "$ADMIN_ADDRESS" ]; then

        echo -e "\033[31mFor Media Node without lease, ADMIN_ADDRESS is required\033[0m"
        exit 1
    fi
    mongosh $MONGO_URL > $MONGO_OUTPUT <<EOF
    use $DB_NAME
    let existingUser = db.users.findOne({bc_account_address: "$ADMIN_ADDRESS"});
    if (!existingUser) {
        let result = db.users.insertOne(
            {
                bc_account_address: "$ADMIN_ADDRESS",
                auth_token: "$AUTH_TOKEN",
                root_path: "/home/ubuntu",
                is_media_node_admin: true,
            }
        );
        print("User inserted: " + result.insertedId);
    } else {
        print("User already exists: " + existingUser.bc_account_address);
    }
    exit
EOF

    cat "$MONGO_OUTPUT"
fi

jq '.broadcast_config.key = "'$BROADCAST_KEY'" | .backend_url = "http://'$STUDIO_HOST':'$STUDIO_PORT'" | .runner_url = "http://'$RUNNER_HOST':'$RUNNER_PORT'" | .live_feed_config.key = "'$LIVE_STREAM_KEY'" | .live_feed_config.url = "rtmp://localhost:1936/'$MEDIA_SPACE_ID'/live_feed" | .broadcast_config.url = "rtmp://localhost:1935/'$MEDIA_SPACE_ID'/broadcast" ' /home/ubuntu/streamer/config.json > /tmp/config.json.tmp && mv /tmp/config.json.tmp /home/ubuntu/streamer/config.json

cat << EOF > /usr/local/openresty/nginx/conf/nginx.conf
$(sed -e "s|{{ROOT_DIR}}|/home/ubuntu/media-node-data|g" \
    -e "s|{{RUNNER_TOKEN}}|$RUNNER_TOKEN|g" \
    -e "s|{{RUNNER_HOST}}|${RUNNER_HOST}|g" \
    -e "s|{{RUNNER_PORT}}|$RUNNER_PORT|g" \
    -e "s|{{TOKEN_SECRET}}|$HLS_TOKEN|g" \
    -e "s|{{BACKEND_HOST}}|${STUDIO_HOST}|g" \
    -e "s|{{BACKEND_PORT}}|$STUDIO_PORT|g" \
    -e "s|{{WS_PORT}}|8085|g" \
    -e "s|{{RTMP_PATH}}|/usr/local/openresty/nginx/conf/rtmp|g" \
    "/usr/local/backend/app/templates/nginx.template.conf")
EOF

echo "NGINX configuration has been generated at /usr/local/openresty/nginx/conf/nginx.conf"

mkdir -p /usr/local/openresty/nginx/conf/rtmp

mkdir -p /mnt/live/$MEDIA_SPACE_ID/broadcast

BROADCAST_ENABLED=${BROADCAST_ENABLED:-true}

if [ "$BROADCAST_ENABLED" = false ]; then
    STREAM_END_SCRIPT="stream_stop.sh"
else
    STREAM_END_SCRIPT="switching2fpc.sh"
fi

cat << EOF > /usr/local/openresty/nginx/conf/rtmp/$MEDIA_SPACE_ID.conf
$(sed -e "s|{{USER_ID}}|$MEDIA_SPACE_ID|g" \
    -e "s|{{THREADS}}|1|g" \
    -e "s|{{HLS_USERNAME}}|$MEDIA_SPACE_ID|g" \
    -e "s|{{PUSH_DESTINATIONS}}| |g" \
    -e "s|{{ADDITIONAL_DESTINATIONS}}| |g" \
    -e "s|{{STREAM_USERNAME}}|ubuntu|g" \
    -e "s|{{VIEW_KEY}}|${BROADCAST_KEY}1|g" \
    -e "s|switching2fpc.sh|${STREAM_END_SCRIPT}|g" \
    "/usr/local/backend/app/templates/rtmp.template.conf")
EOF

echo "RTMP configuration has been generated at /usr/local/openresty/nginx/conf/rtmp/$MEDIA_SPACE_ID.conf"

ulimit -n 1024

echo "[program:ipfs]
command=ipfs daemon
stderr_logfile=/var/log/ipfs.err.log
stdout_logfile=/var/log/ipfs.out.log" > /etc/supervisor/conf.d/ipfs.conf

echo "IPFS configuration has been generated at /etc/supervisor/conf.d/ipfs.conf"

echo "[program:nginx]
command=nginx -g 'daemon off;'
autostart=true
autorestart=true
stderr_logfile=/var/log/nginx.err.log
stdout_logfile=/var/log/nginx.out.log" > /etc/supervisor/conf.d/nginx.conf

echo "NGINX configuration has been generated at /etc/supervisor/conf.d/nginx.conf"

echo "[supervisord]
nodaemon=true
user=root

[unix_http_server]
file=/var/run/supervisor.sock 
chmod=0700
" > /etc/supervisor/conf.d/services.conf

echo "Supervisor configuration has been generated at /etc/supervisor/conf.d/services.conf"

echo "[program:streamer-main]
command=/usr/bin/venv/bin/python3 /home/ubuntu/streamer/stream.py
autostart=false
stopasgroup=true
stopsignal=QUIT
stderr_logfile=/var/log/streamer-main.err.log
stdout_logfile=/var/log/streamer-main.out.log" > /etc/supervisor/conf.d/streamer-main.conf

echo "Streamer main configuration has been generated at /etc/supervisor/conf.d/streamer-main.conf"

echo "[program:backend]
command=node index.js
directory=/usr/local/backend
environment=
    NODE_ENV=production,
    OF_STUDIO_DATABASE_ADDRESS=$DB_HOST,
    OF_STUDIO_DATABASE_PORT=$DB_PORT,
    OF_STUDIO_DATABASE_USERNAME='$DB_USERNAME',
    OF_STUDIO_DATABASE_PASSWORD='$DB_PASSWORD',
    OF_STUDIO_DATABASE_NAME=$DB_NAME,
    PORT=$STUDIO_PORT,
    RTMP_PORT=$RTMP_PORT,
    RUNNER_IP=0.0.0.0,
    RUNNER_PORT=$RUNNER_PORT,
    CHAIN_ID=${CHAIN_ID:-'devnet-alpha-3'},
    DENOM=${DENOM:-'uflix'},
    API_ADDRESS=$OMNIFLIX_API_ADDRESS,
    HLS_ACCESS_TOKEN=$HLS_TOKEN,
    RUNNER_TOKEN=$RUNNER_TOKEN,
    MEDIA_SPACE_ID=$MEDIA_NODE_ID,
    MEDIA_SPACE_FOR_LEASE=$MEDIA_SPACE_FOR_LEASE,
    OMNIFLIX_STUDIO_API_ADDRESS=$OMNIFLIX_STUDIO_API_ADDRESS,
    BROADCAST_ENABLED=$BROADCAST_ENABLED,
    IP=$IP,
    DEV=$DEV,
    YOUTUBE_CLIENT_ID='$YOUTUBE_CLIENT_ID',
    YOUTUBE_CLIENT_SECRET='$YOUTUBE_CLIENT_SECRET',
    YOUTUBE_REDIRECT_URI='$YOUTUBE_REDIRECT_URI',
    FACEBOOK_APP_ID='$FACEBOOK_APP_ID',
    FACEBOOK_APP_SECRET='$FACEBOOK_APP_SECRET',
    FACEBOOK_REDIRECT_URI='$FACEBOOK_REDIRECT_URI',
    FACEBOOK_API_URL='https://graph.facebook.com',
    FACEBOOK_AUTH_URL='https://www.facebook.com',
    TWITCH_CLIENT_ID='$TWITCH_CLIENT_ID',
    TWITCH_CLIENT_SECRET='$TWITCH_CLIENT_SECRET',
    TWITCH_REDIRECT_URI='$TWITCH_REDIRECT_URI',
    TWITCH_API_URL='https://api.twitch.tv',
    TWITCH_AUTH_URL='https://id.twitch.tv'
stderr_logfile=/var/log/backend.err.log
stdout_logfile=/var/log/backend.out.log" > /etc/supervisor/conf.d/backend.conf

echo "Backend configuration has been generated at /etc/supervisor/conf.d/backend.conf"

echo "[program:runner]
command=/usr/bin/venv/bin/gunicorn -b :$RUNNER_PORT --chdir /usr/local runner --log-level debug --timeout 300
environment=
    REDIS_HOST=$REDIS_HOST,
    REDIS_PORT=$REDIS_PORT,
    RUNNER_TOKEN=$RUNNER_TOKEN,
    BACKEND_API_URL=http://localhost:$STUDIO_PORT,
    ROOT_DIR=/home/ubuntu/media-node-data,
    IPFS_API_HOST=0.0.0.0,
    IPFS_API_PORT=5001,
    PYTHONPATH=/usr/local,
    STREAM_ROOT_DIRECTORY=/home/ubuntu/media-node-data,
    LIVE_TEXT_FILE=/home/ubuntu/media-node-data/live_stream_text_scroll.txt
stderr_logfile=/var/log/runner.err.log
stdout_logfile=/var/log/runner.out.log" > /etc/supervisor/conf.d/runner.conf

echo "Runner configuration has been generated at /etc/supervisor/conf.d/runner.conf"

echo "[program:redis]
command=/usr/bin/venv/bin/rq worker --url redis://${REDIS_HOST}:${REDIS_PORT}
environment=
    REDIS_HOST=$REDIS_HOST,
    REDIS_PORT=$REDIS_PORT,
    RUNNER_TOKEN=$RUNNER_TOKEN,
    BACKEND_API_URL=http://localhost:$STUDIO_PORT,
    ROOT_DIR=/home/ubuntu/media-node-data,
    IPFS_API_HOST=0.0.0.0,
    IPFS_API_PORT=5001,
    PYTHONPATH=/usr/local,
    STREAM_ROOT_DIRECTORY=/home/ubuntu/media-node-data,
    LIVE_TEXT_FILE=/home/ubuntu/media-node-data/live_stream_text_scroll.txt
stderr_logfile=/var/log/redis.err.log
stdout_logfile=/var/log/redis.out.log" > /etc/supervisor/conf.d/redis.conf

echo "Redis configuration has been generated at /etc/supervisor/conf.d/redis.conf"

if [ -z "$DOMAIN_NAME" ]; then
    DOMAIN_NAME="http://$IP"
else
    DOMAIN_NAME="https://$DOMAIN_NAME"
fi

echo '
{
    "LIVE_STREAM_KEY": "'$LIVE_STREAM_KEY'",
    "AUTH_TOKEN": "'$AUTH_TOKEN'",
    "MEDIA_NODE_ID": "'$MEDIA_NODE_ID'",
    "Started": "'$(date +%s)'",
    "domain": "'${DOMAIN_NAME}'"
}' > /home/ubuntu/.config/config.json

cat /home/ubuntu/.config/config.json

echo '

   backend started at  - '${DOMAIN_NAME}'/api
   runner started at - '${DOMAIN_NAME}'/runner
   ipfs gateway started at - '${DOMAIN_NAME}'/ipfs
   ipfs API started at  - '${DOMAIN_NAME}'/ipfs-api
'


service supervisor start &

sleep 3

cp /usr/local/assets.zip /home/ubuntu/media-node-data/

unzip -o /home/ubuntu/media-node-data/assets.zip -d /home/ubuntu/media-node-data > /dev/null 2>&1

rm /home/ubuntu/media-node-data/assets.zip

ipfs add -r /home/ubuntu/media-node-data/thumbnails --pin  > /dev/null 2>&1
ipfs add -r /home/ubuntu/media-node-data/assets --pin  > /dev/null 2>&1


# Keep the container running
while true; do
    sleep 1
done