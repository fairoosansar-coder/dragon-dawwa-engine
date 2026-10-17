<?php
declare(strict_types=1);

/**
 * Native-container-only runtime boundary probe.
 *
 * Usage:
 *   docker exec --user www-data \
 *     --env UMMAH_NATIVE_FIXTURE=sandbox-only \
 *     --env HUMHUB_ROOT=/var/www/html \
 *     --env UMMAH_REVIEW_ENVIRONMENT=isolated-staging \
 *     --env RAILWAY_PROJECT_ID=48d7a4cf-07dc-489b-8a3d-d6d10142b14e \
 *     --env RAILWAY_ENVIRONMENT_ID=1f7d98bf-1d49-4d9f-a5cc-13b57abcc095 \
 *     <humhub-container> php /tmp/test-native-runtime-boundary.php [--standard]
 *
 *   # Optional explicit cache-persistence pair around stop/remove/recreate.
 *   # The write command leaves only a random, non-sensitive cache sentinel;
 *   # verify checks it after recreation and deletes it.
 *   ... php /tmp/test-native-runtime-boundary.php --write-persistent
 *   ... php /tmp/test-native-runtime-boundary.php --verify-persistent
 *
 * Check counts: standard=11, write-persistent=10, verify-persistent=10.
 * This probe is deliberately guard-only: it does not touch users, content,
 * grants, notifications, HTTP routes, or a hosted/local runtime.
 */

const EXPECTED_ROOT = '/var/www/html';
const EXPECTED_RUNTIME = '/var/lib/ummah-humhub/runtime';
const EXPECTED_PROJECT_ID = '48d7a4cf-07dc-489b-8a3d-d6d10142b14e';
const EXPECTED_ENVIRONMENT_ID = '1f7d98bf-1d49-4d9f-a5cc-13b57abcc095';
const BOOTSTRAP5_CATEGORY = 'yii/bootstrap5';
const BOOTSTRAP5_BASE_PATH = '@vendor/yiisoft/yii2-bootstrap5/src/messages';
const PERSISTENT_MANIFEST_KEY = 'ummah.native.runtime-boundary.persistent.manifest.v1';
const PERSISTENT_TTL_SECONDS = 900;

final class RuntimeBoundaryFailure extends RuntimeException
{
    public function __construct(
        public readonly string $check,
        public readonly string $failureClass = 'assertion-failed'
    ) {
        parent::__construct('Native runtime boundary probe failed.');
    }
}

/** @return never */
function failProbe(string $check, string $failureClass = 'assertion-failed'): never
{
    throw new RuntimeBoundaryFailure($check, $failureClass);
}

function requireProbe(bool $condition, string $check, string $failureClass = 'assertion-failed'): void
{
    if (!$condition) {
        failProbe($check, $failureClass);
    }
}

function safeCheckName(string $check): string
{
    return preg_match('/\A[a-z0-9_-]{1,80}\z/', $check) === 1 ? $check : 'internal';
}

function safeFailureClass(Throwable $error): string
{
    if ($error instanceof RuntimeBoundaryFailure) {
        return $error->failureClass;
    }

    if (is_a($error, 'yii\\base\\InvalidConfigException')) {
        return 'invalid-config';
    }

    if (is_a($error, 'yii\\base\\UnknownPropertyException')) {
        return 'invalid-property';
    }

    if ($error instanceof ErrorException) {
        return 'runtime-warning';
    }

    return 'unexpected-error';
}

function printFailure(string $check, string $failureClass): int
{
    // Do not serialize exception messages, paths, command arguments, or env values.
    echo json_encode([
        'ok' => false,
        'check' => safeCheckName($check),
        'failureClass' => safeCheckName($failureClass),
    ], JSON_UNESCAPED_SLASHES), PHP_EOL;

    return 1;
}

function printUsage(): void
{
    echo "Usage: php scripts/test-native-runtime-boundary.php [--standard|--write-persistent|--verify-persistent]\n";
    echo "Container requirements: --user www-data; UMMAH_NATIVE_FIXTURE=sandbox-only; HUMHUB_ROOT=/var/www/html; UMMAH_REVIEW_ENVIRONMENT=isolated-staging; pinned Railway project/environment IDs.\n";
    echo "Check counts: standard=11, write-persistent=10, verify-persistent=10.\n";
}

