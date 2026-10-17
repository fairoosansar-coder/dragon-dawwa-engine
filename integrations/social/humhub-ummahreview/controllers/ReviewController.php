<?php
namespace humhub\modules\ummahreview\controllers;

use humhub\modules\content\models\Content;
use humhub\modules\post\models\Post;
use humhub\modules\rest\components\BaseController;
use humhub\modules\space\models\Space;
use humhub\modules\space\models\Membership;
use humhub\modules\user\models\User;
use humhub\modules\ummahreview\Events;
use humhub\modules\ummahreview\Module;
use humhub\modules\ummahreview\ReviewAudit;
use Yii;
use yii\db\Query;
use yii\filters\auth\HttpBearerAuth;
use yii\web\HttpException;

class ReviewController extends BaseController
{
    public static $moduleId = 'ummahreview';

    public function beforeAction($action)
    {
        Yii::$app->response->headers->set('Cache-Control', 'private, no-store');
        Yii::$app->response->headers->set('Pragma', 'no-cache');
        return parent::beforeAction($action);
    }

    public function behaviors()
    {
        $behaviors = parent::behaviors();
        $behaviors['authenticator'] = ['class' => HttpBearerAuth::class];
        return $behaviors;
    }

    private function memberSpace($id): Space
    {
        if (!ctype_digit((string)$id) || (int)$id < 1 || Yii::$app->user->isGuest) {
            throw new HttpException(403, 'Access denied.');
        }
        $space = Space::findOne((int)$id);
        if (!$space || (int)$space->status !== Space::STATUS_ENABLED || !Module::moderated($space) || !$space->isMember(Yii::$app->user->id)) {
            throw new HttpException(403, 'Access denied.');
        }
        return $space;
    }

    private function grant(Space $space, string $field): void
    {
        $row = (new Query())->from('{{%ummah_review_grant}}')->where([
            'user_id' => Yii::$app->user->id, 'space_id' => $space->id,
        ])->one();
        if (!$row || empty($row[$field])) {
            throw new HttpException(403, 'Access denied.');
        }
    }

    /** Re-check live account, membership and scoped submission authority for author-private reads. */
    private function submittingMemberSpace($id): Space
    {
        $space = $this->memberSpace($id);
        $userId = (int)Yii::$app->user->id;
        $liveUser = (new Query())->from('{{%user}}')->where(['id' => $userId,
            'status' => User::STATUS_ENABLED])->exists();
        $liveMembership = (new Query())->from('{{%space_membership}}')->where([
            'space_id' => $space->id, 'user_id' => $userId, 'status' => Membership::STATUS_MEMBER,
        ])->exists();
        if (!$liveUser || !$liveMembership) {
            throw new HttpException(403, 'Access denied.');
        }
        $this->grant($space, 'can_submit');
        return $space;
    }

    private function lockScope(Space $space, string $field): void
    {
        $db = Yii::$app->db;
        $params = [':user' => Yii::$app->user->id, ':space' => $space->id];
        $membership = $db->createCommand('SELECT [[status]] FROM {{%space_membership}} WHERE [[user_id]]=:user AND [[space_id]]=:space FOR UPDATE', $params)->queryOne();
        $user = $db->createCommand('SELECT [[status]] FROM {{%user}} WHERE [[id]]=:user FOR UPDATE', [':user' => Yii::$app->user->id])->queryOne();
        $grant = $db->createCommand('SELECT * FROM {{%ummah_review_grant}} WHERE [[user_id]]=:user AND [[space_id]]=:space FOR UPDATE', $params)->queryOne();
        if (!$membership || (int)$membership['status'] !== Membership::STATUS_MEMBER || !$user
            || (int)$user['status'] !== User::STATUS_ENABLED || !$grant || empty($grant[$field])) {
            throw new HttpException(403, 'Access denied.');
        }
    }

