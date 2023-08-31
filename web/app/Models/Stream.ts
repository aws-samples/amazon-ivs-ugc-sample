import Env from '@ioc:Adonis/Core/Env';
import { BelongsTo, HasMany, belongsTo, column, computed, hasMany } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import prettyPrint from 'pretty-print-ms';
import AbstractModel from './AbstractModel';
import Channel from './Channel';
import ChatMessage from './ChatMessage';
import Category from './Category';

export default class Stream extends AbstractModel {
  @column({ isPrimary: true })
  public id: number;

  @column()
  public streamId: string;

  @column()
  public channelId: number;

  @belongsTo(() => Channel)
  public channel: BelongsTo<typeof Channel>;

  @column()
  public title: string;

  @column()
  public categoryId: number;

  @belongsTo(() => Category, {
    foreignKey: 'categoryId',
  })
  public category: BelongsTo<typeof Category>;

  @column()
  public recordingPath: string;

  @column()
  public recordingDurationMs: number;

  @hasMany(() => ChatMessage)
  public chatMessages: HasMany<typeof ChatMessage>;

  @column.dateTime()
  public recordingStartedAt: DateTime;

  @column.dateTime()
  public recordingEndedAt: DateTime;

  @column.dateTime()
  public startedAt: DateTime;

  @column.dateTime()
  public endedAt: DateTime;

  @computed()
  public get masterPlaylistUrl() {
    return `https://${Env.get('CF_DOMAIN')}/${this.recordingPath}/media/hls/master.m3u8`;
  }

  @computed()
  public get thumbnailFolder() {
    return `${Env.get('VOD_BUCKET_NAME')}/${this.recordingPath}/media/thumbnails`;
  }

  @computed()
  public get thumbnailBaseUrl() {
    return `https://${Env.get('CF_DOMAIN')}/${this.recordingPath}/media/latest_thumbnail`;
  }

  // get latest thumbnail - Math.floor(now() - recordingStartedAt

  @computed()
  public get latestThumbnail() {
    /*
    let thumbNum: number = 0;
    if (this.startedAt && !this.endedAt) {
      thumbNum = Math.floor(DateTime.now().diff(this.startedAt, 'minutes').as('minutes')) * 2;
    }
    if (this.isVod && this.endedAt) {
      thumbNum = Math.floor(this.endedAt.diff(this.startedAt, 'minutes').as('minutes')) * 2;
    }
    return `${this.thumbnailBaseUrl}/thumb${thumbNum}.jpg`;
    */
    return `https://${Env.get('CF_DOMAIN')}/${this.recordingPath}/media/latest_thumbnail/thumb.jpg`;
  }

  @computed()
  public get recordingDuration() {
    return prettyPrint(this.recordingDurationMs || 0);
  }

  @computed()
  public get recordedRelativeTime() {
    return this.recordingStartedAt?.toRelative();
  }

  @computed()
  public get startedRelativeTime() {
    return this.startedAt?.toRelative();
  }

  @computed()
  public get isLive() {
    return this.endedAt === null;
  }

  @computed()
  public get isVod() {
    return this.endedAt !== null;
  }
}
