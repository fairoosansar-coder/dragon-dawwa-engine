#!/usr/bin/env php
<?php
/**
 * Installs the narrow HumHub 1.19.0 review extension seams.
 *
 * The installer is intentionally fail-closed: every target must be either the
 * exact audited original or the exact result of this patch. No fuzzy offsets,
 * merge tools, database access, configuration reads, or credentials are used.
 */

declare(strict_types=1);

const ORIGINAL_HASHES = [
    'protected/humhub/modules/content/models/Content.php' => '126661cb8bcc391a0cba9b9466330527268a0ba4477226881c386bba8a472632',
    'protected/humhub/modules/content/components/ActiveQueryContent.php' => '3deb1ad44231dd9c7096746e85348c37f565a9c84928cbb836c23c1bc56583fe',
    'protected/humhub/modules/file/components/FileManager.php' => '168ccc34d771349abd8393a6b8cb9389c318b28a887180c3faf8dc8a282765d2',
    'protected/humhub/modules/file/models/File.php' => '70bcf44be79434a9aa75e36942e60feb8f5a493ed2960b6ba5ee23afb22d3d61',
    'protected/humhub/modules/content/search/ContentSearchProvider.php' => '519916ecf494175990f0ffc7c2aa51d4fc8dc4e51ede6f4cae6119b9d907b118',
    'protected/humhub/modules/content/search/driver/AbstractDriver.php' => 'bbabdd9daf35557f706b13c24d7d1ddb2316f6b9cac7d7674f23ba8fd982b507',
];

const PATCHED_HASHES = [
    'protected/humhub/modules/content/models/Content.php' => 'ad281a6ca468554ab5b9fb314f2710b7c66587a8cf474bfebc79e514270df3cd',
    'protected/humhub/modules/content/components/ActiveQueryContent.php' => '97e3e77d4a812e81f57e6e6dc4d8af1d98eedf025ec9e57fc380210e9689381f',
    'protected/humhub/modules/file/components/FileManager.php' => '8ba3cc7d632713d7454bbb01dad5eece1dc253ebf58ae4b2fdeb01495b90f988',
    'protected/humhub/modules/file/models/File.php' => 'd52d7d2d879aa9b637957d09d69fadbdd6d0eacaf43229768dcb8fd11f5f81f5',
    'protected/humhub/modules/content/search/ContentSearchProvider.php' => '1631d86394abafbbb9e9c819abfd4035daf149ef58532fd0940d993bdf8ea480',
    'protected/humhub/modules/content/search/driver/AbstractDriver.php' => 'aefc7ed86a3e34ec5ee1ac221512a993106a1e8e5553f9bff8cebc5b26fd3590',
];

const PATCH_FILES = [
    'protected/humhub/modules/content/models/Content.php' => 'content.patch',
    'protected/humhub/modules/content/components/ActiveQueryContent.php' => 'activequerycontent.patch',
    'protected/humhub/modules/file/components/FileManager.php' => 'filemanager.patch',
    'protected/humhub/modules/file/models/File.php' => 'file.patch',
    'protected/humhub/modules/content/search/ContentSearchProvider.php' => 'contentsearchprovider.patch',
    'protected/humhub/modules/content/search/driver/AbstractDriver.php' => 'abstractdriver.patch',
];

function fail(string $message): never
{
    fwrite(STDERR, "ummahreview hook installer: {$message}\n");
    exit(1);
}

$options = getopt('', ['runtime:']);
$runtime = $options['runtime'] ?? '/home/ubuntu/ummahconnect-live/runtime/humhub';
$runtime = realpath($runtime);
if ($runtime === false || !is_dir($runtime . '/protected/humhub')) {
    fail('expected a HumHub runtime root containing protected/humhub');
}

$engine = dirname(__DIR__);
$hookDir = $engine . '/integrations/social/humhub-ummahreview/core-hooks';
$eventSource = $hookDir . '/ContentGuardEvent.php';
$eventTarget = $runtime . '/protected/humhub/modules/content/events/ContentGuardEvent.php';
if (!is_file($eventSource)) {
    fail('missing integration-owned ContentGuardEvent source');
}

$toApply = [];
foreach (ORIGINAL_HASHES as $relative => $originalHash) {
    $target = $runtime . '/' . $relative;
    if (!is_file($target)) {
        fail("missing target {$relative}");
    }
    $actual = hash_file('sha256', $target);
    if ($actual === $originalHash) {
        $toApply[] = $relative;
    } elseif ($actual !== PATCHED_HASHES[$relative]) {
        fail("sha256 mismatch for {$relative}; expected audited original {$originalHash} or installed {$PATCHED_HASHES[$relative]}, got {$actual}");
    }
}

$eventHash = hash_file('sha256', $eventSource);
if (file_exists($eventTarget) && hash_file('sha256', $eventTarget) !== $eventHash) {
    fail('existing ContentGuardEvent.php does not match the integration-owned source');
}

// Verify every pending hunk first, before changing any target.
foreach ($toApply as $relative) {
    $patch = $hookDir . '/' . PATCH_FILES[$relative];
    if (!is_file($patch)) {
        fail("missing patch asset for {$relative}");
    }
    $command = 'patch --batch --forward --dry-run -d ' . escapeshellarg($runtime)
        . ' -p0 -i ' . escapeshellarg($patch) . ' 2>&1';
    exec($command, $output, $status);
    if ($status !== 0) {
        fail("dry-run rejected {$relative}: " . implode("\n", $output));
    }
}

foreach ($toApply as $relative) {
    $patch = $hookDir . '/' . PATCH_FILES[$relative];
    $command = 'patch --batch --forward -d ' . escapeshellarg($runtime)
        . ' -p0 -i ' . escapeshellarg($patch) . ' 2>&1';
    exec($command, $output, $status);
    if ($status !== 0) {
        fail("patch failed for {$relative}: " . implode("\n", $output));
    }
}

if (!file_exists($eventTarget) && !copy($eventSource, $eventTarget)) {
    fail('could not install ContentGuardEvent.php');
}
if (hash_file('sha256', $eventTarget) !== $eventHash) {
    fail('installed ContentGuardEvent.php hash verification failed');
}

foreach (PATCHED_HASHES as $relative => $patchedHash) {
    $actual = hash_file('sha256', $runtime . '/' . $relative);
    if ($actual !== $patchedHash) {
        fail("post-install sha256 verification failed for {$relative}");
    }
}

foreach (array_keys(PATCHED_HASHES) as $relative) {
    $target = $runtime . '/' . $relative;
    exec('php -l ' . escapeshellarg($target) . ' 2>&1', $output, $status);
    if ($status !== 0) {
        fail("PHP syntax check failed for {$relative}: " . implode("\n", $output));
    }
}
exec('php -l ' . escapeshellarg($eventTarget) . ' 2>&1', $output, $status);
if ($status !== 0) {
    fail('PHP syntax check failed for ContentGuardEvent.php: ' . implode("\n", $output));
}

$action = $toApply ? 'applied ' . implode(', ', $toApply) : 'already applied';
fwrite(STDOUT, "ummahreview hook installer: {$action}; hashes and PHP syntax verified\n");