function modeFromArguments(array $arguments): string
{
    $modes = [];
    foreach (array_slice($arguments, 1) as $argument) {
        if ($argument === '--help' || $argument === '-h') {
            printUsage();
            exit(0);
        }

        if (in_array($argument, ['--standard', '--write-persistent', '--verify-persistent'], true)) {
            $modes[] = $argument;
            continue;
        }

        failProbe('arguments', 'invalid-arguments');
    }

    requireProbe(count($modes) <= 1, 'arguments', 'invalid-arguments');

    return match ($modes[0] ?? '--standard') {
        '--write-persistent' => 'write-persistent',
        '--verify-persistent' => 'verify-persistent',
        default => 'standard',
    };
}

function isContainerRuntime(): bool
{
    if (is_file('/.dockerenv') || is_file('/run/.containerenv')) {
        return true;
    }

    $cgroup = @file_get_contents('/proc/1/cgroup');
    return is_string($cgroup) && preg_match('/(?:docker|containerd|kubepods|podman)/i', $cgroup) === 1;
}

function assertIsolationGuards(): void
{
    requireProbe(PHP_SAPI === 'cli', 'isolation_guards', 'isolation-required');
    requireProbe(isContainerRuntime(), 'isolation_guards', 'isolation-required');
    requireProbe(getenv('UMMAH_NATIVE_FIXTURE') === 'sandbox-only', 'isolation_guards', 'isolation-required');
    requireProbe(getenv('HUMHUB_ROOT') === EXPECTED_ROOT, 'isolation_guards', 'isolation-required');
    requireProbe(getenv('UMMAH_REVIEW_ENVIRONMENT') === 'isolated-staging', 'isolation_guards', 'isolation-required');
    requireProbe(getenv('RAILWAY_PROJECT_ID') === EXPECTED_PROJECT_ID, 'isolation_guards', 'isolation-required');
    requireProbe(getenv('RAILWAY_ENVIRONMENT_ID') === EXPECTED_ENVIRONMENT_ID, 'isolation_guards', 'isolation-required');
    requireProbe(realpath(EXPECTED_ROOT) === EXPECTED_ROOT, 'isolation_guards', 'isolation-required');
    requireProbe(is_file(EXPECTED_ROOT . '/protected/vendor/autoload.php'), 'isolation_guards', 'isolation-required');
    requireProbe(is_file(EXPECTED_ROOT . '/protected/humhub/services/BootstrapService.php'), 'isolation_guards', 'isolation-required');
}

function assertEffectiveWwwDataUid(): void
{
    requireProbe(function_exists('posix_geteuid') && function_exists('posix_getpwuid'), 'effective_uid', 'uid-unavailable');

    $entry = posix_getpwuid(posix_geteuid());
    requireProbe(is_array($entry) && ($entry['name'] ?? null) === 'www-data', 'effective_uid', 'wrong-effective-user');
}

function isInsideDirectory(string $path, string $directory): bool
{
    $normalizedPath = rtrim($path, '/');
    $normalizedDirectory = rtrim($directory, '/');

    return $normalizedPath !== $normalizedDirectory
        && str_starts_with($normalizedPath . '/', $normalizedDirectory . '/');
}

/** @return humhub\components\Application */
function bootstrapNativeApplication(): \humhub\components\Application
{
    $_SERVER['SCRIPT_FILENAME'] = EXPECTED_ROOT . '/index.php';
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_SERVER['HTTP_HOST'] = '127.0.0.1:3401';
    $_SERVER['REQUEST_URI'] = '/';
    if (!defined('YII_DEBUG')) define('YII_DEBUG', false);
    if (!defined('YII_ENV')) define('YII_ENV', 'prod');
    require EXPECTED_ROOT . '/protected/vendor/autoload.php';
    require EXPECTED_ROOT . '/protected/vendor/yiisoft/yii2/Yii.php';

    Yii::setAlias('@humhub', EXPECTED_ROOT . '/protected/humhub');

    // Match the existing native model/fixture scripts' web application initialization.
    $bootstrap = new humhub\services\BootstrapService();
    $config = $bootstrap->getConfig('web');
    $config['components']['user']['enableSession'] = false;

    return new humhub\components\Application($config);
}

