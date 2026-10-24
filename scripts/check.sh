#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
echo '=== 1. Container ==='
sudo docker compose ps
echo '\n=== 2. Kiểm tra HTTPS và API ==='
curl -k -sS -o /dev/null -w 'HTTPS status: %{http_code}\n' https://127.0.0.1:8443/
curl -k -sS -o /dev/null -w 'Tour API status: %{http_code}\n' https://127.0.0.1:8443/api/tours
echo '\n=== 3. Kiểm tra DB ==='
sudo docker compose exec -T postgres psql -U postgres -d travel_db -c 'SELECT count(*) AS total_tours FROM tours;'
echo '\n=== 4. Kiểm tra metrics nội bộ ==='
curl -fsS http://127.0.0.1:9095/api/v1/query?query=up | head -c 500
echo '\n'
