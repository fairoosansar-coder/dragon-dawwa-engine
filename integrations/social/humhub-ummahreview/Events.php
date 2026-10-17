<?php
namespace humhub\modules\ummahreview;

use humhub\modules\content\components\ActiveQueryContent;
use humhub\modules\content\events\ContentGuardEvent;
use humhub\modules\content\models\Content;
use humhub\modules\content\search\ResultSet;
use humhub\modules\content\search\driver\AbstractDriver;
use humhub\modules\file\components\FileManager;
use humhub\modules\file\models\File;
use humhub\modules\post\models\Post;
use humhub\modules\space\models\Space;
use humhub\modules\space\models\Membership;
use humhub\modules\user\models\User;
use humhub\modules\stream\models\StreamQuery;
use Yii;
use yii\base\Event;
use yii\db\ActiveQuery;
use yii\db\Expression;
use yii\db\Query;

class Events
{
    private static ?int $publishingContentId = null;
    private static ?Post $submittedDraft = null;

    /**
     * The sole supported native Post creation path for a moderated space.
     * The identity comparison prevents a wider request/global "create" bypass.
     */
    public static function saveSubmittedDraft(Post $post): bool
    {
        if (!$post->isNewRecord || self::$submittedDraft !== null || !Module::moderated($post->content->container)) {
            return false;
        }

        self::$submittedDraft = $post;
        try {
            return $post->save();
        } finally {
            self::$submittedDraft = null;
        }
    }

    public static function beforePostInsert($event): void
    {
        $post = $event->sender;
        if (!$post instanceof Post || !Module::moderated($post->content->container)) {
            return;
        }

        if (self::$submittedDraft !== $post) {
            $event->isValid = false;
            return;
        }

        // Content is saved by Post::afterSave(); establish the invariant first.
        $post->content->state = Content::STATE_DRAFT;
        $post->content->visibility = Content::VISIBILITY_PRIVATE;
        $post->content->scheduled_at = null;
        $post->autoFollow = false;
    }

    public static function beforePostUpdate($event): void
    {
        $post = $event->sender;
        if (!$post instanceof Post) {
            return;
        }

        if (self::reviewRowForPost($post) || self::contentIsInModeratedSpace($post->content)) {
            // An edited approved post must be a new submission, never silently retain approval.
            $event->isValid = false;
        }
    }

    public static function beforeContentSave($event): void
    {
        $content = $event->sender;
        if (!$content instanceof Content || !($post = self::postFor($content))) {
            return;
        }

        $review = self::reviewRowForPost($post);
        if (!$review && !self::contentIsInModeratedSpace($content)) {
            return;
        }

        if ($review && !self::reviewMatches($content, $review)) {
            $event->isValid = false;
            return;
        }

        $content->visibility = Content::VISIBILITY_PRIVATE;
        $content->scheduled_at = null;
        if ($content->isNewRecord) {
            $content->state = Content::STATE_DRAFT;
            return;
        }

        if ((int)$content->state === Content::STATE_PUBLISHED) {
            $alreadyApproved = $review
                && $review['status'] === 'approved'
                && (int)$content->getOldAttribute('state') === Content::STATE_PUBLISHED;
            $authorizedTransition = self::$publishingContentId === (int)$content->id
                && $review
                && $review['status'] === 'approved';
            if (!$alreadyApproved && !$authorizedTransition) {
                $event->isValid = false;
            }
        } elseif (!in_array((int)$content->state, [Content::STATE_DRAFT, Content::STATE_DELETED], true)) {
            $event->isValid = false;
        }
    }

    /** Denies force-move and ordinary move before Content::updateAttributes() can bypass save events. */
    public static function beforeNativeContentMove(ContentGuardEvent $event): void
    {
        $content = $event->content;
        if (!$content instanceof Content || !self::postFor($content)) {
            return;
        }

        if (self::reviewRowForContent($content)
            || self::contentIsInModeratedSpace($content)
            || ($event->target instanceof Space && Module::moderated($event->target))) {
            $event->isValid = false;
        }
    }

