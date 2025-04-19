#!/bin/bash

NETWORK_NAME="media-node-network"
CURRENT_DIR="$(pwd)"

start_media-node() {
    source .env && docker compose up -d
}

setup_media-node() {
    check_os() {
        echo "-----------------------------"
        echo "Checking for OS"
        echo "-----------------------------"
        if [[ "$OSTYPE" != "linux-gnu"* ]]; then
            echo "❗Unsupported OS. This script is intended for Linux systems only."
            exit 1
        else
            echo $OSTYPE
        fi
    }

    # OS check
    check_os

    if [ ! -f "$CURRENT_DIR/.env" ]; then
        echo -e "\n\033[31m.env file not found\033[0m\n"
        exit 1
    fi

    source "$CURRENT_DIR/.env"

    echo "-----------------------------"
    echo "Installing prerequisites"
    echo "-----------------------------"

    sudo apt update
    sudo apt install apt-transport-https ca-certificates curl software-properties-common jq -y

    # Check if nginx is installed
    if ! command -v nginx &> /dev/null; then
        echo "nginx could not be found, installing nginx..."
        sudo apt install nginx -y
    else
        echo "nginx is already installed."
    fi

    echo "\n-----------------------------"
    echo "Installing Docker"
    echo "-----------------------------\n"

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo "Docker could not be found, installing Docker..."
        sudo apt update
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
        sudo add-apt-repository "deb [arch=$(dpkg --print-architecture)] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" -y
        sudo apt install docker-ce -y
        sudo usermod -aG docker ${USER}
        sudo -u ${USER} -- bash -c "echo 'Running command as ${USER}'"

        sudo chown root:docker /var/run/docker.sock
        sudo chmod 666 /var/run/docker.sock
    else
        echo "Docker is already installed."
    fi

    echo "-----------------------------"
    echo "Checking for docker-compose installation"
    echo "-----------------------------"

    # Check if Docker Compose is installed
    if ! command -v docker compose &> /dev/null; then
        echo "docker-compose could not be found, installing docker-compose..."
        mkdir -p ~/.docker/cli-plugins/
        curl -SL https://github.com/docker/compose/releases/download/v2.3.3/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose
        chmod +x ~/.docker/cli-plugins/docker-compose
    else
        echo "docker-compose is already installed."
    fi

    sudo systemctl restart docker

    echo "-----------------------------"
    echo "Checking Node.js version..."
    echo "-----------------------------"

    NODE_VERSION=$(node --version 2>/dev/null)
    if [[ "$NODE_VERSION" != "v20"* ]]; then
        echo "Node.js version 20 is required. Installing or updating Node.js..."
        # Remove conflicting packages first
        sudo apt remove -y libnode-dev nodejs
        curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "Node.js version 20 is already installed."
    fi

    echo "-----------------------------"
    echo "Setting up the environment"
    echo "-----------------------------"

    cd "$CURRENT_DIR/scripts/register"

    sudo npm install -g yarn || true
    yarn install || true

    cd $CURRENT_DIR

    echo "Creating network $NETWORK_NAME..."
    docker network create $NETWORK_NAME 2>/dev/null || true

    if [ -z "$MEDIA_SPACE_FOR_LEASE" ]; then
        echo -e "\n\n"
        read -p "Is this media node for leasing ? (Y/n)" MEDIA_SPACE_FOR_LEASE
        if [ "$MEDIA_SPACE_FOR_LEASE" == "n" ]; then
            echo "MEDIA_SPACE_FOR_LEASE=false" >> "$CURRENT_DIR/.env"
        else
            echo "MEDIA_SPACE_FOR_LEASE=true" >> "$CURRENT_DIR/.env"
        fi
    fi

    # Create .env file
    if [ -z "$ADMIN_ADDRESS" ] && [ "$MEDIA_SPACE_FOR_LEASE" = "false" ]; then
        echo -e "\n\n"
        read -p "Enter your admin address (omniflix1...): " ADMIN_ADDRESS
        echo "ADMIN_ADDRESS=$ADMIN_ADDRESS" >> "$CURRENT_DIR/.env"
    fi

    echo "-----------------------------"
    echo "Setting up NGINX"
    echo "-----------------------------"

    sudo systemctl enable nginx
    sudo systemctl start nginx

    echo "Installing certbot for SSL certificate..."
    sudo apt install certbot python3-certbot-nginx -y

    if [ -z "$DOMAIN_NAME" ]; then
        echo -e "\n\n"
        read -p "Enter your domain name if you have one (without https://), otherwise press enter: " DOMAIN_NAME
    fi

    # Create nginx configuration with conditional server_name
    if [ -z "$DOMAIN_NAME" ]; then
        SERVER_NAME="_"
    else
        SERVER_NAME="$DOMAIN_NAME"
        echo "DOMAIN_NAME=$DOMAIN_NAME" >> "$CURRENT_DIR/.env"
    fi

    PORT=${PORT:-8081}
    RTMP_PORT=${RTMP_PORT:-1935}
    MAX_UPLOAD_SIZE=${MAX_UPLOAD_SIZE:-2048M}
    WS_PORT=${WS_PORT:-8085}

    # Create nginx configuration
    sudo bash -c "cat > /etc/nginx/sites-available/media-node <<'EOL'
server {
    server_name $SERVER_NAME;
    location / {
        client_max_body_size $MAX_UPLOAD_SIZE;
        proxy_pass http://0.0.0.0:$PORT\$request_uri;
    }
    location /ws/ {
        proxy_pass http://0.0.0.0:$WS_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"Upgrade\";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL"

    sudo rm -f /etc/nginx/sites-enabled/default
    sudo rm -f /etc/nginx/sites-enabled/media-node
    sudo ln -s /etc/nginx/sites-available/media-node /etc/nginx/sites-enabled/

    # Test nginx configuration
    if sudo nginx -t; then
        IP_ADDRESS=$(curl -4 -sSL ifconfig.me)
        echo -e "\n\n"
        read -p "Please make sure you have pointed your domain name to this server's IP address ($IP_ADDRESS) (only if you given the domain), press enter to confirm"

        if [ ! -z "$DOMAIN_NAME" ]; then
            echo "Generating SSL certificate for $DOMAIN_NAME..."
            sudo certbot --nginx -d $DOMAIN_NAME
        else
            echo -e "\n\n"
            echo 'If you want to manually point domain to medianode API,
            make sure you update /etc/nginx/sites-available/media-node with the domain
            and generate certificates using below command

            sudo certbot --nginx
            '
        fi

        sudo systemctl restart nginx

        echo "-----------------------------"
        echo "MediaNode setup completed"
        echo "-----------------------------"
    else
        echo "Nginx configuration test failed. Please check the configuration file."
    fi
}

register_media-node() {
    bash ./scripts/register.sh
}

arg="$1"
if [ -z "$arg" ]; then
    echo "No argument provided. Use 'setup' or 'start'."
    exit 1
fi

if [ "$arg" == "setup" ] || [ "$arg" == "start" ] || [ "$arg" == "register" ]; then
    echo "Argument is valid."
else
    echo "Invalid argument. Use 'setup', 'start' or 'register'."
    exit 1
fi

# Check if the argument is 'setup' or 'start'
if [ "$arg" == "setup" ]; then
    echo "Setting up media node..."
    setup_media-node

elif [ "$arg" == "start" ]; then
    echo "Starting media node..."
    start_media-node

elif [ "$arg" == "register" ]; then
    echo "Registering media node..."
    register_media-node

else
    echo "Invalid argument. Use 'setup', 'start' or 'register'."
    exit 1
fi
