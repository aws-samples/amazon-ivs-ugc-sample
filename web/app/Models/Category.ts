import { column } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import AbstractModel from './AbstractModel';

export default class Category extends AbstractModel {
  @column({ isPrimary: true })
  public id: number;

  @column()
  public name: string;

  @column()
  public sortOrder: number;

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime;
}