    /** Denies only sensitive raw Content::updateAttributes() fields for review-managed Posts. */
    public static function beforeNativeContentUpdateAttributes(ContentGuardEvent $event): void
    {
        $content = $event->content;
        if (!$content instanceof Content || !self::postFor($content) || !self::hasSensitiveContentAttributes($event->attributes)) {
            return;
        }

        if (self::reviewRowForContent($content) || self::contentIsInModeratedSpace($content) || self::attributesTargetModeratedSpace($content, $event->attributes)) {
            $event->isValid = false;
        }
    }

    /** FileManager 1.19.0 exposes only attach() as a record-file mutation method. */
    public static function beforeNativeFileMutation(ContentGuardEvent $event): void
    {
        $post = $event->target;
        if (!$post instanceof Post) {
            return;
        }

        if (self::reviewRowForPost($post) || self::contentIsInModeratedSpace($post->content)) {
            $event->isValid = false;
            // The native REST caller ignores an attach() false return. Do not
            // return a false success after saving an unreviewed attachment.
            throw new \yii\web\ForbiddenHttpException('Attachments require a separate reviewed ingestion workflow.');
        }
    }

    /** Rejects a low-level File insert when its proposed link is a protected Post. */
    public static function beforeNativeFileInsert($event): void
    {
        self::guardNativeFileMutation($event, $event->sender);
    }

    /** Rejects File updates when either the persisted or proposed link is a protected Post. */
    public static function beforeNativeFileUpdate($event): void
    {
        self::guardNativeFileMutation($event, $event->sender);
    }

    /** Rejects deletion of a File currently linked to a protected Post. */
    public static function beforeNativeFileDelete($event): void
    {
        self::guardNativeFileMutation($event, $event->sender);
    }

    /** Covers raw File::updateAttributes(), which otherwise skips save events. */
    public static function beforeNativeFileUpdateAttributes(ContentGuardEvent $event): void
    {
        self::guardNativeFileMutation($event, $event->target, $event->attributes);
    }

    /**
     * File::canView() must not let creator or public shortcuts expose a Post
     * attachment. The persisted row, rather than request-mutated model values,
     * is authoritative for download authorization.
     */
    public static function beforeNativeFileView(ContentGuardEvent $event): void
    {
        $file = $event->target;
        if ($file instanceof File && self::persistedFileTargetsProtectedPost($file)) {
            $event->isValid = false;
        }
    }

    /** Native Content::canView() must never make a review queue item readable. */
    public static function beforeNativeContentView(ContentGuardEvent $event): void
    {
        $content = $event->content;
        if (!$content instanceof Content || !($post = self::postFor($content))) {
            return;
        }

        $row = self::reviewRowForPost($post);
        if (!$row) {
            if (self::contentIsInModeratedSpace($content)) {
                $event->isValid = false;
            }
            return;
        }

        if ($row['status'] !== 'approved'
            || (int)$content->state !== Content::STATE_PUBLISHED
            || !self::reviewMatches($content, $row)) {
            $event->isValid = false;
            return;
        }
        $viewer = $event->user;
        $space = Space::findOne((int)$row['space_id']);
        $member = $viewer instanceof User && (int)$viewer->status === User::STATUS_ENABLED && $space
            && (int)$space->status === Space::STATUS_ENABLED
            && (new Query())->from('{{%space_membership}}')->where(['space_id' => $space->id,
                'user_id' => $viewer->id, 'status' => Membership::STATUS_MEMBER])->exists();
        if (!$member) {
            $event->isValid = false;
        }
    }

    /** Called from the generic ActiveQueryContent::readable() extension event. */
    public static function restrictNativeReadableQuery(ContentGuardEvent $event): void
    {
        if ($event->query instanceof ActiveQueryContent) {
            self::applyNativeReadPolicy($event->query, $event->user);
        }
    }

