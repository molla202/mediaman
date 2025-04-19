FROM ubuntu:24.10 as base

WORKDIR /home/ubuntu
# Install IPFS
RUN apt-get update && apt-get install -y wget tar

# FOR LINUX SYSTEMS
RUN wget https://dist.ipfs.tech/kubo/v0.30.0/kubo_v0.30.0_linux-$(dpkg --print-architecture).tar.gz && \
    tar -xvf kubo_v0.30.0_linux-$(dpkg --print-architecture).tar.gz && \
    cd kubo && \
    ./install.sh && \
    rm -rf kubo_v0.30.0_linux-$(dpkg --print-architecture).tar.gz kubo

RUN ipfs init 

RUN ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
RUN ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
RUN ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["http://localhost:5002", "http://localhost:3000", "http://127.0.0.1:5001", "https://webui.ipfs.io"]'
RUN ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Methods '["GET"]'
RUN ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
RUN ipfs bootstrap add /ip4/176.9.122.188/tcp/4001/p2p/12D3KooWR6enLMjfGfBvv8q5U6KwmnzyECDeaEoNp36zSAdJ5BrG
RUN ipfs bootstrap add /ip4/176.9.122.188/udp/4001/quic-v1/p2p/12D3KooWR6enLMjfGfBvv8q5U6KwmnzyECDeaEoNp36zSAdJ5BrG


#INSTALL NODE AND YARN

FROM base as node

RUN apt-get update && apt-get install -y curl

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get install -y nodejs lsb-release gnupg
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update
RUN apt-get install -y yarn

RUN apt-get install -y gnupg && \
    wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add - && \
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list && \
    apt-get update && \
    apt-get install -y mongodb-mongosh && \
    rm -rf /var/lib/apt/lists/*

#INSTALL PYTHON AND DEPENDENCIES

FROM node as python

RUN apt-get update && apt-get install -y python3 python3-pip python3-venv jq xmlstarlet unzip

RUN curl -o /usr/local/assets.zip https://of-encoded-assets.s3.us-east-1.amazonaws.com/assets.zip

#INSTALL SUPERVISOR

RUN apt install -y supervisor python3-pip

RUN mkdir -p /etc/supervisor/conf.d

#INSTALL FFmpeg

FROM python as ffmpeg

RUN apt-get update && apt-get install -y ffmpeg git

#INSTALL NGINX

FROM ffmpeg as nginx

RUN apt-get update && \
    apt-get install -y \
    build-essential \
    libpcre3 libpcre3-dev \
    zlib1g zlib1g-dev \
    libssl-dev \
    libxslt1-dev libgeoip-dev \
    libxml2-dev libgd-dev \
    libperl-dev \
    stunnel4

RUN cd /usr/local/src && \
    wget https://openresty.org/download/openresty-1.25.3.1.tar.gz && \
    tar -zxvf openresty-1.25.3.1.tar.gz && \
    git clone https://github.com/arut/nginx-rtmp-module.git

RUN cd /usr/local/src/openresty-1.25.3.1 && \
    ./configure --with-http_ssl_module --with-http_stub_status_module --add-module=../nginx-rtmp-module \
            --with-ld-opt="-Wl,-rpath,/usr/local/nginx/luajit/lib" \
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

RUN cd /usr/local/src/openresty-1.25.3.1 && make && make install

RUN mkdir -p /var/log/nginx

RUN ln -s /usr/local/openresty/nginx/sbin/nginx /usr/bin/nginx

RUN rm -rf /usr/local/src/openresty-1.25.3.1

#COPY FILES

FROM nginx as final


COPY ./backend /usr/local/backend

COPY ./runner /usr/local/runner

COPY ./scripts /usr/local/scripts

COPY ./streamer /usr/local/streamer

RUN cd /usr/local/backend && yarn install --ignore-engines

RUN python3 -m venv /usr/bin/venv

RUN /usr/bin/venv/bin/pip3 install -r /usr/local/runner/requirements.txt

RUN /usr/bin/venv/bin/pip3 install -r /usr/local/streamer/requirements.txt

RUN /usr/bin/venv/bin/pip3 install ipfsApi rq rq-scheduler m3u8

RUN cd /usr/local/scripts/register && yarn install

RUN mkdir -p /usr/local/.config

COPY ./scripts/auth.lua /usr/local/.config/auth.lua

COPY ./scripts/entrypoint.sh /usr/bin/entrypoint.sh

COPY ./scripts/stunnel.conf /etc/stunnel/stunnel.conf

RUN chmod +x /usr/bin/entrypoint.sh

ENTRYPOINT ["/usr/bin/entrypoint.sh"]