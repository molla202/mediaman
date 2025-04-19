-- auth.lua
local cjson = require "cjson"

-- Function to read JSON file
local function read_json_file(file_path)
    local file = io.open(file_path, "r")
    if not file then
        ngx.log(ngx.ERR, "Failed to open stream_keys.json")
        return nil
    end
    
    local content = file:read("*all")
    file:close()
    
    local ok, json_data = pcall(cjson.decode, content)
    if not ok then
        ngx.log(ngx.ERR, "Failed to parse JSON: " .. json_data)
        return nil
    end
    
    return json_data
end

local function validate_stream()
    local args = ngx.req.get_uri_args()
    local key = args["name"]
    local app = args["app"]

    if not key then
        ngx.log(ngx.ERR, "Unauthorized access attempt: missing key")
        return ngx.exit(ngx.HTTP_UNAUTHORIZED)
    end

    local stream_keys = read_json_file("/home/ubuntu/.config/stream_keys.json")
    if not stream_keys then
        ngx.log(ngx.ERR, "Failed to load stream keys")
        return ngx.exit(ngx.HTTP_INTERNAL_SERVER_ERROR)
    end

    for username, user_keys in pairs(stream_keys) do
        if (app:find("broadcast") and key == user_keys.broadcastKey) or (app:find("live_feed") and key == user_keys.liveFeedKey) then
            ngx.log(ngx.INFO, "Access granted for key: " .. key .. " to application: " .. username)
            return ngx.exit(ngx.HTTP_OK)
        end
    end
    ngx.log(ngx.ERR, "Unauthorized access attempt: invalid key " .. key)
    return ngx.exit(ngx.HTTP_UNAUTHORIZED)
end

validate_stream()