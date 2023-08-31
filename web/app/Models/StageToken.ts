import { BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import AbstractModel from './AbstractModel';
import Stage from './Stage';
import User from './User';

export default class StageToken extends AbstractModel {
  @column({ isPrimary: true })
  public id: number;

  @column()
  public participantId: string;

  @column()
  public token: string;

  @column()
  public userId: number;

  @belongsTo(() => User)
  public user: BelongsTo<typeof User>;

  @column()
  public stageId: number;

  @belongsTo(() => Stage)
  public stage: BelongsTo<typeof Stage>;

  @column.dateTime()
  public expiresAt: DateTime;

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime;

  public isStageTokenExpired() {
    if (!this.expiresAt) return true;
    return this.expiresAt.diffNow().toMillis() <= 10000;
  }
}
