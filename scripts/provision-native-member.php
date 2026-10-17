<?php
/**
 * Operator-only native HumHub enrollment.
 *
 * This command deliberately has no HTTP route and no default identity. It accepts
 * one mode-0600 JSON file through UMMAH_MEMBER_INPUT_FILE and emits credential
 * material only as a browser-public-key encrypted hybrid envelope.
 */
declare(strict_types=1);

const UMMAH_ENROLL_PROJECT_ID = '48d7a4cf-07dc-489b-8a3d-d6d10142b14e';
const UMMAH_ENROLL_ENVIRONMENT_ID = '1f7d98bf-1d49-4d9f-a5cc-13b57abcc095';
const UMMAH_ENROLL_SERVICE_ID = 'e6498121-1725-4d5a-a66f-e0f1091d6d35';
const UMMAH_ENROLL_DB_NAME = 'ummah_humhub_staging';
const UMMAH_ENROLL_DB_USER = 'ummah_humhub_app';
const UMMAH_ENROLL_SPACE_NAME = 'UmmahConnect Staging Review';
const UMMAH_ENROLL_JOURNAL_DIR = '/var/lib/ummah-humhub/runtime/ummah-member-enrollments';
const UMMAH_ENROLL_TOKEN_TTL = 604800;

final class UmmahEnrollmentFailure extends RuntimeException
{
    public function __construct(public readonly string $statusCode)
    {
        parent::__construct('Native member enrollment rejected.');
    }
}

/** @return never */
function enrollmentReject(string $statusCode): never
{
    if (preg_match('/\A[a-z0-9_-]{1,80}\z/', $statusCode) !== 1) {
        $statusCode = 'internal';
    }
    throw new UmmahEnrollmentFailure($statusCode);
}

function enrollmentRequire(bool $condition, string $statusCode): void
{
    if (!$condition) {
        enrollmentReject($statusCode);
    }
}

function enrollmentLstat(string $path): array|false
{
    clearstatcache(true, $path);
    $stat = @lstat($path);
    if ($stat === false || !is_array($stat)) {
        return false;
    }
    return $stat;
}

function enrollmentIsRegularFile(array $stat): bool
{
    return (($stat['mode'] & 0170000) === 0100000) && (int)$stat['nlink'] === 1;
}

function enrollmentIsDirectory(array $stat): bool
{
    return (($stat['mode'] & 0170000) === 0040000);
}

function enrollmentAssertWwwData(): void
{
    enrollmentRequire(function_exists('posix_geteuid') && posix_geteuid() === 33, 'wrong_effective_user');
}

function enrollmentAssertOperatorEnvironment(): string
{
    enrollmentRequire(PHP_SAPI === 'cli', 'cli_required');
    enrollmentAssertWwwData();
    enrollmentRequire(getenv('UMMAH_REVIEW_ENVIRONMENT') === 'isolated-staging', 'environment_guard');
    enrollmentRequire(getenv('UMMAH_INITIALIZE_HUMHUB') === 'no', 'initialization_must_be_off');
    enrollmentRequire(getenv('RAILWAY_PROJECT_ID') === UMMAH_ENROLL_PROJECT_ID, 'project_guard');
    enrollmentRequire(getenv('RAILWAY_ENVIRONMENT_ID') === UMMAH_ENROLL_ENVIRONMENT_ID, 'environment_id_guard');
    enrollmentRequire(getenv('RAILWAY_SERVICE_ID') === UMMAH_ENROLL_SERVICE_ID, 'service_guard');
    enrollmentRequire(getenv('HUMHUB_DB_NAME') === UMMAH_ENROLL_DB_NAME, 'database_guard');
    enrollmentRequire(getenv('HUMHUB_DB_USER') === UMMAH_ENROLL_DB_USER, 'database_role_guard');
    enrollmentRequire(preg_match('/\A[-a-z0-9]+\.railway\.internal\z/D', (string)getenv('HUMHUB_DB_HOST')) === 1, 'database_host_guard');

    $configuredRoot = getenv('HUMHUB_ROOT');
    enrollmentRequire(is_string($configuredRoot) && $configuredRoot !== '', 'native_root_guard');
    $root = realpath($configuredRoot);
    enrollmentRequire($root !== false && is_dir($root) && !is_link($configuredRoot), 'native_root_guard');
    enrollmentRequire(is_file($root . '/protected/vendor/autoload.php')
        && is_file($root . '/protected/vendor/yiisoft/yii2/Yii.php')
        && is_file($root . '/protected/humhub/services/BootstrapService.php'), 'native_root_guard');

    return $root;
}

