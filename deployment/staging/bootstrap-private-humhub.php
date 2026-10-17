<?php
/** Account-free isolated initialization. Never creates users, posts, tokens or grants. */
declare(strict_types=1);
define('YII_ENABLE_ERROR_HANDLER', false);
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) return false;
    throw new ErrorException($message, 0, $severity, $file, $line);
});
set_exception_handler(static function (Throwable $error): void {
    $message = $error->getMessage();
    foreach (['HUMHUB_DB_PASSWORD', 'HUMHUB_COOKIE_KEY', 'MYSQL_PASSWORD', 'MYSQL_ROOT_PASSWORD'] as $key) {
        $secret = getenv($key); if ($secret) $message = str_replace($secret, '[redacted]', $message);
    }
    $trace = array_map(static fn(array $frame): array => ['file' => basename($frame['file'] ?? ''), 'line' => $frame['line'] ?? 0], array_slice($error->getTrace(), 0, 5));
    fwrite(STDERR, json_encode(['kind' => 'private-bootstrap-error', 'errorClass' => get_class($error),
        'message' => substr($message, 0, 700), 'file' => basename($error->getFile()), 'line' => $error->getLine(), 'trace' => $trace]) . "\n");
    exit(1);
});
const PRIVATE_COMMUNITY = 'UmmahConnect Staging Review';
const STAGING_PROJECT = '48d7a4cf-07dc-489b-8a3d-d6d10142b14e';
const STAGING_ENVIRONMENT = '1f7d98bf-1d49-4d9f-a5cc-13b57abcc095';
const STATE_FILE = '/var/lib/ummah-humhub/private-community.json';
function rejectBootstrap(): never { throw new RuntimeException('Private staging bootstrap precondition failed.'); }
if (PHP_SAPI !== 'cli' || getenv('UMMAH_REVIEW_ENVIRONMENT') !== 'isolated-staging'
    || getenv('RAILWAY_PROJECT_ID') !== STAGING_PROJECT || getenv('RAILWAY_ENVIRONMENT_ID') !== STAGING_ENVIRONMENT
    || getenv('HUMHUB_DB_NAME') !== 'ummah_humhub_staging' || getenv('HUMHUB_DB_USER') !== 'ummah_humhub_app') rejectBootstrap();
