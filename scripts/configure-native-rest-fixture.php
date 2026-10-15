<?php
/**
 * Ephemeral CI fixture helper. It only accepts the isolated native fixture and
 * never provisions production users or exposes bearer material.
 */
if (getenv('UMMAH_REVIEW_ENVIRONMENT') !== 'isolated-staging' || getenv('UMMAH_NATIVE_FIXTURE') !== 'sandbox-only') {
    throw new RuntimeException('Explicit isolated native fixture required.');
}

$root = realpath(getenv('HUMHUB_ROOT') ?: '');
$fixtureFile = getenv('UMMAH_NATIVE_FIXTURE_FILE');
if (!$root || !$fixtureFile || !is_file($fixtureFile) || (fileperms($fixtureFile) & 0077)) {
    throw new RuntimeException('Protected native fixture required.');
}
$fixture = json_decode(file_get_contents($fixtureFile), true, 32, JSON_THROW_ON_ERROR);
if (($fixture['kind'] ?? '') !== 'native-humhub-sandbox-fixture' || !isset($fixture['accounts']) || count($fixture['accounts']) !== 3) {
    throw new RuntimeException('Refuse non-fixture accounts.');
}

$_SERVER['SCRIPT_FILENAME'] = $root . '/index.php';
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['HTTP_HOST'] = '127.0.0.1:3401';
$_SERVER['REQUEST_URI'] = '/';
define('YII_DEBUG', false);
define('YII_ENV', 'prod');
require $root . '/protected/vendor/autoload.php';
require $root . '/protected/vendor/yiisoft/yii2/Yii.php';
Yii::setAlias('@humhub', $root . '/protected/humhub');

$bootstrap = new humhub\services\BootstrapService();
$config = $bootstrap->getConfig('web');
$config['components']['user']['enableSession'] = false;
$app = new humhub\components\Application($config);

use humhub\modules\rest\models\ConfigureForm;
use humhub\modules\rest\models\RestUserBearerToken;
use humhub\modules\user\models\User;

$restModule = $app->getModule('rest');
if (!$restModule || !$app->getModule('ummahreview')) {
    throw new RuntimeException('Required native modules are not enabled.');
}

$enabledUserGuids = [];
foreach (['author', 'reviewer', 'excluded'] as $role) {
    $account = $fixture['accounts'][$role] ?? null;
    if (!is_array($account) || !isset($account['id'], $account['username'], $account['token'])) {
        throw new RuntimeException('Malformed fixture account.');
    }
    $user = User::findOne((int)$account['id']);
    if (!$user || $user->username !== 'ummah-' . $role) {
        throw new RuntimeException('Fixture identity mismatch.');
    }
    $bearer = RestUserBearerToken::findOne(['user_id' => $user->id]);
    if (!$bearer || !$bearer->token || !hash_equals($bearer->token, hash('sha256', (string)$account['token'])) || strtotime((string)$bearer->expiration) <= time()) {
        throw new RuntimeException('Fixture bearer token is unavailable.');
    }
    $enabledUserGuids[] = $user->guid;
}

// Bearer tokens themselves are per-user. The REST module documents that the
// enabled-user list applies only to Basic/JWT, which remain disabled here.
$form = ConfigureForm::getInstance();
$form->enableBearerAuth = true;
$form->enableBasicAuth = false;
$form->enableJwtAuth = false;
$form->enableQueryParamAuth = false;
$form->enabledForAllUsers = false;
$form->enabledUsers = $enabledUserGuids;
$form->apiModules = ['ummahreview'];
if (!$form->saveSettings()) {
    throw new RuntimeException('Fixture REST settings could not be saved.');
}

$verify = ConfigureForm::getInstance();
$modules = $restModule->settings->getSerialized('apiModules');
if (!$verify->enableBearerAuth || $verify->enableBasicAuth || $verify->enableJwtAuth || $verify->enableQueryParamAuth
    || $verify->enabledForAllUsers || !in_array('ummahreview', (array)$verify->apiModules, true)
    || empty($modules['ummahreview']) || count((array)$verify->enabledUsers) !== count($enabledUserGuids)) {
    throw new RuntimeException('Fixture REST settings verification failed.');
}

echo json_encode(['restConfigured' => true, 'fixtureUsers' => count($enabledUserGuids)]), "\n";
