<?php
namespace humhub\modules\ummahreview;

class Module extends \humhub\components\Module
{
    public function init()
    {
        parent::init();
        if (getenv('UMMAH_REVIEW_ENVIRONMENT') !== 'isolated-staging' || !self::spaceIds()) {
            throw new \yii\base\InvalidConfigException('Ummah review requires isolated staging and explicit moderated space IDs.');
        }
    }

    public static function spaceIds(): array
    {
        $raw = getenv('UMMAH_REVIEW_SPACE_IDS') ?: '';
        if (!preg_match('/^[1-9][0-9]*(,[1-9][0-9]*){0,19}$/D', $raw)) {
            return [];
        }
        return array_map('intval', explode(',', $raw));
    }

    public static function moderated($space): bool
    {
        return $space instanceof \humhub\modules\space\models\Space
            && in_array((int)$space->id, self::spaceIds(), true);
    }
}
