<?php

namespace humhub\modules\content\events;

use yii\base\ModelEvent;

/**
 * Generic, cancellable payload for optional Content/File policy extensions.
 *
 * Core callers set only the fields relevant to their operation. Handlers may
 * set $isValid to false without coupling the core to a particular module.
 */
class ContentGuardEvent extends ModelEvent
{
    public ?object $user = null;
    public mixed $target = null;
    public mixed $content = null;
    public array $attributes = [];
    public mixed $query = null;
    public string $operation = '';
}