/** @return array<string,mixed> */
function enrollmentReadProtectedInput(): array
{
    $inputFile = getenv('UMMAH_MEMBER_INPUT_FILE');
    enrollmentRequire(is_string($inputFile) && $inputFile !== '' && is_absolute_path($inputFile), 'input_file_guard');
    $stat = enrollmentLstat($inputFile);
    enrollmentRequire($stat !== false && enrollmentIsRegularFile($stat), 'input_file_guard');
    enrollmentRequire(((int)$stat['mode'] & 0777) === 0600 && (int)$stat['nlink'] === 1, 'input_file_permissions');
    enrollmentRequire((int)$stat['size'] > 1 && (int)$stat['size'] <= 32768, 'input_file_size');

    $raw = @file_get_contents($inputFile);
    enrollmentRequire(is_string($raw), 'input_file_read');
    try {
        $decoded = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
    } catch (Throwable) {
        enrollmentReject('input_json');
    }
    enrollmentRequire(is_array($decoded), 'input_json');
    return $decoded;
}

function is_absolute_path(string $path): bool
{
    return str_starts_with($path, '/');
}

/** @return array{kind:string,subjectReference:string,email:string,role:string,displayName:string,publicKeyPem:string,spaceId:int} */
function enrollmentValidateInput(array $input): array
{
    $permitted = ['kind', 'subjectReference', 'email', 'role', 'displayName', 'publicKeyPem', 'spaceId'];
    foreach ($input as $key => $_value) {
        enrollmentRequire(is_string($key) && in_array($key, $permitted, true), 'input_fields');
    }
    foreach (['kind', 'subjectReference', 'email', 'role', 'publicKeyPem'] as $key) {
        enrollmentRequire(array_key_exists($key, $input), 'input_fields');
    }

    $kind = $input['kind'];
    $subjectReference = $input['subjectReference'];
    $email = $input['email'];
    $role = $input['role'];
    $displayName = $input['displayName'] ?? '';
    $publicKeyPem = $input['publicKeyPem'];
    $spaceId = $input['spaceId'] ?? 1;

    enrollmentRequire($kind === 'verified-ummah-member-enrollment', 'input_kind');
    enrollmentRequire(is_string($subjectReference) && preg_match('/\Agoogle:[A-Za-z0-9_-]{43}\z/D', $subjectReference) === 1, 'subject_reference');
    enrollmentRequire(is_string($email) && $email === trim($email) && strlen($email) <= 150
        && filter_var($email, FILTER_VALIDATE_EMAIL) !== false, 'email');
    enrollmentRequire(is_string($role) && in_array($role, ['author', 'reviewer'], true), 'role');
    enrollmentRequire(is_string($displayName) && strlen($displayName) <= 255 && !str_contains($displayName, "\0"), 'display_name');
    $displayName = trim($displayName);
    enrollmentRequire(is_string($publicKeyPem) && strlen($publicKeyPem) >= 256 && strlen($publicKeyPem) <= 16384, 'public_key');
    enrollmentRequire(is_int($spaceId) && $spaceId > 0, 'space_id');

    $key = @openssl_pkey_get_public($publicKeyPem);
    enrollmentRequire($key !== false, 'public_key');
    $details = openssl_pkey_get_details($key);
    unset($key); // PHP 8 OpenSSLAsymmetricKey objects release automatically.
    enrollmentRequire(is_array($details)
        && ($details['type'] ?? null) === OPENSSL_KEYTYPE_RSA
        && is_int($details['bits'] ?? null)
        && $details['bits'] >= 3072, 'public_key_strength');

    return [
        'kind' => $kind,
        'subjectReference' => $subjectReference,
        'email' => $email,
        'role' => $role,
        'displayName' => $displayName,
        'publicKeyPem' => $publicKeyPem,
        'spaceId' => $spaceId,
    ];
}

