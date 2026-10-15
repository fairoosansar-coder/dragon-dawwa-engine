<?php
use humhub\modules\content\components\ActiveQueryContent;
use humhub\modules\content\events\ContentGuardEvent;
use humhub\modules\content\search\ContentSearchProvider;
use humhub\modules\content\search\driver\AbstractDriver;
use humhub\modules\content\models\Content;
use humhub\modules\file\components\FileManager;
use humhub\modules\file\models\File;
use humhub\modules\post\models\Post;
use humhub\modules\rest\Module as RestModule;
use humhub\modules\stream\models\StreamQuery;
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
        [Content::class, Content::EVENT_BEFORE_MOVE, [Events::class, 'beforeNativeContentMove']],
        [Content::class, Content::EVENT_BEFORE_UPDATE_ATTRIBUTES, [Events::class, 'beforeNativeContentUpdateAttributes']],
        [Content::class, Content::EVENT_BEFORE_CAN_VIEW, [Events::class, 'beforeNativeContentView']],
        [FileManager::class, FileManager::EVENT_BEFORE_MUTATE, [Events::class, 'beforeNativeFileMutation']],
        [File::class, File::EVENT_BEFORE_INSERT, [Events::class, 'beforeNativeFileInsert']],
        [File::class, File::EVENT_BEFORE_UPDATE, [Events::class, 'beforeNativeFileUpdate']],
        [File::class, File::EVENT_BEFORE_DELETE, [Events::class, 'beforeNativeFileDelete']],
        [File::class, File::EVENT_BEFORE_UPDATE_ATTRIBUTES, [Events::class, 'beforeNativeFileUpdateAttributes']],
        [File::class, File::EVENT_BEFORE_CAN_VIEW, [Events::class, 'beforeNativeFileView']],
        [ActiveQueryContent::class, ActiveQueryContent::EVENT_BEFORE_READABLE, [Events::class, 'restrictNativeReadableQuery']],
        [StreamQuery::class, StreamQuery::EVENT_AFTER_FILTER, [Events::class, 'restrictNativeStreamQuery']],
        [ContentSearchProvider::class, ContentSearchProvider::EVENT_FILTER_RESULTS, [Events::class, 'restrictNativeSearchResults']],
        [AbstractDriver::class, AbstractDriver::EVENT_FILTER_RESULTS, [Events::class, 'restrictNativeSearchResults']],
        // External module namespaces are registered after discovery. A class
        // constant would force REST autoload too early; use its pinned event name.
        [RestModule::class, 'restApiAddRules', [Events::class, 'restRules']],
    ],
];