$mode = $argv[1] ?? '';
if (!in_array($mode, ['--assert-empty', '--create', '--space-id', '--verify'], true)) rejectBootstrap();
if ($mode === '--assert-empty') {
    if (getenv('UMMAH_BOOTSTRAP_PRIVATE_EMPTY') !== 'yes' || getenv('UMMAH_INITIALIZE_HUMHUB') !== 'yes') rejectBootstrap();
    $host = getenv('HUMHUB_DB_HOST');
    if (!is_string($host) || !preg_match('/^[A-Za-z0-9.-]+$/D', $host)) rejectBootstrap();
    $pdo = new PDO('mysql:host=' . $host . ';port=3306;dbname=ummah_humhub_staging;charset=utf8mb4',
        'ummah_humhub_app', getenv('HUMHUB_DB_PASSWORD'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    // Match the qualified private MySQL startup; no SUPER grant or weaker trigger policy.
    if ((int)$pdo->query('SELECT @@log_bin')->fetchColumn() !== 0) rejectBootstrap();
    foreach (['user', 'user_password', 'post', 'space_membership', 'ummah_review', 'ummah_review_grant', 'ummah_review_event'] as $table) {
        $exists = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');
        $exists->execute([$table]);
        if ((int)$exists->fetchColumn() && (int)$pdo->query('SELECT COUNT(*) FROM `' . $table . '`')->fetchColumn() !== 0) rejectBootstrap();
    }
    echo "Private first-boot database is account/content/grant empty.\n"; exit(0);
}
function readPrivateMarker(): array {
    if (!is_file(STATE_FILE) || is_link(STATE_FILE)) rejectBootstrap();
    $state = json_decode(file_get_contents(STATE_FILE), true, 16, JSON_THROW_ON_ERROR);
    if (($state['schemaVersion'] ?? null) !== 1 || ($state['projectId'] ?? '') !== STAGING_PROJECT
        || ($state['environmentId'] ?? '') !== STAGING_ENVIRONMENT || ($state['communityName'] ?? '') !== PRIVATE_COMMUNITY
        || !is_int($state['spaceId'] ?? null) || $state['spaceId'] < 1) rejectBootstrap();
    return $state;
}
// Read the protected operator-created marker before any module discovery.
if ($mode === '--space-id') { echo readPrivateMarker()['spaceId'], "\n"; exit(0); }
$root = realpath(getenv('HUMHUB_ROOT') ?: '/var/www/html');
if (!$root || !is_file($root . '/protected/vendor/autoload.php')) rejectBootstrap();
$_SERVER['SCRIPT_FILENAME'] = $root . '/index.php'; $_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['HTTP_HOST'] = 'ummah-humhub-staging.up.railway.app'; $_SERVER['REQUEST_URI'] = '/';
define('YII_DEBUG', false); define('YII_ENV', 'prod');
require $root . '/protected/vendor/autoload.php';
require $root . '/protected/vendor/yiisoft/yii2/Yii.php';
Yii::setAlias('@humhub', $root . '/protected/humhub');
$bootstrap = new humhub\services\BootstrapService();
$config = $bootstrap->getConfig('web'); $config['components']['user']['enableSession'] = false;
$app = new humhub\components\Application($config);
use humhub\modules\space\models\Space;
use humhub\modules\space\models\Membership;
use humhub\modules\content\models\Content;
use humhub\modules\post\models\Post;
use humhub\modules\user\models\User;
use humhub\modules\rest\models\ConfigureForm;
use yii\db\Query;
if (!str_contains($app->db->dsn, 'dbname=ummah_humhub_staging') || $app->db->username !== 'ummah_humhub_app') rejectBootstrap();
if ($mode === '--create') {
    if (getenv('UMMAH_BOOTSTRAP_PRIVATE_EMPTY') !== 'yes' || $app->user->identity !== null
        || (int)User::find()->count() !== 0 || (int)Post::find()->count() !== 0
        || (int)Membership::find()->count() !== 0) rejectBootstrap();
    $tx = $app->db->beginTransaction();
    try {
        $settings = $app->getModule('user')->settings;
        foreach (['auth.allowGuestAccess', 'auth.anonymousRegistration', 'auth.internalUsersCanInviteByEmail', 'auth.internalUsersCanInviteByLink'] as $key) $settings->set($key, '0');
        $settings->set('auth.needApproval', '1');
        $app->settings->set('baseUrl', 'https://ummah-humhub-staging.up.railway.app');
        $spaces = Space::find()->all();
        if (count($spaces) > 1 || ($spaces && $spaces[0]->name !== PRIVATE_COMMUNITY)) rejectBootstrap();
        $space = $spaces[0] ?? new Space(['name' => PRIVATE_COMMUNITY,
            'description' => 'Private staging review; no public access or automatic scholarly verification.',
            'visibility' => Space::VISIBILITY_NONE, 'join_policy' => Space::JOIN_POLICY_NONE,
            'default_content_visibility' => Content::VISIBILITY_PRIVATE,
            'auto_add_new_members' => 0, 'status' => Space::STATUS_ENABLED, 'color' => '#059669']);
        if ($space->isNewRecord) {
            // Native checkVisibility authorizes a logged-in human, which is
            // deliberately absent at first boot. Replace ONLY that validator
            // on this new instance with the stricter operator CLI contract.
            // Never change core/global validators, impersonate a user, skip
            // other field validation, or save a subclass as the container type.
            if (getenv('UMMAH_INITIALIZE_HUMHUB') !== 'yes'
                || $space->visibility !== Space::VISIBILITY_NONE
                || $space->join_policy !== Space::JOIN_POLICY_NONE
                || $space->default_content_visibility !== Content::VISIBILITY_PRIVATE
                || $space->auto_add_new_members !== 0) rejectBootstrap();
            $permissionValidators = [];
            foreach ($space->getValidators() as $index => $validator) {
                if ($validator instanceof yii\validators\InlineValidator
                    && $validator->method === [$space, 'checkVisibility']
                    && $validator->attributes === ['visibility']) $permissionValidators[$index] = $validator;
            }
            if (count($permissionValidators) !== 1) rejectBootstrap();
            $space->getValidators()->offsetUnset(array_key_first($permissionValidators));
            if (!$space->save()) throw new RuntimeException('Native private-space validation failed for attributes: '
                . implode(', ', array_keys($space->getErrors())));
        }
        if ($space->created_by !== null && (int)$space->created_by !== 0) rejectBootstrap();
        if ((int)$space->visibility !== Space::VISIBILITY_NONE || (int)$space->join_policy !== Space::JOIN_POLICY_NONE
            || (int)$space->auto_add_new_members !== 0 || (int)$space->default_content_visibility !== Content::VISIBILITY_PRIVATE) rejectBootstrap();
        $tx->commit();
    } catch (Throwable $error) { if ($tx->isActive) $tx->rollBack(); throw $error; }
    $state = ['schemaVersion' => 1, 'projectId' => STAGING_PROJECT, 'environmentId' => STAGING_ENVIRONMENT,
        'communityName' => PRIVATE_COMMUNITY, 'spaceId' => (int)$space->id, 'contentContainerId' => (int)$space->contentcontainer_id,
        'createdAtUtc' => gmdate('c'), 'usersCreated' => 0, 'postsCreated' => 0, 'grantsCreated' => 0];
    if (is_file(STATE_FILE)) {
        $prior = readPrivateMarker(); if ($prior['spaceId'] !== $state['spaceId']) rejectBootstrap();
    } else {
        $old = umask(0077); $temp = STATE_FILE . '.tmp';
        if (file_put_contents($temp, json_encode($state, JSON_PRETTY_PRINT) . "\n") === false || !rename($temp, STATE_FILE)) rejectBootstrap();
        umask($old); chmod(STATE_FILE, 0600);
    }
    echo json_encode(['kind' => 'native-private-account-free-bootstrap', 'spaceId' => $state['spaceId'],
        'communityName' => PRIVATE_COMMUNITY, 'usersCreated' => 0, 'postsCreated' => 0, 'grantsCreated' => 0]), "\n";
    exit(0);
}
$state = readPrivateMarker(); $space = Space::findOne($state['spaceId']);
if (!$space || $space->name !== PRIVATE_COMMUNITY || (int)$space->status !== Space::STATUS_ENABLED
    || (int)$space->visibility !== Space::VISIBILITY_NONE || (int)$space->join_policy !== Space::JOIN_POLICY_NONE
    || (int)$space->default_content_visibility !== Content::VISIBILITY_PRIVATE || (int)$space->auto_add_new_members !== 0
    || !in_array((int)$space->id, humhub\modules\ummahreview\Module::spaceIds(), true)) rejectBootstrap();
$settings = $app->getModule('user')->settings;
foreach (['auth.allowGuestAccess', 'auth.anonymousRegistration', 'auth.internalUsersCanInviteByEmail', 'auth.internalUsersCanInviteByLink'] as $key) {
    if ((string)$settings->get($key) !== '0') rejectBootstrap();
}
if ((string)$settings->get('auth.needApproval') !== '1') rejectBootstrap();
if (!(new Query())->from('{{%module_enabled}}')->where(['module_id' => 'ummahreview'])->exists()) rejectBootstrap();
$rest = ConfigureForm::getInstance();
// Configure only explicit bearer/API policies, never broad user enrollment.
if ((int)User::find()->count() === 0) {
    $rest->enableBearerAuth = true; $rest->enableBasicAuth = false; $rest->enableJwtAuth = false;
    $rest->enableQueryParamAuth = false; $rest->enabledForAllUsers = false; $rest->enabledUsers = [];
    $rest->apiModules = ['ummahreview', 'space']; $rest->saveSettings();
} elseif (!$rest->enableBearerAuth || $rest->enableBasicAuth || $rest->enableJwtAuth
    || $rest->enableQueryParamAuth || $rest->enabledForAllUsers) rejectBootstrap();
echo json_encode(['kind' => 'native-private-bootstrap-verification', 'communityName' => PRIVATE_COMMUNITY,
    'spaceId' => (int)$space->id, 'contentContainerId' => (int)$space->contentcontainer_id,
    'users' => (int)User::find()->count(), 'memberships' => (int)Membership::find()->count(),
    'posts' => (int)Post::find()->count(), 'grants' => (int)(new Query())->from('{{%ummah_review_grant}}')->count(),
    'reviews' => (int)(new Query())->from('{{%ummah_review}}')->count(), 'guestAccess' => false,
    'registration' => false, 'autoJoin' => false, 'basicJwtQueryAuth' => false, 'bearerOnly' => true]), "\n";
