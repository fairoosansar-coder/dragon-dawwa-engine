<?php
use yii\db\Migration;

class m261016_000001_review_events extends Migration
{
    public function safeUp()
    {
        $this->createTable('{{%ummah_review_event}}', [
            'id' => $this->bigPrimaryKey(),
            'attempt_key' => $this->string(32)->notNull(),
            'operation_key' => $this->string(64)->notNull(),
            'operation' => $this->string(16)->notNull(),
            'phase' => $this->string(16)->notNull(),
            'outcome' => $this->string(16)->notNull(),
            'actor_id' => $this->integer()->notNull(),
            'requested_review_id' => $this->integer(),
            'review_id' => $this->integer(),
            'version_hash' => $this->string(64),
            'decision' => $this->string(20),
            'reason' => $this->string(40),
            'created_at' => $this->dateTime()->notNull(),
        ], 'ENGINE=InnoDB');
        // Deliberately no cascading foreign keys: retention survives native post deletion.
        $this->createIndex('ummah_event_attempt_phase', '{{%ummah_review_event}}', ['attempt_key', 'phase'], true);
        $this->createIndex('ummah_event_operation', '{{%ummah_review_event}}', ['actor_id', 'operation_key', 'id']);
        $table = $this->db->quoteTableName($this->db->schema->getRawTableName('{{%ummah_review_event}}'));
        foreach (['UPDATE', 'DELETE'] as $verb) {
            $name = $this->db->quoteTableName('ummah_review_event_no_' . strtolower($verb));
            $this->execute('CREATE TRIGGER ' . $name . ' BEFORE ' . $verb . ' ON ' . $table
                . " FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Review audit events are append-only'");
        }
    }
    public function safeDown()
    {
        return false; // Never silently discard review evidence.
    }
}
