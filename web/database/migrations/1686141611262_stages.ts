import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class extends BaseSchema {
  protected tableName = 'stages';

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_live').defaultTo(false).notNullable();
    });
  }

  public async down() {
    this.schema.dropTable(this.tableName);
  }
}
