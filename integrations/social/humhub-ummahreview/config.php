<?php
use humhub\modules\post\models\Post;
use humhub\modules\content\models\Content;
use humhub\modules\rest\Module as RestModule;
use humhub\modules\ummahreview\Events;
return [
    'id' => 'ummahreview',
    'class' => 'humhub\\modules\\ummahreview\\Module',
    'namespace' => 'humhub\\modules\\ummahreview',
    'events' => [
        [Post::class, Post::EVENT_BEFORE_INSERT, [Events::class, 'beforePostInsert']],
        [Post::class, Post::EVENT_BEFORE_UPDATE, [Events::class, 'beforePostUpdate']],
        [Content::class, Content::EVENT_BEFORE_INSERT, [Events::class, 'beforeContentSave']],
        [Content::class, Content::EVENT_BEFORE_UPDATE, [Events::class, 'beforeContentSave']],
        // External module namespaces are registered after discovery. A class
        // constant would force REST autoload too early; use its pinned event name.
        [RestModule::class, 'restApiAddRules', [Events::class, 'restRules']],
    ],
];