/** @return humhub\components\Application */
function enrollmentBootstrapNative(string $root): humhub\components\Application
{
    $_SERVER['SCRIPT_FILENAME'] = $root . '/index.php';
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_SERVER['HTTP_HOST'] = '127.0.0.1';
    $_SERVER['REQUEST_URI'] = '/';
    if (!defined('YII_DEBUG')) {
        define('YII_DEBUG', false);
    }
    if (!defined('YII_ENV')) {
        define('YII_ENV', 'prod');
    }
    require_once $root . '/protected/vendor/autoload.php';
    require_once $root . '/protected/vendor/yiisoft/yii2/Yii.php';
    Yii::setAlias('@humhub', $root . '/protected/humhub');

    $bootstrap = new humhub\services\BootstrapService();
    $config = $bootstrap->getConfig('web');
    $config['components']['user']['enableSession'] = false;
    $app = new humhub\components\Application($config);
    enrollmentRequire($app->user->identity === null, 'operator_identity_guard');
    enrollmentRequire((string)$app->db->username === UMMAH_ENROLL_DB_USER, 'database_role_guard');
    enrollmentRequire(preg_match('/(?:^|;)dbname=' . preg_quote(UMMAH_ENROLL_DB_NAME, '/') . '(?:;|$)/', (string)$app->db->dsn) === 1, 'database_guard');
    enrollmentRequire((string)$app->db->createCommand('SELECT DATABASE()')->queryScalar() === UMMAH_ENROLL_DB_NAME, 'database_guard');
    enrollmentRequire(str_starts_with((string)$app->db->createCommand('SELECT CURRENT_USER()')->queryScalar(), UMMAH_ENROLL_DB_USER . '@'), 'database_role_guard');
    return $app;
}

/** @return array{0:humhub\modules\space\models\Space,1:humhub\modules\rest\models\ConfigureForm} */
function enrollmentAssertNativePolicy(humhub\components\Application $app, int $spaceId): array
{
    enrollmentRequire($app->getModule('ummahreview') instanceof humhub\modules\ummahreview\Module, 'review_module_guard');
    enrollmentRequire($app->getModule('rest') instanceof humhub\modules\rest\Module, 'rest_module_guard');
    enrollmentRequire(in_array($spaceId, humhub\modules\ummahreview\Module::spaceIds(), true), 'moderated_space_guard');

    $space = humhub\modules\space\models\Space::findOne($spaceId);
    enrollmentRequire($space instanceof humhub\modules\space\models\Space, 'private_space_guard');
    enrollmentRequire($space->name === UMMAH_ENROLL_SPACE_NAME
        && (int)$space->status === humhub\modules\space\models\Space::STATUS_ENABLED
        && (int)$space->visibility === humhub\modules\space\models\Space::VISIBILITY_NONE
        && (int)$space->join_policy === humhub\modules\space\models\Space::JOIN_POLICY_NONE
        && (int)$space->auto_add_new_members === 0
        && (int)$space->default_content_visibility === humhub\modules\content\models\Content::VISIBILITY_PRIVATE
        && ($space->created_by === null || (int)$space->created_by === 0)
        && (int)$space->contentcontainer_id > 0, 'private_space_guard');
    $container = $space->contentContainerRecord;
    enrollmentRequire($container !== null && (int)$container->id === (int)$space->contentcontainer_id, 'content_container_guard');

    // A user model's native afterInsert() honors these flags. Refuse a topology
    // that could silently attach a new member to any additional community.
    enrollmentRequire(!(new yii\db\Query())->from('{{%space}}')->where(['auto_add_new_members' => 1])->exists(), 'autoadd_guard');

    $rest = humhub\modules\rest\models\ConfigureForm::getInstance();
    enrollmentRequire($rest->enableBearerAuth && !$rest->enableBasicAuth && !$rest->enableJwtAuth
        && !$rest->enableQueryParamAuth && !$rest->enabledForAllUsers
        && in_array('ummahreview', (array)$rest->apiModules, true), 'rest_policy_guard');

    return [$space, $rest];
}

