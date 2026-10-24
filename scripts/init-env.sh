#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -e .env ]; then
  echo 'Đã có .env; không thay đổi để tránh mất mật khẩu DB.'
else
  cp .env.example .env
  for key in POSTGRES_PASSWORD APP_DB_PASSWORD EXPORTER_DB_PASSWORD PGADMIN_PASSWORD ADMIN_PASSWORD GRAFANA_PASSWORD; do
    secret="$(openssl rand -hex 20)"
    sed -i "s/^${key}=CHANGE_ME$/${key}=${secret}/" .env
  done
  chmod 600 .env
  echo 'Đã tạo .env với mật khẩu ngẫu nhiên.'
fi
mkdir -p nginx/certs
if [ ! -f nginx/certs/server.key ] || [ ! -f nginx/certs/server.crt ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 365 \
    -keyout nginx/certs/server.key -out nginx/certs/server.crt \
    -subj '/CN=localhost' >/dev/null 2>&1
  chmod 600 nginx/certs/server.key
  chmod 644 nginx/certs/server.crt
  echo 'Đã sinh chứng chỉ HTTPS tự ký (phù hợp demo, trình duyệt sẽ cảnh báo).'
fi
printf '\nĐăng nhập/URL: xem file .env (không đẩy .env lên GitHub).\n'
