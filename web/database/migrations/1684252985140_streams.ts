import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class extends BaseSchema {
  protected tableName = 'streams';

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary();
      table.string('stream_id', 100).unique().notNullable();
      table.integer('channel_id').unsigned().references('channels.id').onDelete('CASCADE');
      table.string('recording_path', 2048).nullable();
      table.bigInteger('recording_duration_ms');
      table.timestamp('recording_started_at', { useTz: true });
      table.timestamp('recording_ended_at', { useTz: true });
      table.timestamp('started_at', { useTz: true });
      table.timestamp('ended_at', { useTz: true });
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
