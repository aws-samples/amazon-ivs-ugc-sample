import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class extends BaseSchema {
  protected tableName = 'metrics';

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign('stream_id');
      table.foreign('stream_id').references('streams.id').onDelete('CASCADE');
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
