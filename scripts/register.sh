#!/bin/bash

echo "

--------------------------------
Media Node Registration Script
--------------------------------

This script will register a media node with the given parameters.

Please ensure you have the following:
- A media node running on a server
- A domain name pointed to the server
- A valid email address
- A mnemonic for the media node (We do not store your mnemonic anywhere on the server)
- Balance in FLIX to cover the deposit
--------------------------------
"

CONFIG_FILE="media_node_config.json"

prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local input
    
    read -p "$prompt [$default]: " input
    if [ -z "$input" ] && [ -n "$default" ]; then
        echo "$default"
    else
        echo "$input"
    fi
}

get_hardware_specs() {
    local cpus
    local ram_gb
    local storage_gb
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        cpus=$(sysctl -n hw.ncpu)
        local total_ram_bytes=$(sysctl -n hw.memsize)
        ram_gb=$(( (total_ram_bytes + 1024*1024*1024 - 1) / (1024*1024*1024) ))
        local storage_bytes=$(df -k / | tail -1 | awk '{print $4}')
        storage_gb=$(( (storage_bytes + 1024*1024 - 1) / (1024*1024) ))
    else
        cpus=$(nproc)
        local total_ram_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        ram_gb=$(( (total_ram_kb + 1024*1024 - 1) / (1024*1024) ))
        local storage_kb=$(df -k / | tail -1 | awk '{print $4}')
        storage_gb=$(( (storage_kb + 1024*1024 - 1) / (1024*1024) ))
    fi
    
    echo "$cpus,$ram_gb,$storage_gb"
}

# Load previous configuration if exists
if [ -f "$CONFIG_FILE" ]; then
    echo "Loading previous configuration..."
    eval $(jq -r '. | to_entries | .[] | .key + "=" + (.value | @sh)' $CONFIG_FILE)
fi

# Get environment
echo "Select environment:"
echo "1. DEVNET - Chain: devnet-alpha-3"
echo "2. TESTNET - Chain: flixnet-4"
echo "3. MAINNET - Chain: omniflixhub-1"
echo "4. FRAMEFEST - Chain: framefest-1"
read -p "Enter choice (1-4) [${ENV:-1}]: " env_choice
if [ -z "$env_choice" ] && [ -n "$ENV" ]; then
    env_choice=$ENV
fi
case $env_choice in
    1) ENV="DEVNET" ;;
    2) ENV="TESTNET" ;;
    3) ENV="MAINNET" ;;
    4) ENV="FRAMEFEST" ;;
    *) ENV="${ENV:-DEVNET}" ;;
esac

# Get system hardware specs
HARDWARE_SPECS=$(get_hardware_specs)
DEFAULT_HARDWARE_SPECS="${HARDWARE_SPECS:-$DEFAULT_HARDWARE_SPECS}"
echo "Detected system specs: $HARDWARE_SPECS (cpus,ram_gb,storage_gb)"

# Get other parameters with defaults
HARDWARE_SPECS=$(prompt_with_default "Enter Hardware Specs" "${HARDWARE_SPECS:-$DEFAULT_HARDWARE_SPECS}")
while [[ ! "$HARDWARE_SPECS" =~ ^[0-9]+,[0-9]+,[0-9]+$ ]]; do
    echo "Invalid format for Hardware Specs. Please use the format cpus,ram_gb,storage_gb."
    HARDWARE_SPECS=$(prompt_with_default "Enter Hardware Specs" "$DEFAULT_HARDWARE_SPECS")
done

MNEMONIC=$(prompt_with_default "Enter mnemonic" "")

MEDIA_NODE_ID=$(prompt_with_default "Enter Media Node ID starting with 'mn'" "${MEDIA_NODE_ID:-}")
while [[ ! "$MEDIA_NODE_ID" =~ ^mn ]]; do
    echo "Media Node ID must start with 'mn'."
    MEDIA_NODE_ID=$(prompt_with_default "Enter Media Node ID starting with 'mn'" "${MEDIA_NODE_ID:-}")
done

