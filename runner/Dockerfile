# STAGE 1 - build

FROM python:3.11-slim as build

workdir /app

COPY requirements.txt .

RUN apt-get update && apt-get install -y ffmpeg

RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

RUN pip install ipfsApi

COPY . /app/runner

EXPOSE 8081
