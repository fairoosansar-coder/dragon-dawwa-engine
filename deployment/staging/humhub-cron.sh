#!/bin/sh
set -eu
[ "${UMMAH_REVIEW_ENVIRONMENT:-}" = isolated-staging ] || exit 78
cd /var/www/html/protected
while :; do
  php yii cron/run --interactive=0
  sleep 60
done
