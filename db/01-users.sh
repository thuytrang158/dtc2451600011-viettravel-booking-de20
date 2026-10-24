#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$APP_DB_PASSWORD" -v exporter_password="$EXPORTER_DB_PASSWORD" -v database_name="$POSTGRES_DB" <<'SQL'
CREATE ROLE travel_app LOGIN PASSWORD :'app_password';
CREATE ROLE metrics_reader LOGIN PASSWORD :'exporter_password';
GRANT CONNECT ON DATABASE :"database_name" TO travel_app, metrics_reader;
GRANT USAGE ON SCHEMA public TO travel_app;
GRANT pg_monitor TO metrics_reader;
SQL
