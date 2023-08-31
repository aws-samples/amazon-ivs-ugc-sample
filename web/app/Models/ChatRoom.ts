import { column } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import AbstractModel from './AbstractModel';

export default class ChatRoom extends AbstractModel {
  @column({ isPrimary: true })
  public id: number;

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime;

  @column()
  public name: string;

  @column()
  public arn: string;

  @column()
  public userId: number;

  @column()
  public endpoint: string;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime;
}