    /** Existing StreamQuery extension point covers native dashboard/space/user feeds. */
    public static function restrictNativeStreamQuery(Event $event): void
    {
        $stream = $event->sender;
        if ($stream instanceof StreamQuery) {
            self::applyNativeReadPolicy($stream->query(), $stream->user);
        }
    }

    /** Generic search result events cover direct meta search and cached advanced search. */
    public static function restrictNativeSearchResults(ContentGuardEvent $event): void
    {
        $resultSet = $event->target;
        if (!$resultSet instanceof ResultSet) {
            return;
        }

        $results = [];
        foreach ($resultSet->results as $content) {
            if (!$content instanceof Content) {
                continue;
            }
            if (!self::postFor($content)) {
                // Leave all non-Post providers under their unchanged native result policy.
                $results[] = $content;
                continue;
            }
            try {
                // This reaches the generic native canView hook first, then preserves
                // all original HumHub visibility/membership checks for valid Posts.
                if ($content->canView($event->user)) {
                    $results[] = $content;
                }
            } catch (\Throwable) {
                // A malformed tracked Post is not a searchable result.
            }
        }

        if (count($results) !== count($resultSet->results)) {
            $resultSet->results = $results;
            // Do not disclose excluded-item counts. Exact pagination can be rebuilt
            // by a later dedicated search driver policy if this module grows beyond
            // the bounded native UI result pages.
            $resultSet->pagination->totalCount = count($results);
        }
    }

    /**
     * Applies one SQL policy to native Post readable queries and Content stream queries.
     * It preserves all native WHERE restrictions and only removes Post rows that do not
     * prove a coherent approved review record.
     */
    private static function applyNativeReadPolicy(ActiveQuery $query, ?User $viewer): void
    {
        if (isset($query->params[':ummahReviewPostModel'])) {
            return; // readable() and native stream filtering can share this query.
        }
        $postModel = Post::getObjectModel();
        $postAlias = 'ummah_review_guard_post';
        $reviewAlias = 'ummah_review_guard';
        $fileAlias = 'ummah_review_guard_file';
        $viewerId = $viewer instanceof User ? (int)$viewer->id : 0;

        $query->leftJoin(
            '{{%post}} ' . $postAlias,
            $postAlias . '.id=content.object_id AND content.object_model=:ummahReviewPostModel',
            [':ummahReviewPostModel' => $postModel],
        );
        $query->leftJoin('{{%ummah_review}} ' . $reviewAlias, $reviewAlias . '.post_id=' . $postAlias . '.id');

        $noUnexpectedFiles = 'NOT EXISTS (SELECT 1 FROM {{%file}} ' . $fileAlias
            . ' WHERE ' . $fileAlias . '.object_id=' . $postAlias . '.id'
            . ' AND ' . $fileAlias . '.object_model=:ummahReviewPostModel)';
        $matchingMessage = $reviewAlias . '.message_hash=SHA2(' . $postAlias . '.message, 256)';
        $matchingCommunity = 'EXISTS (SELECT 1 FROM {{%space}} ucs INNER JOIN {{%space_membership}} ucm ON ucm.space_id=ucs.id'
            . ' INNER JOIN {{%user}} ucu ON ucu.id=ucm.user_id WHERE ucs.id=' . $reviewAlias . '.space_id'
            . ' AND ucs.contentcontainer_id=content.contentcontainer_id AND ucs.status=1'
            . ' AND ucm.status=3 AND ucu.status=1 AND ucm.user_id=:ummahReviewViewerId)';

        $query->andWhere(['or',
            // Leave every non-Post content provider entirely under its own native policy.
            ['<>', 'content.object_model', $postModel],
            // A non-review Post remains native only outside explicitly moderated spaces.
            ['and',
                [$reviewAlias . '.id' => null],
                ['not in', 'content.contentcontainer_id', Module::containerIds()],
            ],
            // A tracked Post is readable only when every review invariant holds in SQL.
            ['and',
                [$reviewAlias . '.status' => 'approved'],
                [$reviewAlias . '.content_id' => new Expression('content.id')],
                ['content.state' => Content::STATE_PUBLISHED],
                $matchingCommunity,
                $matchingMessage,
                $noUnexpectedFiles,
            ],
        ]);
        $query->addParams([':ummahReviewPostModel' => $postModel, ':ummahReviewViewerId' => $viewerId]);
    }

