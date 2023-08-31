import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class extends BaseSchema {
  protected tableName = 'chat_messages';

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id');
      table.string('content', 500);
      table.integer('stream_id').notNullable().references('streams.id').onDelete('CASCADE');
      table.integer('chat_room_id').notNullable().references('chat_rooms.id').onDelete('CASCADE');
      table.integer('sent_by_id').nullable().references('users.id').onDelete('CASCADE');
      table.timestamp('sent_at', { useTz: true });
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
