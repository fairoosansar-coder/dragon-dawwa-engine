#!/bin/sh
set -eu
php /usr/local/bin/configure-humhub.php
cd /var/www/html/protected
if [ "${UMMAH_INITIALIZE_HUMHUB:-no}" = yes ]; then
  php yii installer/install-db
  php yii installer/write-site-config 'UmmahConnect isolated staging' 'no-mail@example.invalid'
  php yii module/enable rest
  php yii module/enable ummahreview
fi
php yii migrate/up --includeModuleMigrations=1 --interactive=0
chown -R www-data:www-data /var/lib/ummah-humhub/runtime /var/lib/ummah-humhub/uploads /var/www/html/assets
exec /usr/bin/supervisord -c /etc/supervisor/ummah-humhub.conf
