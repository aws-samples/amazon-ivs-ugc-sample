import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class extends BaseSchema {
  protected tableName = 'metrics';

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id');
      table.integer('stream_id').unsigned().references('streams.id');
      table.string('ip');
      table.string('browser_name');
      table.string('browser_version');
      table.string('os');
      table.string('user_agent');
      table.boolean('is_mobile');
      table.string('tz');
      table.string('available_resolution');
      table.string('current_resolution');
      table.string('quality');
      table.string('codecs');
      table.integer('bitrate');
      table.integer('framerate');
      table.decimal('latency');
      table.decimal('buffer');
      table.timestamp('created_at', { useTz: true });
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
