import { BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import AbstractModel from './AbstractModel';
import Stream from './Stream';

export default class Metric extends AbstractModel {
  @column({ isPrimary: true })
  public id: number;

  @column()
  public streamId: number;

  @belongsTo(() => Stream)
  public stream: BelongsTo<typeof Stream>;

  @column()
  public ip: string;

  @column()
  public browserName: string;

  @column()
  public browserVersion: string;

  @column()
  public os: string;

  @column()
  public userAgent: string;

  @column()
  public isMobile: boolean;

  @column()
  public tz: string;

  @column()
  public availableResolution: string;

  @column()
  public currentResolution: string;

  @column()
  public quality: string;

  @column()
  public codecs: string;

  @column()
  public bitrate: number;

  @column()
  public framerate: number;

  @column()
  public latency: number;

  @column()
  public buffer: number;

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime;
}