MEDIA_NODE_URL=$(prompt_with_default "Enter Media Node URL starting with 'https://'" "${MEDIA_NODE_URL:-}")
while [[ ! "$MEDIA_NODE_URL" =~ ^https:// ]]; do
    echo "Invalid URL. Please enter a valid URL starting with 'https://'"
    MEDIA_NODE_URL=$(prompt_with_default "Enter Media Node URL starting with 'https://'" "${MEDIA_NODE_URL:-}")
done

INFO=$(prompt_with_default "Enter Media Node Name" "${INFO:-Dev Media Node}")
while [[ -z "$INFO" ]]; do
    echo "Media Node Name cannot be empty."
    INFO=$(prompt_with_default "Enter Media Node Name" "${INFO:-Dev Media Node}")
done

DESCRIPTION=$(prompt_with_default "Enter Media Node Description" "${DESCRIPTION:-Dev Media Node}")
while [[ -z "$DESCRIPTION" ]]; do
    echo "Media Node Description cannot be empty."
    DESCRIPTION=$(prompt_with_default "Enter Media Node Description" "${DESCRIPTION:-Dev Media Node}")
done

CONTACT=$(prompt_with_default "Enter Contact Email" "${CONTACT:-example@example.com}")
while [[ ! "$CONTACT" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; do
    echo "Invalid email format. Please enter a valid email address."
    CONTACT=$(prompt_with_default "Enter Contact Email" "${CONTACT:-example@example.com}")
done

PRICE_PER_HOUR=$(prompt_with_default "Enter Price Per Hour (in FLIX/tFLIX)" "${PRICE_PER_HOUR:-1}")
while [[ ! "$PRICE_PER_HOUR" =~ ^[0-9]+$ ]]; do
    echo "Invalid input for Price Per Hour. Please enter a numeric value."
    PRICE_PER_HOUR=$(prompt_with_default "Enter Price Per Hour (in FLIX/tFLIX)" "${PRICE_PER_HOUR:-1}")
done

DEPOSIT=$(prompt_with_default "Enter Deposit Amount (in FLIX/tFLIX)" "${DEPOSIT:-1}")
while [[ ! "$DEPOSIT" =~ ^[0-9]+$ ]]; do
    echo "Invalid input for Deposit Amount. Please enter a numeric value."
    DEPOSIT=$(prompt_with_default "Enter Deposit Amount (in FLIX/tFLIX)" "${DEPOSIT:-1}")
done

# Save configuration to JSON file
echo "ENV: $env_choice"
jq -n \
    --arg env_choice "$env_choice" \
    --arg ID "$MEDIA_NODE_ID" \
    --arg URL "$MEDIA_NODE_URL" \
    --arg HARDWARE_SPECS "$HARDWARE_SPECS" \
    --arg INFO "$INFO" \
    --arg DESCRIPTION "$DESCRIPTION" \
    --arg PRICE_PER_HOUR "$PRICE_PER_HOUR" \
    --arg DEPOSIT "$DEPOSIT" \
    --arg CONTACT "$CONTACT" \
    '{"ENV": $env_choice, "MEDIA_NODE_ID": $ID, "MEDIA_NODE_URL": $URL, "HARDWARE_SPECS": $HARDWARE_SPECS, "INFO": $INFO, "DESCRIPTION": $DESCRIPTION, "PRICE_PER_HOUR": $PRICE_PER_HOUR, "DEPOSIT": $DEPOSIT, "CONTACT": $CONTACT}' > $CONFIG_FILE

# Run the TypeScript registration script with parameters
echo "Registering Media Node with the following parameters:"
echo "Environment: $ENV"
if [ "$ENV" == "DEVNET" ]; then
    echo "Chain: devnet-alpha-3"
elif [ "$ENV" == "TESTNET" ]; then
    echo "Chain: flixnet-4"
elif [ "$ENV" == "FRAMEFEST" ]; then
    echo "Chain: framefest-1"
else
    echo "Chain: omniflixhub-1"
fi
echo "Media Node ID: $MEDIA_NODE_ID"
echo "URL: $MEDIA_NODE_URL"
echo "Hardware Specs: $HARDWARE_SPECS"
echo "Price Per Hour: $PRICE_PER_HOUR FLIX/tFLIX"
echo "Deposit: $DEPOSIT FLIX/tFLIX"
echo "Name: $INFO"
echo "Description: $DESCRIPTION"
echo "Contact: $CONTACT"

# Run the TypeScript script with parameters
cd ./scripts/register && yarn register \
    --env "$ENV" \
    --mnemonic "$MNEMONIC" \
    --id "$MEDIA_NODE_ID" \
    --url "$MEDIA_NODE_URL" \
    --hardware-specs "$HARDWARE_SPECS" \
    --info "$INFO" \
    --description "$DESCRIPTION" \
    --price-per-hour "$PRICE_PER_HOUR" \
    --deposit "$DEPOSIT" \
    --contact "$CONTACT" 