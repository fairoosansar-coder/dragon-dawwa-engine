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
        $manifest = json_decode(file_get_contents(__DIR__ . '/core-hooks/manifest.json'), true, 16, JSON_THROW_ON_ERROR);
        foreach ($manifest['patchedFiles'] as $relative => $expected) {
            $file = \Yii::$app->basePath . '/' . $relative;
            if (!is_file($file) || !hash_equals($expected, hash_file('sha256', $file))) {
                throw new \yii\base\InvalidConfigException('Audited HumHub review hooks are missing or changed.');
            }
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

    public static function containerIds(): array
    {
        return array_map('intval', (new \yii\db\Query())->select('contentcontainer_id')
            ->from('{{%space}}')->where(['id' => self::spaceIds()])->column());
    }

    public static function moderated($space): bool
    {
        return $space instanceof \humhub\modules\space\models\Space
            && in_array((int)$space->id, self::spaceIds(), true);
    }
}
