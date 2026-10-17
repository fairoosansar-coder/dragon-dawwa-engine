<?php
/**
 * Disposable native CI qualification only.
 *
 * Runs the real provisionNativeMember() path through the transaction, token,
 * membership, grant, envelope, and staged-journal steps, then deliberately
 * throws before commit. It asserts that no native row or journal survives.
 */
declare(strict_types=1);

define('UMMAH_MEMBER_PROVISION_LIBRARY', true);
require __DIR__ . '/provision-native-member.php';

function provisionTestFail(string $code): never
{
    throw new RuntimeException($code);
}

function provisionTestRequire(bool $condition, string $code): void
{
    if (!$condition) {
        provisionTestFail($code);
    }
}

function provisionTestSubjectReference(): string
{
    return 'google:' . rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function provisionTestPublicKey(): string
{
    $key = openssl_pkey_new(['private_key_bits' => 3072, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    provisionTestRequire($key !== false, 'key_generation');
    $details = openssl_pkey_get_details($key);
    provisionTestRequire(is_array($details) && is_string($details['key'] ?? null), 'key_generation');
    unset($key); // PHP 8 OpenSSLAsymmetricKey objects release automatically.
    return $details['key'];
}

function provisionTestMain(): int
{
    try {
        provisionTestRequire(PHP_SAPI === 'cli', 'cli_required');
        provisionTestRequire(getenv('UMMAH_NATIVE_FIXTURE') === 'sandbox-only', 'fixture_guard');
        provisionTestRequire(getenv('UMMAH_REVIEW_ENVIRONMENT') === 'isolated-staging', 'environment_guard');

        $subjectReference = provisionTestSubjectReference();
        $referenceHash = hash('sha256', $subjectReference);
        $email = 'native-provision-' . bin2hex(random_bytes(12)) . '@example.invalid';
        $hookReached = false;
        $writesBeforeRollback = [];
        $provisionFailureCode = null;
        $input = [
            'kind' => 'verified-ummah-member-enrollment',
            'subjectReference' => $subjectReference,
            'email' => $email,
            'role' => 'author',
            'displayName' => '',
            'publicKeyPem' => provisionTestPublicKey(),
            'spaceId' => 1,
        ];

        try {
            provisionNativeMember($input, [
                'beforeCommit' => static function () use (&$hookReached, &$writesBeforeRollback, $email): void {
                    $hookReached = true;
                    $userId = (int)Yii::$app->db->createCommand('SELECT [[id]] FROM {{%user}} WHERE [[email]]=:email', [':email' => $email])->queryScalar();
                    $writesBeforeRollback = [
                        'user' => $userId > 0 ? 1 : 0,
                        'membership' => $userId > 0 ? (int)(new yii\db\Query())->from('{{%space_membership}}')->where(['user_id' => $userId])->count() : 0,
                        'grant' => $userId > 0 ? (int)(new yii\db\Query())->from('{{%ummah_review_grant}}')->where(['user_id' => $userId])->count() : 0,
                        'token' => $userId > 0 ? (int)(new yii\db\Query())->from('{{%rest_user_bearer_tokens}}')->where(['user_id' => $userId])->count() : 0,
                    ];
                    throw new RuntimeException('intentional fixture rollback');
                },
            ]);
            provisionTestFail('rollback_not_triggered');
        } catch (RuntimeException $error) {
            // The test hook deliberately raises after all mutations and the
            // new journal have been staged but before the database commit.
            $provisionFailureCode = enrollmentFailureCode($error);
        }

        provisionTestRequire($hookReached, 'rollback_hook_not_reached');
        provisionTestRequire($writesBeforeRollback === ['user' => 1, 'membership' => 1, 'grant' => 1, 'token' => 1], 'native_writes_not_reached');
        provisionTestRequire(!humhub\modules\user\models\User::find()->where(['email' => $email])->exists(), 'user_not_rolled_back');
        provisionTestRequire(enrollmentLstat(UMMAH_ENROLL_JOURNAL_DIR . '/' . $referenceHash) === false, 'journal_not_cleaned');

        echo json_encode(['ok' => true, 'checks' => [
            'native_writes_reached_before_commit',
            'database_transaction_rolled_back',
            'current_attempt_journal_removed',
        ]], JSON_UNESCAPED_SLASHES), PHP_EOL;
        return 0;
    } catch (Throwable $error) {
        // Do not expose generated email, reference, token, paths, exception
        // text, SQL diagnostics, or traces from this qualification helper.
        echo json_encode(['ok' => false, 'code' => 'fixture_rollback_failed', 'provisionFailureCode' => $provisionFailureCode ?? null, 'hookReached' => $hookReached ?? false, 'errorClass' => get_class($error), 'errorFile' => basename($error->getFile()), 'errorLine' => $error->getLine()], JSON_UNESCAPED_SLASHES), PHP_EOL;
        return 1;
    }
}

exit(provisionTestMain());
