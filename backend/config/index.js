const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    baseURL: (() => {
        switch (process.env.NODE_ENV) {
        case 'staging':
            return 'https://staging-api.omniflix.studio';
        case 'production':
            return 'https://api.omniflix.studio';
        case 'development':
        default:
            return 'https://dev-api.omniflix.studio';
        }
    })(),
    allowedTVOrigins: (() => {
        const envAllowedTVOrigins = (process.env.ALLOWED_TV_ORIGINS && process.env.ALLOWED_TV_ORIGINS.split(',')) || [];
        if (envAllowedTVOrigins && envAllowedTVOrigins.length > 0) {
            return envAllowedTVOrigins;
        }

        // Otherwise, using the TV URL as the default value
        switch (process.env.NODE_ENV) {
        case 'staging':
            return ['https://f4.omniflix.tv', 'http://f4.omniflix.tv'];
        case 'production':
            return ['https://omniflix.tv', 'http://omniflix.tv'];
        case 'development':
            return ['https://dev.omniflix.tv', 'http://dev.omniflix.tv'];
        default:
            return ['https://dev.omniflix.tv', 'http://dev.omniflix.tv'];
        }
    })(),
    server: {
        address: process.env.ADDRESS || '127.0.0.1',
        port: process.env.PORT || 8080,
        ip: process.env.IP || 'localhost',
    },
    database: {
        omniflixStudio: {
            address: process.env.OF_STUDIO_DATABASE_ADDRESS || '127.0.0.1',
            port: process.env.OF_STUDIO_DATABASE_PORT || 27017,
            username: process.env.OF_STUDIO_DATABASE_USERNAME || '',
            password: process.env.OF_STUDIO_DATABASE_PASSWORD || '',
            name: process.env.OF_STUDIO_DATABASE_NAME || 'omniflix_media_node',
        },
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'omniflix_studio_jwt',
    },
    md5: {
        secret: process.env.MD5_SECRET || '',
    },
    cors: {
        origin: (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.split(';')) || ['*'],
    },
    tv: {
        minimumWatchPercentageOfIVPerView: process.env.MIN_WATCH_PERCENTAGE_OF_IV_PER_VIEW || 0.5,
    },
    slotDuration: 3600,
    runner: {
        tokenId: process.env.RUNNER_TOKEN || '1',
        publicAddress: process.env.RUNNER_PUBLIC_ADDRESS || '',
        ip: process.env.RUNNER_IP || '',
        port: process.env.RUNNER_PORT || '',
        url: process.env.RUNNER_URL || '',
    },
    flixnet: {
        name: process.env.FLIXNET_NAME || 'Omniflix',
        chainId: process.env.CHAIN_ID || '',
        rpcAddress: process.env.RPC_ADDRESS || '',
        apiAddress: process.env.API_ADDRESS || '',
        websocket: process.env.WEBSOCKET || '',
        coin: {
            denom: process.env.DENOM || 'uflix',
            decimals: process.env.DECIMALS || 6,
        },
        addressPrefix: process.env.ADDRESS_PREFIX || 'omniflix',
        faucetAddress: process.env.FAUCET_ADDRESS || '',
        feeGrantAPIURL: process.env.FEE_GRANT_API_URL || '',
    },
    poll: {
        activePollsPerCollection: process.env.ACTIVE_POLLS_PER_COLLECTION || 3,
    },
    recap: {
        recapVideoGenerateAPIURL: process.env.RECAP_VIDEO_GENERATE_API_URL || '',
    },
    hls: {
        token: process.env.HLS_ACCESS_TOKEN || 'omniflix',
    },
    cloudflareCDN: {
        token: process.env.CLOUDFLARE_CDN_TOKEN || 'omniflix',
    },
    mediaSpace: {
        broadcastEnabled: process.env.BROADCAST_ENABLED || true,
        memoryLimitInMB: process.env.MEDIA_SPACE_MEMORY_LIMIT_IN_MB || 4096,
        coreLimit: process.env.MEDIA_SPACE_CORE_LIMIT || 2,
        id: process.env.MEDIA_SPACE_ID || '',
        assetsPath: process.env.MEDIA_SPACE_ASSETS_PATH || '/home/ubuntu/media-node-data/assets/assets.json',
        forLease: process.env.MEDIA_SPACE_FOR_LEASE || 'true',
    },
    nginx: {
        stream_key: process.env.STREAM_KEY || 'omniflix',
        path: process.env.NGINX_PATH || '/usr/local/openresty/nginx/conf/nginx.conf',
        rtmp_files_path: process.env.NGINX_RTMP_FILES_PATH || '/usr/local/openresty/nginx/conf/rtmp',
        root_dir: process.env.NGINX_ROOT_DIR || '/home',
        rtmpPort: process.env.RTMP_PORT || 1935,
    },
    streamer: {
        config_path: process.env.STREAMER_CONFIG_PATH || '/home/ubuntu/streamer/config.json',
        stream_keys_path: process.env.STREAM_KEYS_PATH || '/home/ubuntu/.config/stream_keys.json',
        script_call_token: process.env.SCRIPT_TOKEN || 'default',
    },
    swagger: {
        servers: [
            {
                url: process.env.SWAGGER_SERVER_URL || 'http://localhost:8082',
                description: process.env.SWAGGER_SERVER_DESCRIPTION || 'Local Server',
            },
        ],
    },
    omniflixStudio: {
        token: process.env.OMNIFLIX_STUDIO_TOKEN || 'omniflix',
        apiAddress: process.env.OMNIFLIX_STUDIO_API_ADDRESS || 'http://host.docker.internal:8087',
        DEV: process.env.DEV || 'http://host.docker.internal:8089',
        PROD: process.env.PROD || 'https://api.omniflix.studio',
        STAGING: process.env.STAGING || 'https://staging-api.omniflix.studio',
    },
    ws: {
        port: process.env.WS_PORT || 8085,
    },
    youtube: {
        clientId: process.env.YOUTUBE_CLIENT_ID || '',
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
        redirectUri: process.env.YOUTUBE_REDIRECT_URI || '',
    },
    twitch: {
        clientId: process.env.TWITCH_CLIENT_ID || '',
        clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
        redirectUri: process.env.TWITCH_REDIRECT_URI || '',
        authUrl: process.env.TWITCH_AUTH_URL || '',
        apiUrl: process.env.TWITCH_API_URL || '',
    },
    facebook: {
        appId: process.env.FACEBOOK_APP_ID || '',
        appSecret: process.env.FACEBOOK_APP_SECRET || '',
        redirectUri: process.env.FACEBOOK_REDIRECT_URI || '',
        authUrl: process.env.FACEBOOK_AUTH_URL || '',
        apiUrl: process.env.FACEBOOK_API_URL || '',
    },
    twitter: {
        clientId: process.env.TWITTER_CLIENT_ID || '',
        clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
        redirectUri: process.env.TWITTER_REDIRECT_URI || '',
        authUrl: process.env.TWITTER_AUTH_URL || '',
        apiUrl: process.env.TWITTER_API_URL || '',
    },
};
