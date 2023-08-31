import { HasMany, column, hasMany } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import AbstractModel from './AbstractModel';
import StageToken from './StageToken';

export default class Stage extends AbstractModel {
  @column({ isPrimary: true })
  public id: number;

  @column()
  public name: string;

  @column()
  public arn: string;

  @column()
  public userId: number;

  @hasMany(() => StageToken)
  public stageTokens: HasMany<typeof StageToken>;

  @column()
  public isLive: boolean;

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime;
}
