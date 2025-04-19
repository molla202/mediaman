#!/bin/bash
# entrypoint.sh

cd /app

gunicorn -b :8081 runner --log-level debug &

rq worker