    /**
     * Verifies immutable record identity, message integrity, the actual Space binding,
     * and attachment absence. Callers deliberately decide status/state themselves.
     */
    public static function reviewMatches(Content $content, array $row): bool
    {
        $post = self::postFor($content);
        if (!$post
            || !isset($row['post_id'], $row['content_id'], $row['space_id'], $row['message_hash'])
            || (int)$row['post_id'] !== (int)$post->id
            || (int)$row['content_id'] !== (int)$content->id
            || !is_string($row['message_hash'])
            || !hash_equals($row['message_hash'], hash('sha256', (string)$post->message))) {
            return false;
        }

        $space = Space::findOne((int)$row['space_id']);
        if (!$space || (int)$content->contentcontainer_id !== (int)$space->contentContainerRecord->id) {
            return false;
        }

        try {
            $container = $content->getContainer();
        } catch (\Throwable) {
            return false;
        }

        return $container instanceof Space
            && (int)$container->id === (int)$space->id
            && !$post->getFiles()->exists();
    }

    public static function publishReviewed(Content $content): bool
    {
        $row = self::reviewRowForContent($content);
        if (self::$publishingContentId !== null
            || !$row
            || $row['status'] !== 'approved'
            || (int)$content->state !== Content::STATE_DRAFT
            || !self::reviewMatches($content, $row)) {
            return false;
        }

        self::$publishingContentId = (int)$content->id;
        try {
            return $content->getStateService()->publish();
        } finally {
            self::$publishingContentId = null;
        }
    }

    public static function restRules($event): void
    {
        // REST 0.12.4 triggers a class-level event with no sender instance.
        $rest = Yii::$app->getModule('rest');
        if (!$rest instanceof \humhub\modules\rest\Module) {
            throw new \yii\base\InvalidConfigException('Pinned HumHub REST module is required.');
        }
        $rest->addRules([
            ['pattern' => 'ummahreview/posts', 'route' => 'ummahreview/review/posts', 'verb' => 'GET'],
            ['pattern' => 'ummahreview/post/<id:\\d+>', 'route' => 'ummahreview/review/view', 'verb' => 'GET'],
            ['pattern' => 'ummahreview/submissions', 'route' => 'ummahreview/review/submit', 'verb' => 'POST'],
            ['pattern' => 'ummahreview/submissions', 'route' => 'ummahreview/review/submissions', 'verb' => 'GET'],
            ['pattern' => 'ummahreview/reviews', 'route' => 'ummahreview/review/queue', 'verb' => 'GET'],
            ['pattern' => 'ummahreview/reviews/<id:\\d+>', 'route' => 'ummahreview/review/decide', 'verb' => 'POST'],
        ], 'ummahreview');
    }

    private static function postFor(Content $content): ?Post
    {
        try {
            $post = $content->getModel();
        } catch (\Throwable) {
            return null;
        }
        return $post instanceof Post ? $post : null;
    }

    private static function reviewRowForPost(Post $post): ?array
    {
        if (!$post->id) {
            return null;
        }
        $row = (new Query())->from('{{%ummah_review}}')->where(['post_id' => $post->id])->one();
        return is_array($row) ? $row : null;
    }

    private static function reviewRowForContent(Content $content): ?array
    {
        if (!$content->id) {
            return null;
        }
        $row = (new Query())->from('{{%ummah_review}}')->where(['content_id' => $content->id])->one();
        return is_array($row) ? $row : null;
    }

