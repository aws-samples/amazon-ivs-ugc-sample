/* eslint-disable prettier/prettier */
import Hash from '@ioc:Adonis/Core/Hash';
import { HasMany, HasOne, ManyToMany, beforeSave, column, hasMany, hasOne, manyToMany } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import AbstractModel from './AbstractModel';
import Channel from './Channel';
import ChatRoom from './ChatRoom';
import Stage from './Stage';
import StageToken from './StageToken';

export default class User extends AbstractModel {
  @column({ isPrimary: true })
  public id: number;

  @column()
  public username: string;

  @column({ serializeAs: null })
  public password: string;

  @column()
  public rememberMeToken: string | null;

  @hasOne(() => Channel)
  public channel: HasOne<typeof Channel>;

  @hasOne(() => ChatRoom)
  public chatRoom: HasOne<typeof ChatRoom>;

  @hasOne(() => Stage)
  public stage: HasOne<typeof Stage>;

  @manyToMany(() => Channel, {
    pivotTable: 'user_channels',
    pivotTimestamps: true,
  })
  public followedChannels: ManyToMany<typeof Channel>;

  @hasMany(() => StageToken)
  public stageTokens: HasMany<typeof StageToken>;

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime;

  @beforeSave()
  public static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await Hash.make(user.password);
    }
  }
  public async getCurrentTokenForStage(stageId: number) {
    const user: User = this;
    const token = await user
      .related('stageTokens')
      .query()
      .where('stageId', stageId)
      .orderBy('expiresAt', 'desc')
      .first();
    return token;
  }
}