function enrollmentJournalDirectory(): string
{
    $directory = UMMAH_ENROLL_JOURNAL_DIR;
    $stat = enrollmentLstat($directory);
    if ($stat === false) {
        enrollmentRequire(@mkdir($directory, 0700, true), 'journal_directory_create');
        $stat = enrollmentLstat($directory);
    }
    enrollmentRequire($stat !== false && enrollmentIsDirectory($stat), 'journal_directory_guard');
    enrollmentRequire(((int)$stat['mode'] & 0077) === 0 && (int)$stat['uid'] === 33 && is_writable($directory), 'journal_directory_permissions');
    return $directory;
}

/** @return resource */
function enrollmentAcquireJournalLock(string $directory)
{
    $lockPath = $directory . '/.enrollment.lock';
    $existing = enrollmentLstat($lockPath);
    if ($existing !== false) {
        enrollmentRequire(enrollmentIsRegularFile($existing) && ((int)$existing['mode'] & 0077) === 0, 'journal_lock_guard');
    }
    $handle = @fopen($lockPath, 'c+');
    enrollmentRequire(is_resource($handle), 'journal_lock_guard');
    @chmod($lockPath, 0600);
    $after = enrollmentLstat($lockPath);
    enrollmentRequire($after !== false && enrollmentIsRegularFile($after) && ((int)$after['mode'] & 0777) === 0600, 'journal_lock_guard');
    enrollmentRequire(@flock($handle, LOCK_EX), 'journal_lock_guard');
    return $handle;
}

function enrollmentAssertNewJournalPath(string $path): void
{
    $stat = enrollmentLstat($path);
    enrollmentRequire($stat === false, 'duplicate_enrollment');
}

/** @return array{path:string,dev:int,ino:int} */
function enrollmentWriteNewJournal(string $directory, string $referenceHash, array $entry): array
{
    enrollmentRequire(preg_match('/\A[a-f0-9]{64}\z/', $referenceHash) === 1, 'journal_path_guard');
    $path = $directory . '/' . $referenceHash;
    enrollmentAssertNewJournalPath($path);
    $temp = $directory . '/.' . $referenceHash . '.' . bin2hex(random_bytes(18)) . '.tmp';
    $handle = @fopen($temp, 'x');
    enrollmentRequire(is_resource($handle), 'journal_write');
    try {
        enrollmentRequire(@chmod($temp, 0600), 'journal_write');
        $json = json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
        enrollmentRequire(@fwrite($handle, $json) === strlen($json) && @fflush($handle), 'journal_write');
        if (function_exists('fsync')) {
            enrollmentRequire(@fsync($handle), 'journal_write');
        }
        enrollmentRequire(@fclose($handle), 'journal_write');
        $handle = null;
        // link() is create-only: unlike rename(), it cannot replace an entry
        // placed by an operator or another guarded process.
        enrollmentRequire(@link($temp, $path), 'duplicate_enrollment');
        enrollmentRequire(@unlink($temp), 'journal_write');
        $stat = enrollmentLstat($path);
        enrollmentRequire($stat !== false && enrollmentIsRegularFile($stat) && ((int)$stat['mode'] & 0777) === 0600, 'journal_write');
        return ['path' => $path, 'dev' => (int)$stat['dev'], 'ino' => (int)$stat['ino']];
    } catch (Throwable $error) {
        if (is_resource($handle)) {
            @fclose($handle);
        }
        @unlink($temp);
        throw $error;
    }
}

/** @param array{path:string,dev:int,ino:int}|null $journal */
function enrollmentRemoveOwnedJournal(?array $journal): void
{
    if ($journal === null) {
        return;
    }
    $stat = enrollmentLstat($journal['path']);
    if ($stat !== false && enrollmentIsRegularFile($stat)
        && (int)$stat['dev'] === $journal['dev'] && (int)$stat['ino'] === $journal['ino']) {
        @unlink($journal['path']);
    }
}

