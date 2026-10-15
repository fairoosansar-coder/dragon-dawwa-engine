<?php
namespace humhub\modules\ummahreview;

use Yii;
use yii\web\HttpException;

/** No tokens, cookies, post bodies or raw exception strings enter this ledger. */
final class ReviewAudit
{
    private static function append(array $row): void
    {
        Yii::$app->db->createCommand()->insert('{{%ummah_review_event}}', $row)->execute();
    }

    public static function run(string $operation, string $operationKey, ?int $requestedId, callable $work): array
    {
        $db = Yii::$app->db;
        if ($db->getTransaction()?->isActive) {
            throw new HttpException(409, 'Nested review transactions are unavailable.');
        }
        $base = ['attempt_key' => bin2hex(random_bytes(16)), 'operation_key' => $operationKey,
            'operation' => $operation, 'actor_id' => (int)Yii::$app->user->id,
            'requested_review_id' => $requestedId, 'review_id' => null,
            'version_hash' => null, 'decision' => null, 'reason' => null];
        try {
            self::append($base + ['phase' => 'started', 'outcome' => 'started', 'created_at' => gmdate('Y-m-d H:i:s')]);
        } catch (\Throwable $error) {
            throw new HttpException(503, 'Review audit storage unavailable.');
        }
        try {
            return $db->transaction(function () use ($base, $work) {
                $result = $work();
                $replay = !empty($result['__audit_replay']);
                unset($result['__audit_replay']);
                $terminal = array_merge($base, ['review_id' => $result['reviewId'] ?? null,
                    'version_hash' => hash('sha256', json_encode([$result['message'] ?? '', $result['sources'] ?? []], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
                    'decision' => $result['status'] ?? null, 'phase' => 'finished',
                    'outcome' => $replay ? 'replayed' : 'committed', 'created_at' => gmdate('Y-m-d H:i:s')]);
                // Failure of this insert also rolls back the post/decision/publication.
                self::append($terminal);
                return $result;
            });
        } catch (\Throwable $error) {
            $status = $error instanceof HttpException ? $error->statusCode : 500;
            $reason = $status === 403 ? 'permission_denied' : ($status === 409 ? 'state_or_version_conflict' : 'transaction_failed');
            // This append happens AFTER the business transaction has rolled back.
            // If the database itself is unavailable, do not claim a durable record or success.
            try {
                self::append(array_merge($base, ['phase' => 'finished', 'outcome' => 'failed',
                    'reason' => $reason, 'created_at' => gmdate('Y-m-d H:i:s')]));
            } catch (\Throwable $auditError) {
                throw new HttpException(503, 'Review audit storage unavailable.');
            }
            if ($error instanceof HttpException) {
                throw $error;
            }
            throw new HttpException(503, 'Review transaction failed.');
        }
    }
}
