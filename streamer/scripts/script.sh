cd /usr/local/src
wget http://nginx.org/download/nginx-1.24.0.tar.gz
tar -zxvf nginx-1.24.0.tar.gz
git clone https://github.com/arut/nginx-rtmp-module.git

cd nginx-1.24.0
./configure --with-http_ssl_module --with-http_stub_status_module --add-module=../nginx-rtmp-module \
            --with-compat \
            --with-debug \
            --with-pcre-jit \
            --with-http_ssl_module \
            --with-http_stub_status_module \
            --with-http_realip_module \
            --with-http_auth_request_module \
            --with-http_v2_module \
            --with-http_dav_module \
            --with-http_slice_module \
            --with-threads \
            --with-http_addition_module \
            --with-http_flv_module \
            --with-http_gunzip_module \
            --with-http_gzip_static_module \
            --with-http_mp4_module \
            --with-http_random_index_module \
            --with-http_secure_link_module \
            --with-http_sub_module \
            --with-mail_ssl_module \
            --with-stream_ssl_module \
            --with-stream_ssl_preread_module \
            --with-stream_realip_module \
            --with-http_geoip_module=dynamic \
            --with-http_image_filter_module=dynamic \
            --with-http_perl_module=dynamic \
            --with-http_xslt_module=dynamic \
            --with-mail=dynamic \
            --with-stream=dynamic \
            --with-stream_geoip_module=dynamic 
make
make install

mkdir -p /var/log/nginx

ln -s /usr/local/nginx/sbin/nginx /usr/bin/nginx

apt install -y supervisor python3-pip

mkdir -p /etc/supervisor/conf.d

echo "[supervisord]
nodaemon=true
user=root

[program:nginx]
command=nginx -g 'daemon off;'
autostart=true
autorestart=true

[program:omniflixStream]
command=python3 /app/streamer/stream.py
autostart=false

[unix_http_server]
file=/var/run/supervisor.sock 
chmod=0700" > /etc/supervisor/conf.d/services.conf