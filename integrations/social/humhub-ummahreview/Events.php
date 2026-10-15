<?php
namespace humhub\modules\ummahreview;

use humhub\modules\content\models\Content;
use humhub\modules\post\models\Post;
use Yii;
use yii\db\Query;

class Events
{
    private static ?int $publishingContentId = null;

    public static function beforePostInsert($event): void
    {
        $post = $event->sender;
        if (Module::moderated($post->content->container)) {
            // Set BEFORE the first Post save causes its associated Content save.
            $post->content->state = Content::STATE_DRAFT;
            $post->content->visibility = Content::VISIBILITY_PRIVATE;
            $post->content->scheduled_at = null;
            $post->autoFollow = false;
        }
    }

    public static function beforePostUpdate($event): void
    {
        $post = $event->sender;
        $tracked = (new Query())->from('{{%ummah_review}}')->where(['post_id' => $post->id])->exists();
        if ($tracked || Module::moderated($post->content->container)) {
            // An edited approved post must be a NEW submission, never silently keep approval.
            $event->isValid = false;
        }
    }

    public static function beforeContentSave($event): void
    {
        $content = $event->sender;
        if ($content->object_model !== Post::class) {
            return;
        }
        $review = $content->id ? (new Query())->from('{{%ummah_review}}')->where(['content_id' => $content->id])->one() : false;
        if (!$review && !Module::moderated($content->container)) {
            return;
        }
        if ($review && (!Module::moderated($content->container) || (int)$review['space_id'] !== (int)$content->container->id)) {
            $event->isValid = false; // Moving a reviewed post cannot bypass the guarded space.
            return;
        }
        $content->visibility = Content::VISIBILITY_PRIVATE;
        $content->scheduled_at = null;
        if ($content->isNewRecord) {
            $content->state = Content::STATE_DRAFT;
            return;
        }
        if ((int)$content->state === Content::STATE_PUBLISHED) {
            $alreadyApproved = $review && $review['status'] === 'approved'
                && (int)$content->getOldAttribute('state') === Content::STATE_PUBLISHED;
            $authorizedTransition = self::$publishingContentId === (int)$content->id
                && $review && $review['status'] === 'approved';
            if (!$alreadyApproved && !$authorizedTransition) {
                $event->isValid = false;
            }
        } elseif (!in_array((int)$content->state, [Content::STATE_DRAFT, Content::STATE_DELETED], true)) {
            $event->isValid = false; // Scheduled publishing is not human approval.
        }
    }

    public static function publishReviewed(Content $content): bool
    {
        if (self::$publishingContentId !== null) {
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
            ['pattern' => 'ummahreview/post/<id:\d+>', 'route' => 'ummahreview/review/view', 'verb' => 'GET'],
            ['pattern' => 'ummahreview/submissions', 'route' => 'ummahreview/review/submit', 'verb' => 'POST'],
            ['pattern' => 'ummahreview/reviews', 'route' => 'ummahreview/review/queue', 'verb' => 'GET'],
            ['pattern' => 'ummahreview/reviews/<id:\\d+>', 'route' => 'ummahreview/review/decide', 'verb' => 'POST'],
        ], 'ummahreview');
    }
}