/** @return array{alg:string,wrappedKey:string,iv:string,tag:string,ciphertext:string} */
function enrollmentEncryptEnvelope(array $payload, string $publicKeyPem, string $directory): array
{
    $plaintext = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $symmetricKey = random_bytes(32);
    $iv = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $symmetricKey, OPENSSL_RAW_DATA, $iv, $tag, '', 16);
    enrollmentRequire(is_string($ciphertext) && strlen($tag) === 16, 'envelope_encrypt');

    $keyFile = $directory . '/.public-key-' . bin2hex(random_bytes(18)) . '.pem';
    $written = false;
    try {
        $handle = @fopen($keyFile, 'x');
        enrollmentRequire(is_resource($handle), 'envelope_encrypt');
        enrollmentRequire(@chmod($keyFile, 0600), 'envelope_encrypt');
        enrollmentRequire(@fwrite($handle, $publicKeyPem) === strlen($publicKeyPem) && @fflush($handle), 'envelope_encrypt');
        @fclose($handle);
        $written = true;

        $pipes = [];
        $process = @proc_open([
            'openssl', 'pkeyutl', '-encrypt', '-pubin', '-inkey', $keyFile,
            '-pkeyopt', 'rsa_padding_mode:oaep',
            '-pkeyopt', 'rsa_oaep_md:sha256',
            '-pkeyopt', 'rsa_mgf1_md:sha256',
        ], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes, null, null, ['bypass_shell' => true]);
        enrollmentRequire(is_resource($process), 'envelope_encrypt');
        enrollmentRequire(fwrite($pipes[0], $symmetricKey) === strlen($symmetricKey), 'envelope_encrypt');
        fclose($pipes[0]);
        $wrappedKey = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exit = proc_close($process);
        unset($stderr);
        enrollmentRequire($exit === 0 && is_string($wrappedKey) && strlen($wrappedKey) >= 384, 'envelope_encrypt');

        return [
            'alg' => 'RSA-OAEP-SHA256+A256GCM',
            'wrappedKey' => base64_encode($wrappedKey),
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'ciphertext' => base64_encode($ciphertext),
        ];
    } finally {
        if ($written || file_exists($keyFile)) {
            @unlink($keyFile);
        }
        if (function_exists('sodium_memzero')) {
            sodium_memzero($symmetricKey);
        }
    }
}

function enrollmentAssertUserHasNoAdminOrPassword(humhub\components\Application $app, humhub\modules\user\models\User $user): void
{
    $user->refresh();
    enrollmentRequire(!$user->isSystemAdmin(false), 'administrator_guard');
    $adminGroup = (new yii\db\Query())->from('{{%group_user}} gu')
        ->innerJoin('{{%group}} g', 'g.id = gu.group_id')
        ->where(['gu.user_id' => $user->id, 'g.is_admin_group' => 1])->exists();
    enrollmentRequire(!$adminGroup, 'administrator_guard');
    enrollmentRequire(!(new yii\db\Query())->from('{{%user_password}}')->where(['user_id' => $user->id])->exists(), 'password_guard');
    enrollmentRequire(!(new yii\db\Query())->from('{{%post}} p')
        ->innerJoin('{{%content}} c', 'c.object_id = p.id')
        ->where(['c.object_model' => humhub\modules\post\models\Post::class, 'c.created_by' => $user->id])->exists(), 'post_guard');
    enrollmentRequire(!(new yii\db\Query())->from('{{%ummah_review}}')
        ->where(['or', ['author_id' => $user->id], ['reviewer_id' => $user->id]])->exists(), 'review_guard');
}

/**
 * The optional beforeCommit callback exists solely for the guarded disposable
 * fixture rollback probe. The command-line path never supplies it.
 *
 * @param array<string,mixed> $input
 * @param array{beforeCommit?:callable}|array{} $options
 * @return array{alg:string,wrappedKey:string,iv:string,tag:string,ciphertext:string}
 */
