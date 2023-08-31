import { BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import AbstractModel from './AbstractModel';
import ChatRoom from './ChatRoom';
import Stream from './Stream';
import User from './User';

export default class ChatMessage extends AbstractModel {
  @column({ isPrimary: true })
  public id: number;

  @column()
  public content: string;

  @column()
  public chatRoomId: number;

  @belongsTo(() => ChatRoom)
  public chatRoom: BelongsTo<typeof ChatRoom>;

  @column()
  public streamId: number;

  @belongsTo(() => Stream)
  public stream: BelongsTo<typeof Stream>;

  @column()
  public sentById: number;

  @belongsTo(() => User, {
    foreignKey: 'sentById',
  })
  public sentBy: BelongsTo<typeof User>;

  @column.dateTime()
  public sentAt: DateTime;
}
