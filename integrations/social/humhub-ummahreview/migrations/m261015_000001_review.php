<?php
use yii\db\Migration;
class m261015_000001_review extends Migration
{
    public function safeUp()
    {
        $this->createTable('{{%ummah_review_grant}}', [
            'user_id' => $this->integer()->notNull(),
            'space_id' => $this->integer()->notNull(),
            'can_submit' => $this->boolean()->notNull()->defaultValue(false),
            'can_review' => $this->boolean()->notNull()->defaultValue(false),
            'PRIMARY KEY ([[user_id]], [[space_id]])',
        ], 'ENGINE=InnoDB');
        $this->addForeignKey('ummah_grant_user_fk', '{{%ummah_review_grant}}', 'user_id', '{{%user}}', 'id', 'CASCADE');
        $this->addForeignKey('ummah_grant_space_fk', '{{%ummah_review_grant}}', 'space_id', '{{%space}}', 'id', 'CASCADE');
        $this->createTable('{{%ummah_review}}', [
            'id' => $this->primaryKey(),
            'post_id' => $this->integer()->notNull()->unique(),
            'content_id' => $this->integer()->notNull()->unique(),
            'space_id' => $this->integer()->notNull(),
            'author_id' => $this->integer()->notNull(),
            'request_key' => $this->string(100)->notNull(),
            'request_hash' => $this->string(64)->notNull(),
            'message_hash' => $this->string(64)->notNull(),
            'sources_json' => $this->text()->notNull(),
            'status' => $this->string(20)->notNull()->defaultValue('pending'),
            'reviewer_id' => $this->integer(),
            'review_note' => $this->text(),
            'submitted_at' => $this->dateTime()->notNull(),
            'reviewed_at' => $this->dateTime(),
        ], 'ENGINE=InnoDB');
        $this->createIndex('ummah_review_idempotency', '{{%ummah_review}}', ['author_id', 'request_key'], true);
        $this->createIndex('ummah_review_queue', '{{%ummah_review}}', ['space_id', 'status', 'id']);
        $this->addForeignKey('ummah_review_post_fk', '{{%ummah_review}}', 'post_id', '{{%post}}', 'id', 'CASCADE');
        $this->addForeignKey('ummah_review_content_fk', '{{%ummah_review}}', 'content_id', '{{%content}}', 'id', 'CASCADE');
        $this->addForeignKey('ummah_review_space_fk', '{{%ummah_review}}', 'space_id', '{{%space}}', 'id', 'RESTRICT');
        $this->addForeignKey('ummah_review_author_fk', '{{%ummah_review}}', 'author_id', '{{%user}}', 'id', 'RESTRICT');
        $this->addForeignKey('ummah_review_reviewer_fk', '{{%ummah_review}}', 'reviewer_id', '{{%user}}', 'id', 'RESTRICT');
    }
    public function safeDown()
    {
        // Audit records are not automatically discarded by a module downgrade.
        return false;
    }
}
