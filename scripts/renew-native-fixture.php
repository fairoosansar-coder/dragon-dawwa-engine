<?php
/** Renew local qualification credentials only; NEVER enroll real accounts. */
if (getenv('UMMAH_NATIVE_FIXTURE') !== 'sandbox-only' || getenv('UMMAH_REVIEW_ENVIRONMENT') !== 'isolated-staging') {
    throw new RuntimeException('Explicit isolated fixture required.');
}
$root = realpath(getenv('HUMHUB_ROOT') ?: '');
$file = getenv('UMMAH_NATIVE_FIXTURE_FILE');
if (!$root || !$file || !is_file($file) || (fileperms($file) & 0077)) { throw new RuntimeException('Existing private fixture required.'); }
$fixture = json_decode(file_get_contents($file), true, 16, JSON_THROW_ON_ERROR);
if (($fixture['kind'] ?? '') !== 'native-humhub-sandbox-fixture') { throw new RuntimeException('Refuse non-fixture data.'); }
$_SERVER['SCRIPT_FILENAME'] = $root . '/index.php'; $_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['HTTP_HOST'] = '127.0.0.1:3401'; $_SERVER['REQUEST_URI'] = '/';
define('YII_DEBUG', false); define('YII_ENV', 'prod');
require $root . '/protected/vendor/autoload.php'; require $root . '/protected/vendor/yiisoft/yii2/Yii.php';
Yii::setAlias('@humhub', $root . '/protected/humhub');
$config = (new humhub\services\BootstrapService())->getConfig('web');
$config['components']['user']['enableSession'] = false;
$app = new humhub\components\Application($config);
use humhub\modules\user\models\User;
use humhub\modules\rest\models\RestUserBearerToken;
foreach (['author', 'reviewer', 'excluded'] as $role) {
    $user = User::findOne($fixture['accounts'][$role]['id'] ?? 0);
    if (!$user || $user->username !== 'ummah-' . $role || $user->email !== $role . '@example.invalid' || (int)$user->status !== User::STATUS_ENABLED) {
        throw new RuntimeException('Refuse non-fixture or disabled identity.');
    }
    $token = RestUserBearerToken::findOne(['user_id' => $user->id]);
    if (!$token) { throw new RuntimeException('Existing fixture token required.'); }
    $token->newToken = Yii::$app->security->generateRandomString(86);
    $token->token = hash('sha256', $token->newToken);
    $token->expiration = gmdate('Y-m-d H:i:s', time() + 7200);
    if (!$token->save(false)) { throw new RuntimeException('Fixture renewal failed.'); }
    $fixture['accounts'][$role]['token'] = $token->newToken;
}
$tmp = $file . '.renew-' . bin2hex(random_bytes(8));
$old = umask(0077);
file_put_contents($tmp, json_encode($fixture, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
chmod($tmp, 0600); rename($tmp, $file); umask($old);
echo "Synthetic native tokens renewed; no memberships, grants, posts or passwords changed.\n";
