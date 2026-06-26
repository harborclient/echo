#!/bin/sh
set -e

export NGINX_SERVER_NAME="${NGINX_SERVER_NAME:-_}"

envsubst '${NGINX_SERVER_NAME}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/http.d/default.conf

node /app/dist/index.js &

exec nginx -g 'daemon off;'