    private static function contentIsInModeratedSpace(Content $content): bool
    {
        try {
            if (Module::moderated($content->getContainer())) {
                return true;
            }
        } catch (\Throwable) {
            // Fall through to the persisted ContentContainer id below.
        }

        $current = (int)$content->contentcontainer_id;
        return $current > 0 && in_array($current, Module::containerIds(), true);
    }

    /**
     * Denies any File mutation whose old, persisted, current, or explicitly
     * proposed polymorphic link addresses a tracked or moderated Post.
     */
    private static function guardNativeFileMutation($event, mixed $candidate, array $attributes = []): void
    {
        if (!$candidate instanceof File) {
            return;
        }

        foreach (self::fileLinkCandidates($candidate, $attributes) as $link) {
            if (self::fileLinkTargetsProtectedPost($link)) {
                $event->isValid = false;
                throw new \yii\web\ForbiddenHttpException('File operation is not permitted.');
            }
        }
    }

    /** Reads the actual saved association for direct-download authorization. */
    private static function persistedFileTargetsProtectedPost(File $file): bool
    {
        $link = self::persistedFileLink($file);
        return $link !== null && self::fileLinkTargetsProtectedPost($link);
    }

    /** @return array<int, array{object_model:mixed, object_id:mixed}> */
    private static function fileLinkCandidates(File $file, array $attributes): array
    {
        $links = [];
        $persisted = self::persistedFileLink($file);
        if ($persisted !== null) {
            $links[] = $persisted;
        }

        $old = [
            'object_model' => $file->getOldAttribute('object_model'),
            'object_id' => $file->getOldAttribute('object_id'),
        ];
        $links[] = $old;
        $links[] = [
            'object_model' => $file->object_model,
            'object_id' => $file->object_id,
        ];

        // updateAttributes() accepts both value maps and attribute-name lists.
        $proposed = $persisted ?? $old;
        foreach (['object_model', 'object_id'] as $name) {
            if (array_key_exists($name, $attributes)) {
                $proposed[$name] = $attributes[$name];
            } elseif (in_array($name, $attributes, true)) {
                $proposed[$name] = $file->getAttribute($name);
            }
        }
        $links[] = $proposed;

        return $links;
    }

    /** @return array{object_model:mixed, object_id:mixed}|null */
    private static function persistedFileLink(File $file): ?array
    {
        $id = (int)$file->getPrimaryKey();
        if ($id < 1) {
            return null;
        }

        $row = (new Query())
            ->select(['object_model', 'object_id'])
            ->from('{{%file}}')
            ->where(['id' => $id])
            ->one();
        return is_array($row) ? $row : null;
    }

    private static function fileLinkTargetsProtectedPost(array $link): bool
    {
        if (($link['object_model'] ?? null) !== Post::getObjectModel()) {
            return false;
        }

        $postId = (int)($link['object_id'] ?? 0);
        if ($postId < 1) {
            return false;
        }

        if ((new Query())->from('{{%ummah_review}}')->where(['post_id' => $postId])->exists()) {
            return true;
        }

        $post = Post::findOne($postId);
        if (!$post instanceof Post) {
            return false;
        }

        try {
            return self::contentIsInModeratedSpace($post->content);
        } catch (\Throwable) {
            return false;
        }
    }

    private static function hasSensitiveContentAttributes(array $attributes): bool
    {
        foreach ($attributes as $key => $value) {
            $name = is_int($key) ? $value : $key;
            if (in_array($name, ['state', 'contentcontainer_id', 'visibility'], true)) {
                return true;
            }
        }
        return false;
    }

    private static function attributesTargetModeratedSpace(Content $content, array $attributes): bool
    {
        $changesContainer = array_key_exists('contentcontainer_id', $attributes)
            || in_array('contentcontainer_id', $attributes, true);
        if (!$changesContainer) {
            return false;
        }

        $id = array_key_exists('contentcontainer_id', $attributes)
            ? (int)$attributes['contentcontainer_id']
            : (int)$content->contentcontainer_id;
        return $id > 0 && in_array($id, Module::containerIds(), true);
    }
}
