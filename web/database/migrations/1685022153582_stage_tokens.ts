import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class extends BaseSchema {
  protected tableName = 'stage_tokens';

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('token', 4056).alter();
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