/** @param array<string, bool> $checks */
function exerciseTransientCache(yii\caching\FileCache $cache, array &$checks): void
{
    $key = 'ummah.native.runtime-boundary.transient.' . bin2hex(random_bytes(18));
    $value = [
        'kind' => 'runtime-boundary-transient',
        'nonce' => bin2hex(random_bytes(18)),
    ];
    $deleted = false;

    try {
        $checks['cache_sentinel_write'] = $cache->set($key, $value, 60) === true;
        requireProbe($checks['cache_sentinel_write'], 'cache_sentinel_write', 'cache-operation');

        $read = $cache->get($key);
        $checks['cache_sentinel_read'] = is_array($read)
            && isset($read['kind'], $read['nonce'])
            && $read['kind'] === $value['kind']
            && is_string($read['nonce'])
            && hash_equals($value['nonce'], $read['nonce']);
        requireProbe($checks['cache_sentinel_read'], 'cache_sentinel_read', 'cache-operation');

        $deleted = $cache->delete($key) === true;
        $checks['cache_sentinel_delete'] = $deleted && $cache->get($key) === false;
        requireProbe($checks['cache_sentinel_delete'], 'cache_sentinel_delete', 'cache-operation');
    } finally {
        // A failed assertion must not leave the ephemeral sentinel in the volume.
        if (!$deleted) {
            $cache->delete($key);
        }
    }
}

function isPersistentKey(string $key): bool
{
    return preg_match('/\Aummah\.native\.runtime-boundary\.persistent\.[a-f0-9]{36}\z/', $key) === 1;
}

/** @param array<string, bool> $checks */
function writePersistentCacheSentinel(yii\caching\FileCache $cache, array &$checks): void
{
    $oldManifest = $cache->get(PERSISTENT_MANIFEST_KEY);
    if (is_array($oldManifest) && isset($oldManifest['cacheKey']) && is_string($oldManifest['cacheKey']) && isPersistentKey($oldManifest['cacheKey'])) {
        $cache->delete($oldManifest['cacheKey']);
    }
    $cache->delete(PERSISTENT_MANIFEST_KEY);

    $id = bin2hex(random_bytes(18));
    $key = 'ummah.native.runtime-boundary.persistent.' . $id;
    $nonce = bin2hex(random_bytes(18));
    $value = ['kind' => 'runtime-boundary-persistent', 'id' => $id, 'nonce' => $nonce];
    $manifest = [
        'version' => 1,
        'cacheKey' => $key,
        'id' => $id,
        'nonceHash' => hash('sha256', $nonce),
        'createdAt' => time(),
    ];
    $written = false;

    try {
        $written = $cache->set($key, $value, PERSISTENT_TTL_SECONDS) === true
            && $cache->set(PERSISTENT_MANIFEST_KEY, $manifest, PERSISTENT_TTL_SECONDS) === true;
        $checks['persistent_sentinel_write'] = $written;
        requireProbe($written, 'persistent_sentinel_write', 'cache-operation');

        $read = $cache->get($key);
        $checks['persistent_sentinel_read'] = is_array($read)
            && ($read['kind'] ?? null) === $value['kind']
            && ($read['id'] ?? null) === $id
            && is_string($read['nonce'] ?? null)
            && hash_equals($nonce, $read['nonce']);
        requireProbe($checks['persistent_sentinel_read'], 'persistent_sentinel_read', 'cache-operation');
    } finally {
        if (!$written) {
            $cache->delete($key);
            $cache->delete(PERSISTENT_MANIFEST_KEY);
        }
    }
}

/** @param array<string, bool> $checks */
function verifyPersistentCacheSentinel(yii\caching\FileCache $cache, array &$checks): void
{
    $manifest = null;
    $key = null;
    $entry = null;

    try {
        $manifest = $cache->get(PERSISTENT_MANIFEST_KEY);
        $validManifest = is_array($manifest)
            && ($manifest['version'] ?? null) === 1
            && is_string($manifest['cacheKey'] ?? null)
            && isPersistentKey($manifest['cacheKey'])
            && is_string($manifest['id'] ?? null)
            && preg_match('/\A[a-f0-9]{36}\z/', $manifest['id']) === 1
            && is_string($manifest['nonceHash'] ?? null)
            && preg_match('/\A[a-f0-9]{64}\z/', $manifest['nonceHash']) === 1
            && is_int($manifest['createdAt'] ?? null)
            && $manifest['createdAt'] <= time()
            && $manifest['createdAt'] >= time() - PERSISTENT_TTL_SECONDS;
        requireProbe($validManifest, 'persistent_sentinel_read', 'cache-operation');

        $key = $manifest['cacheKey'];
        $entry = $cache->get($key);
        $checks['persistent_sentinel_read'] = is_array($entry)
            && ($entry['kind'] ?? null) === 'runtime-boundary-persistent'
            && ($entry['id'] ?? null) === $manifest['id']
            && is_string($entry['nonce'] ?? null)
            && hash_equals($manifest['nonceHash'], hash('sha256', $entry['nonce']));
        requireProbe($checks['persistent_sentinel_read'], 'persistent_sentinel_read', 'cache-operation');
    } finally {
        $entryDeleted = is_string($key) && isPersistentKey($key) && $cache->delete($key) === true;
        $manifestDeleted = $cache->delete(PERSISTENT_MANIFEST_KEY) === true;
        $checks['persistent_sentinel_delete'] = $entryDeleted
            && $manifestDeleted
            && (is_string($key) ? $cache->get($key) === false : true)
            && $cache->get(PERSISTENT_MANIFEST_KEY) === false;
    }

    requireProbe($checks['persistent_sentinel_delete'], 'persistent_sentinel_delete', 'cache-operation');
}

