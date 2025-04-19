FROM ubuntu:24.04

RUN apt-get update && apt-get install -y wget tar make gcc libpcre3 libpcre3-dev git zlib1g zlib1g-dev openssl libssl-dev libperl-dev libgd-dev libgeoip-dev libxslt1-dev libxml2-dev libgd-dev libgeoip-dev libxslt1-dev libxml2 ffmpeg python3-pip

COPY scripts/script.sh /script.sh

RUN chmod +x /script.sh

RUN /script.sh

RUN mkdir -p /app/streamer

WORKDIR /app/streamer

COPY . .

RUN pip3 install -r requirements.txt --break-system-packages

EXPOSE 1935 80

COPY nginx.conf /usr/local/nginx/conf/nginx.conf

CMD ["nginx", "-g", "daemon off;"]