function provisionNativeMember(array $input, array $options = []): array
{
    $root = enrollmentAssertOperatorEnvironment();
    $input = enrollmentValidateInput($input);
    $app = enrollmentBootstrapNative($root);
    [$space] = enrollmentAssertNativePolicy($app, $input['spaceId']);
    $directory = enrollmentJournalDirectory();
    $lock = enrollmentAcquireJournalLock($directory);
    $transaction = null;
    $journal = null;
    $tokenPlaintext = null;

    try {
        $referenceHash = hash('sha256', $input['subjectReference']);
        $journalPath = $directory . '/' . $referenceHash;
        enrollmentAssertNewJournalPath($journalPath);
        $username = 'ummah-' . substr($referenceHash, 0, 16);

        enrollmentRequire(!humhub\modules\user\models\User::find()->where(['or', ['email' => $input['email']], ['username' => $username]])->exists(), 'existing_user');
        enrollmentRequire(!(new yii\db\Query())->from('{{%user_invite}}')->where(['email' => $input['email']])->exists(), 'existing_invite');

        $transaction = $app->db->beginTransaction();
        try {
            $user = new humhub\modules\user\models\User([
                'username' => $username,
                'email' => $input['email'],
                'status' => humhub\modules\user\models\User::STATUS_ENABLED,
                'language' => '',
            ]);
            // Preserve native User lifecycle but prevent ambient default-group
            // assignment. In particular, no group can make this account admin.
            $user->allowAssignDefaultGroup(false);
            enrollmentRequire($user->save(), 'user_create');

            if ($input['displayName'] !== '') {
                $profile = new humhub\modules\user\models\Profile([
                    'user_id' => $user->id,
                    'firstname' => $input['displayName'],
                    'lastname' => '',
                ]);
                enrollmentRequire($profile->save(), 'profile_create');
            }

            enrollmentRequire(humhub\modules\space\models\Membership::findOne(['space_id' => $space->id, 'user_id' => $user->id]) === null, 'existing_membership');
            enrollmentRequire(!(new yii\db\Query())->from('{{%ummah_review_grant}}')
                ->where(['space_id' => $space->id, 'user_id' => $user->id])->exists(), 'existing_grant');
            enrollmentRequire($space->addMember((int)$user->id, 1, true, humhub\modules\space\models\Space::USERGROUP_MEMBER, false), 'membership_create');

            $membership = humhub\modules\space\models\Membership::findOne(['space_id' => $space->id, 'user_id' => $user->id]);
            enrollmentRequire($membership instanceof humhub\modules\space\models\Membership
                && (int)$membership->status === humhub\modules\space\models\Membership::STATUS_MEMBER
                && $membership->group_id === humhub\modules\space\models\Space::USERGROUP_MEMBER, 'membership_guard');
            enrollmentRequire((int)humhub\modules\space\models\Membership::find()->where(['user_id' => $user->id])->count() === 1, 'membership_scope_guard');

            $grant = [
                'space_id' => (int)$space->id,
                'user_id' => (int)$user->id,
                'can_submit' => $input['role'] === 'author' ? 1 : 0,
                'can_review' => $input['role'] === 'reviewer' ? 1 : 0,
            ];
            enrollmentRequire($app->db->createCommand()->insert('{{%ummah_review_grant}}', $grant)->execute() === 1, 'grant_create');
            $actualGrant = (new yii\db\Query())->from('{{%ummah_review_grant}}')->where([
                'space_id' => $space->id, 'user_id' => $user->id,
            ])->one();
            enrollmentRequire(is_array($actualGrant)
                && (int)$actualGrant['can_submit'] === $grant['can_submit']
                && (int)$actualGrant['can_review'] === $grant['can_review'], 'grant_guard');

            enrollmentRequire(humhub\modules\rest\models\RestUserBearerToken::findOne(['user_id' => $user->id]) === null, 'existing_token');
            $bearer = new humhub\modules\rest\models\RestUserBearerToken(['user_id' => $user->id]);
            $bearer->expiration = gmdate('Y-m-d H:i:s', time() + UMMAH_ENROLL_TOKEN_TTL);
            enrollmentRequire($bearer->save(false), 'token_create');
            // The native model's beforeSave() creates newToken and persists
            // only SHA-256(newToken); never manufacture a parallel token.
            $tokenPlaintext = $bearer->newToken;
            $tokenHash = (string)$bearer->token;
            enrollmentRequire(hash_equals((string)$bearer->token, $tokenHash)
                && is_string($tokenPlaintext) && $tokenPlaintext !== ''
                && hash_equals($tokenHash, hash('sha256', $tokenPlaintext))
                && strtotime((string)$bearer->expiration) > time() + 6 * 86400
                && strtotime((string)$bearer->expiration) <= time() + 8 * 86400, 'token_guard');

            enrollmentAssertUserHasNoAdminOrPassword($app, $user);
            $envelope = enrollmentEncryptEnvelope([
                'token' => $tokenPlaintext,
                'humhubUserId' => (int)$user->id,
                'subjectReference' => $input['subjectReference'],
                'role' => $input['role'],
            ], $input['publicKeyPem'], $directory);

            $journal = enrollmentWriteNewJournal($directory, $referenceHash, [
                'schemaVersion' => 1,
                'subjectReferenceHash' => $referenceHash,
                'humhubUserId' => (int)$user->id,
                'humhubUserGuid' => (string)$user->guid,
                'email' => $input['email'],
                'tokenHash' => $tokenHash,
                'role' => $input['role'],
                'spaceId' => (int)$space->id,
                'provenance' => [
                    'projectId' => UMMAH_ENROLL_PROJECT_ID,
                    'environmentId' => UMMAH_ENROLL_ENVIRONMENT_ID,
                    'serviceId' => UMMAH_ENROLL_SERVICE_ID,
                    'environment' => 'isolated-staging',
                    'operatorUid' => 33,
                    'createdAtUtc' => gmdate('c'),
                ],
            ]);

            if (isset($options['beforeCommit'])) {
                enrollmentRequire(getenv('UMMAH_NATIVE_FIXTURE') === 'sandbox-only' && is_callable($options['beforeCommit']), 'test_hook_guard');
                ($options['beforeCommit'])();
            }
            $transaction->commit();
            $transaction = null;
            // From this point the journal is the committed provenance record,
            // not a failed-attempt artifact. Do not remove it in finally.
            $journal = null;
            if (function_exists('sodium_memzero')) {
                sodium_memzero($tokenPlaintext);
            }
            $tokenPlaintext = null;
            return $envelope;
        } catch (Throwable $error) {
            if ($transaction !== null && $transaction->isActive) {
                $transaction->rollBack();
            }
            $transaction = null;
            enrollmentRemoveOwnedJournal($journal);
            $journal = null;
            throw $error;
        }
    } finally {
        if (is_string($tokenPlaintext) && function_exists('sodium_memzero')) {
            sodium_memzero($tokenPlaintext);
        }
        if ($transaction !== null && $transaction->isActive) {
            $transaction->rollBack();
        }
        enrollmentRemoveOwnedJournal($journal);
        @flock($lock, LOCK_UN);
        @fclose($lock);
    }
}