    private function consistent(array $row, ?Post $post): bool
    {
        $expected = $row['status'] === 'approved' ? Content::STATE_PUBLISHED : Content::STATE_DRAFT;
        return $post && in_array($row['status'], ['pending', 'approved', 'rejected'], true)
            && (int)$post->content->state === $expected && Events::reviewMatches($post->content, $row);
    }

    private function input(): array
    {
        if (strlen(Yii::$app->request->getRawBody()) > 32000) {
            throw new HttpException(413, 'Request too large.');
        }
        $body = Yii::$app->request->getBodyParams();
        if (!is_array($body)) {
            throw new HttpException(400, 'Invalid request.');
        }
        return $body;
    }

    private function sources($sources): array
    {
        if (!is_array($sources) || count($sources) > 8) {
            throw new HttpException(400, 'Invalid sources.');
        }
        foreach ($sources as $source) {
            $parts = is_string($source) ? parse_url($source) : false;
            if (!$parts || strlen($source) > 2000 || ($parts['scheme'] ?? '') !== 'https'
                || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])
                || preg_match('/[\x00-\x20\x7f]/', $source)) {
                throw new HttpException(400, 'Invalid sources.');
            }
        }
        return array_values($sources);
    }

    private function projection(array $row, Post $post): array
    {
        return ['id' => (int)$post->id, 'reviewId' => (int)$row['id'],
            'message' => $post->message, 'status' => $row['status'],
            'state' => (int)$post->content->state,
            'sources' => json_decode($row['sources_json'], true),
            'submittedAt' => $row['submitted_at'], 'reviewedAt' => $row['reviewed_at']];
    }

    public function actionSubmit(): array
    {
        $body = $this->input();
        $space = $this->memberSpace($body['spaceId'] ?? 0);
        $message = $body['message'] ?? null;
        $key = $body['requestKey'] ?? '';
        if (!is_string($message) || trim($message) === '' || strlen($message) > 12000
            || !is_string($key) || !preg_match('/^[A-Za-z0-9_-]{16,100}$/D', $key)) {
            throw new HttpException(400, 'Invalid submission.');
        }
        $sources = $this->sources($body['sources'] ?? []);
        $requestHash = hash('sha256', json_encode([(int)$space->id, $message, $sources], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $operationKey = hash('sha256', 'submit:' . Yii::$app->user->id . ':' . $key);
        return ReviewAudit::run('submit', $operationKey, null, function () use ($space, $message, $key, $sources, $requestHash) {
            $db = Yii::$app->db;
            // Serialize retries by actual authenticated provider user, not a browser userId.
            $this->lockScope($space, 'can_submit');
            $prior = (new Query())->from('{{%ummah_review}}')->where(['author_id' => Yii::$app->user->id, 'request_key' => $key])->one();
            if ($prior) {
                if (!hash_equals($prior['request_hash'], $requestHash)) {
                    throw new HttpException(409, 'Idempotency conflict.');
                }
                $post = Post::findOne($prior['post_id']);
                if (!$this->consistent($prior, $post)) { throw new HttpException(409, 'Submission version unavailable.'); }
                return $this->projection($prior, $post) + ['__audit_replay' => true];
            }
            $post = new Post($space, ['message' => $message, 'title' => 'Community reflection']);
            if (!$post->content->canEdit()) {
                throw new HttpException(403, 'Access denied.');
            }
            // Critical: initialize the Content state BEFORE Post::save(). Never save-then-draft.
            $post->content->state = Content::STATE_DRAFT;
            $post->content->visibility = Content::VISIBILITY_PRIVATE;
            $post->content->scheduled_at = null;
            $post->autoFollow = false;
            if (!Events::saveSubmittedDraft($post) || (int)$post->content->state !== Content::STATE_DRAFT) {
                throw new HttpException(409, 'Draft could not be saved.');
            }
            $row = ['post_id' => $post->id, 'content_id' => $post->content->id,
                'space_id' => $space->id, 'author_id' => Yii::$app->user->id,
                'request_key' => $key, 'request_hash' => $requestHash,
                'message_hash' => hash('sha256', $post->message),
                'sources_json' => json_encode($sources, JSON_UNESCAPED_SLASHES),
                'status' => 'pending', 'submitted_at' => gmdate('Y-m-d H:i:s'),
                'reviewed_at' => null, 'reviewer_id' => null, 'review_note' => null];
            $db->createCommand()->insert('{{%ummah_review}}', $row)->execute();
            $row['id'] = (int)$db->getLastInsertID();
            return $this->projection($row, $post);
        });
    }

    private function listing(bool $reviewQueue): array
    {
        $space = $this->memberSpace(Yii::$app->request->get('space'));
        if ($reviewQueue) { $this->grant($space, 'can_review'); }
        $page = Yii::$app->request->get('page', '1');
        if (!ctype_digit((string)$page) || (int)$page < 1 || (int)$page > 10000) {
            throw new HttpException(400, 'Invalid page.');
        }
        $query = Post::find()->contentContainer($space)
            ->innerJoin('{{%ummah_review}} r', 'r.post_id=post.id')
            ->andWhere(['r.space_id' => $space->id, 'r.status' => $reviewQueue ? 'pending' : 'approved']);
        // Override native author-draft inclusion even for authors and privileged accounts.
        $query->stateFilterCondition = ['content.state' => $reviewQueue ? Content::STATE_DRAFT : Content::STATE_PUBLISHED];
        if ($reviewQueue) {
            $query->joinWith('content')->andWhere(['content.state' => Content::STATE_DRAFT]);
        } else {
            $query->readable();
        }
        $total = (int)(clone $query)->count();
        $posts = $query->orderBy(['post.id' => SORT_DESC])->limit(20)->offset(((int)$page - 1) * 20)->all();
        $results = [];
        foreach ($posts as $post) {
            $row = (new Query())->from('{{%ummah_review}}')->where(['post_id' => $post->id])->one();
            if ($row && $this->consistent($row, $post)) {
                $results[] = $this->projection($row, $post);
            }
        }
        return ['results' => $results, 'total' => $total, 'page' => (int)$page, 'pages' => (int)ceil($total / 20)];
    }

    public function actionPosts(): array { return $this->listing(false); }
    public function actionQueue(): array { return $this->listing(true); }

    /**
     * Returns only the authenticated author's unpublished submissions in one permitted space.
     * Approved rows are deliberately excluded unless the caller opts in; the public feed remains
     * the separate approved-only endpoint. A requested author identity is never accepted.
     */
    public function actionSubmissions(): array
    {
        $params = Yii::$app->request->getQueryParams();
        if (array_key_exists('userId', $params) || array_key_exists('user', $params)
            || array_key_exists('authorId', $params) || array_key_exists('author_id', $params)
            || array_key_exists('author', $params) || array_key_exists('status', $params)) {
            throw new HttpException(400, 'Author filter is not supported.');
        }
        $includeApproved = Yii::$app->request->get('includeApproved', '0');
        if (!in_array($includeApproved, ['0', '1'], true)) {
            throw new HttpException(400, 'Invalid submission filter.');
        }
        $page = Yii::$app->request->get('page', '1');
        if (!ctype_digit((string)$page) || (int)$page < 1 || (int)$page > 10000) {
            throw new HttpException(400, 'Invalid page.');
        }
        $space = $this->submittingMemberSpace(Yii::$app->request->get('space'));
        $statuses = ['pending', 'rejected'];
        if ($includeApproved === '1') {
            $statuses[] = 'approved';
        }
        $query = Post::find()->contentContainer($space)
            ->innerJoin('{{%ummah_review}} r', 'r.post_id=post.id')
            ->andWhere(['r.space_id' => $space->id, 'r.author_id' => (int)Yii::$app->user->id,
                'r.status' => $statuses])
            ->joinWith('content');
        // Do not rely on native author-draft shortcuts: each returned row must match its review state.
        $query->stateFilterCondition = ['or',
            ['and', ['r.status' => ['pending', 'rejected']], ['content.state' => Content::STATE_DRAFT]],
            ['and', ['r.status' => 'approved'], ['content.state' => Content::STATE_PUBLISHED]],
        ];
        $query->andWhere($query->stateFilterCondition);
        $total = (int)(clone $query)->count();
        $posts = $query->orderBy(['post.id' => SORT_DESC])->limit(20)->offset(((int)$page - 1) * 20)->all();
        $results = [];
        foreach ($posts as $post) {
            $row = (new Query())->from('{{%ummah_review}}')->where([
                'post_id' => $post->id, 'author_id' => (int)Yii::$app->user->id,
            ])->one();
            if ($row && in_array($row['status'], $statuses, true) && $this->consistent($row, $post)) {
                $results[] = $this->projection($row, $post);
            }
        }
        return ['results' => $results, 'total' => $total, 'page' => (int)$page, 'pages' => (int)ceil($total / 20)];
    }

    public function actionView($id): array
    {
        $row = (new Query())->from('{{%ummah_review}}')->where(['post_id' => (int)$id, 'status' => 'approved'])->one();
        if (!$row) { throw new HttpException(404, 'Post unavailable.'); }
        $this->memberSpace($row['space_id']);
        $post = Post::findOne($row['post_id']);
        if (!$this->consistent($row, $post) || !$post->content->canView()) {
            throw new HttpException(404, 'Post unavailable.');
        }
        return $this->projection($row, $post);
    }

    public function actionDecide($id): array
    {
        $body = $this->input();
        $decision = $body['decision'] ?? '';
        $note = $body['note'] ?? '';
        if (!in_array($decision, ['approved', 'rejected'], true) || !is_string($note) || trim($note) === '' || strlen($note) > 4000) {
            throw new HttpException(400, 'Human review decision and note required.');
        }
        $operationKey = hash('sha256', json_encode(['decide', (int)$id, (int)Yii::$app->user->id, $decision, $note]));
        return ReviewAudit::run('decide', $operationKey, (int)$id, function () use ($id, $decision, $note) {
            $db = Yii::$app->db;
            $row = $db->createCommand('SELECT * FROM {{%ummah_review}} WHERE [[id]]=:id FOR UPDATE', [':id' => (int)$id])->queryOne();
            if (!$row) { throw new HttpException(404, 'Review unavailable.'); }
            $space = $this->memberSpace($row['space_id']);
            $this->lockScope($space, 'can_review');
            if ((int)$row['author_id'] === (int)Yii::$app->user->id) {
                throw new HttpException(403, 'Independent human reviewer required.');
            }
            if ($row['status'] !== 'pending') {
                if ($row['status'] !== $decision || (int)$row['reviewer_id'] !== (int)Yii::$app->user->id || $row['review_note'] !== $note) {
                    throw new HttpException(409, 'Review already decided.');
                }
                $post = Post::findOne($row['post_id']);
                if (!$this->consistent($row, $post)) { throw new HttpException(409, 'Post version unavailable.'); }
                return $this->projection($row, $post) + ['__audit_replay' => true];
            }
            $db->createCommand('SELECT [[id]] FROM {{%content}} WHERE [[id]]=:id FOR UPDATE', [':id' => $row['content_id']])->queryOne();
            $post = Post::findOne($row['post_id']);
            if (!$this->consistent($row, $post)) {
                throw new HttpException(409, 'Review content changed or unavailable.');
            }
            $changes = ['status' => $decision, 'reviewer_id' => Yii::$app->user->id, 'review_note' => $note, 'reviewed_at' => gmdate('Y-m-d H:i:s')];
            $db->createCommand()->update('{{%ummah_review}}', $changes, ['id' => $row['id']])->execute();
            if ($decision === 'approved' && !Events::publishReviewed($post->content)) {
                throw new HttpException(409, 'Publication failed.');
            }
            // Rejection leaves the provider content DRAFT, never public or scheduled.
            return $this->projection(array_merge($row, $changes), $post);
        });
    }
}
