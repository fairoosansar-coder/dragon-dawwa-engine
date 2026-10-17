FROM docker.io/library/composer:2.7.1@sha256:da5213f1c0c4db435ad335be4e782ebf8677b45d37677a6db1e73e474c7ad947 AS composer
FROM docker.io/library/php:8.3-apache@sha256:f8506a19d79cad7fcf0c8049f1ed2208824961018fdc10bd80f324094dcd36bd
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip git patch supervisor libpng-dev libjpeg62-turbo-dev libfreetype6-dev libwebp-dev libicu-dev libzip-dev libldap2-dev libonig-dev && docker-php-ext-configure gd --with-jpeg --with-freetype --with-webp && docker-php-ext-install pdo_mysql gd intl zip ldap mbstring bcmath exif pcntl && php -r '$g=gd_info(); if(empty($g["JPEG Support"])||empty($g["PNG Support"])||empty($g["WebP Support"])||empty($g["FreeType Support"])) exit(1);' && a2enmod rewrite && rm -rf /var/lib/apt/lists/*
COPY --from=composer /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html
RUN curl --fail --location --retry 2 https://codeload.github.com/humhub/humhub/tar.gz/8f22a72361841404b3b442306126650fc0f8153b -o /tmp/core.tar.gz && echo '7bd1806389e080c0f1b963fb8d70aae1c5664bcea19a22fc562499b6db14f973  /tmp/core.tar.gz' | sha256sum -c - && tar -xzf /tmp/core.tar.gz --strip-components=1 && rm /tmp/core.tar.gz
COPY deployment/staging/download-rest.php /tmp/download-rest.php
COPY deployment/staging/upstream-lock.json /tmp/upstream-lock.json
RUN php /tmp/download-rest.php && composer install --no-dev --prefer-dist --no-interaction && rm /tmp/download-rest.php
COPY scripts/apply-humhub-review-hooks.php /opt/ummah/scripts/apply-humhub-review-hooks.php
COPY integrations/social/humhub-ummahreview/core-hooks /opt/ummah/integrations/social/humhub-ummahreview/core-hooks
RUN php /opt/ummah/scripts/apply-humhub-review-hooks.php --runtime=/var/www/html && rm -rf /opt/ummah
COPY integrations/social/humhub-ummahreview protected/modules/ummahreview
COPY deployment/staging/humhub-apache.conf /etc/apache2/conf-enabled/ummah-isolated.conf
COPY deployment/staging/configure-humhub.php /usr/local/bin/configure-humhub.php
COPY deployment/staging/bootstrap-private-humhub.php /usr/local/bin/bootstrap-private-humhub.php
COPY deployment/staging/start-humhub.sh /usr/local/bin/start-humhub
COPY deployment/staging/humhub-cron.sh /usr/local/bin/ummah-humhub-cron
COPY deployment/staging/humhub-supervisor.conf /etc/supervisor/ummah-humhub.conf
RUN chmod 755 /usr/local/bin/start-humhub /usr/local/bin/ummah-humhub-cron && mkdir -p /var/lib/ummah-humhub && chown -R www-data:www-data /var/www/html /var/lib/ummah-humhub && chmod 755 /var/www/html
EXPOSE 80
CMD ["/usr/local/bin/start-humhub"]
