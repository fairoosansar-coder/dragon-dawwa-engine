#!/bin/sh
set -eu
php /usr/local/bin/configure-humhub.php
cd /var/www/html/protected
if [ "${UMMAH_STAGING_INITIALIZE:-false}" = true ]; then
  php yii installer/install-db
  php yii installer/write-site-config 'UmmahConnect isolated staging' 'no-mail@example.invalid'
  php yii module/enable rest
  php yii module/enable ummahreview
fi
exec apache2-foreground
