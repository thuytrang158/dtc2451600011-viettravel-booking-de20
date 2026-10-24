#!/bin/sh
set -eu
# nginx official image uses symlinks access.log -> /dev/stdout.
# Replace them with regular files so Promtail can read nginx_logs volume.
rm -f /var/log/nginx/access.log /var/log/nginx/error.log
touch /var/log/nginx/access.log /var/log/nginx/error.log
chmod 644 /var/log/nginx/access.log /var/log/nginx/error.log
exec /docker-entrypoint.sh nginx -g 'daemon off;'