/** @return array<string, bool> */
function runProbe(string $mode): array
{
    $checks = [];

    assertIsolationGuards();
    $checks['isolation_guards'] = true;

    assertEffectiveWwwDataUid();
    $checks['effective_uid'] = true;

    $app = bootstrapNativeApplication();
    $checks['bootstrap_initialization'] = true;

    $runtime = Yii::getAlias('@runtime');
    $checks['runtime_path'] = $runtime === EXPECTED_RUNTIME
        && $app->getRuntimePath() === EXPECTED_RUNTIME
        && realpath($runtime) === EXPECTED_RUNTIME;
    requireProbe($checks['runtime_path'], 'runtime_path', 'runtime-boundary');

    $cache = $app->get('cache');
    requireProbe($cache instanceof yii\caching\FileCache, 'cache_path', 'cache-type');
    $cachePath = Yii::getAlias($cache->cachePath);
    $checks['cache_path'] = isInsideDirectory($cachePath, EXPECTED_RUNTIME)
        && realpath($cachePath) !== false
        && isInsideDirectory((string) realpath($cachePath), EXPECTED_RUNTIME);
    requireProbe($checks['cache_path'], 'cache_path', 'runtime-boundary');

    if ($mode === 'write-persistent') {
        writePersistentCacheSentinel($cache, $checks);
    } elseif ($mode === 'verify-persistent') {
        verifyPersistentCacheSentinel($cache, $checks);
    } else {
        exerciseTransientCache($cache, $checks);
    }

    $messageSource = $app->i18n->getMessageSource(BOOTSTRAP5_CATEGORY);
    $expectedMessagePath = Yii::getAlias(BOOTSTRAP5_BASE_PATH);
    $checks['bootstrap5_i18n_source'] = $messageSource instanceof yii\i18n\GettextMessageSource
        && $messageSource->sourceLanguage === 'en-US'
        && realpath(Yii::getAlias($messageSource->basePath)) === realpath($expectedMessagePath)
        && is_dir($expectedMessagePath);
    requireProbe($checks['bootstrap5_i18n_source'], 'bootstrap5_i18n_source', 'i18n-boundary');

    $translatedClose = Yii::t(BOOTSTRAP5_CATEGORY, 'Close', [], 'en-US');
    $checks['bootstrap5_translation'] = is_string($translatedClose) && $translatedClose === 'Close';
    requireProbe($checks['bootstrap5_translation'], 'bootstrap5_translation', 'i18n-boundary');

    $alert = yii\bootstrap5\Alert::widget([
        'body' => 'Runtime boundary probe.',
        'closeButton' => [],
    ]);
    $checks['bootstrap5_alert_render'] = is_string($alert)
        && str_contains($alert, 'alert')
        && str_contains($alert, 'aria-label="Close"');
    requireProbe($checks['bootstrap5_alert_render'], 'bootstrap5_alert_render', 'i18n-boundary');

    return $checks;
}

function main(array $arguments): int
{
    $currentCheck = 'arguments';

    try {
        $mode = modeFromArguments($arguments);
        $currentCheck = 'runtime_probe';
        $checks = runProbe($mode);

        echo json_encode([
            'ok' => true,
            'mode' => $mode,
            'checkCount' => count($checks),
            'checks' => $checks,
        ], JSON_UNESCAPED_SLASHES), PHP_EOL;

        return 0;
    } catch (RuntimeBoundaryFailure $error) {
        return printFailure($error->check, $error->failureClass);
    } catch (Throwable $error) {
        return printFailure($currentCheck, safeFailureClass($error));
    }
}

ini_set('display_errors', '0');
set_error_handler(static function (int $severity): never {
    throw new ErrorException('Native runtime boundary warning.', 0, $severity);
});

exit(main($argv));