function enrollmentFailureCode(Throwable $error): string
{
    if ($error instanceof UmmahEnrollmentFailure) {
        return $error->statusCode;
    }
    if ($error instanceof yii\base\InvalidConfigException) {
        return 'native_configuration';
    }
    if ($error instanceof ErrorException) {
        return 'runtime_warning';
    }
    return 'internal';
}

function enrollmentMain(array $argv): int
{
    try {
        enrollmentRequire(count($argv) === 1, 'arguments');
        // Refuse before reading even a protected enrollment payload unless the
        // exact isolated native operator context is present.
        enrollmentAssertOperatorEnvironment();
        $input = enrollmentReadProtectedInput();
        $envelope = provisionNativeMember($input);
        // Do not add a status, user id, email, subject reference, role, or token
        // beside the encrypted envelope. This is the sole successful stdout path.
        echo json_encode(['envelope' => $envelope], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), PHP_EOL;
        return 0;
    } catch (Throwable $error) {
        echo json_encode(['ok' => false, 'code' => enrollmentFailureCode($error)], JSON_UNESCAPED_SLASHES), PHP_EOL;
        return 1;
    }
}

ini_set('display_errors', '0');
set_error_handler(static function (int $severity): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException('Native enrollment runtime warning.', 0, $severity);
});

if (!defined('UMMAH_MEMBER_PROVISION_LIBRARY')) {
    exit(enrollmentMain($argv));
}
