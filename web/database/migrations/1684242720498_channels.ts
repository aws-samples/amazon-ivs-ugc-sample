import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class extends BaseSchema {
  protected tableName = 'channels';

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id');
      table.string('name', 255).unique().notNullable();
      table.string('playback_url', 2048).notNullable();
      table.string('ingest_endpoint', 2048).notNullable();
      table.string('stream_key', 250).notNullable();
      table.string('arn', 2048).notNullable();
      table.boolean('is_live').defaultTo(false).notNullable();
      table.integer('category_id').unsigned().references('categories.id');
      table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE');
      table.timestamp('created_at', { useTz: true });
      table.timestamp('updated_at', { useTz: true });
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
