#!/bin/sh
set -eu
php /usr/local/bin/configure-humhub.php
cd /var/www/html/protected
private_bootstrap="${UMMAH_BOOTSTRAP_PRIVATE_EMPTY:-no}"
if [ "${UMMAH_INITIALIZE_HUMHUB:-no}" = yes ]; then
  if [ "$private_bootstrap" = yes ]; then
    php /usr/local/bin/bootstrap-private-humhub.php --assert-empty
  fi
  php yii installer/install-db
  php yii installer/write-site-config 'UmmahConnect isolated staging' 'no-mail@example.invalid'
  if [ "$private_bootstrap" = yes ]; then
    php /usr/local/bin/bootstrap-private-humhub.php --create
    UMMAH_REVIEW_SPACE_IDS="$(php /usr/local/bin/bootstrap-private-humhub.php --space-id)"
    export UMMAH_REVIEW_SPACE_IDS
    php yii cache/flush-all
  fi
  php yii module/enable rest
  php yii module/enable ummahreview
elif [ "$private_bootstrap" = yes ]; then
  UMMAH_REVIEW_SPACE_IDS="$(php /usr/local/bin/bootstrap-private-humhub.php --space-id)"
  export UMMAH_REVIEW_SPACE_IDS
fi
# Bootstrap's discovery-only CLI allowance never reaches Apache, queue or cron.
unset UMMAH_BOOTSTRAP_PRIVATE_EMPTY
php yii migrate/up --includeModuleMigrations=1 --interactive=0
if [ "$private_bootstrap" = yes ]; then
  php /usr/local/bin/bootstrap-private-humhub.php --verify
fi
chown -R www-data:www-data /var/lib/ummah-humhub/runtime /var/lib/ummah-humhub/uploads /var/www/html/assets
exec /usr/bin/supervisord -c /etc/supervisor/ummah-humhub.conf
