import Database from '@ioc:Adonis/Lucid/Database';
import { BelongsTo, HasMany, ManyToMany, belongsTo, column, computed, hasMany, manyToMany } from '@ioc:Adonis/Lucid/Orm';
import { DateTime } from 'luxon';
import AbstractModel from './AbstractModel';
import Category from './Category';
import Stream from './Stream';
import User from './User';

export default class Channel extends AbstractModel {
  @column({ isPrimary: true })
  public id: number;

  @column()
  public name: string;

  @column()
  public title: string;

  @column()
  public playbackUrl: string;

  @column()
  public ingestEndpoint: string;

  @column()
  public arn: string;

  @column()
  public streamKey: string;

  @column()
  public userId: number;

  @column()
  public isLive: boolean;

  @hasMany(() => Stream)
  public streams: HasMany<typeof Stream>;

  @manyToMany(() => User, {
    pivotTable: 'user_channels',
  })
  public followers: ManyToMany<typeof User>;

  @column()
  public categoryId: number;

  @belongsTo(() => Category, {
    foreignKey: 'categoryId',
  })
  public category: BelongsTo<typeof Category>;

  @column()
  public isPartner: boolean;

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime;

  @computed()
  public get rtmpsEndpoint() {
    return `rtmps://${this.ingestEndpoint}:443/app/`;
  }

  public async followerCount() {
    const followerQry = await Database.rawQuery('select count(id) from user_channels where channel_id = ?', [this.id]);
    return Number(followerQry?.rows[0]?.count || 0);
  }

  public async followerCountFormatted() {
    const followerQry = await Database.rawQuery('select count(id) from user_channels where channel_id = ?', [this.id]);
    const followers = followerQry?.rows[0]?.count || 0;
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 }).format(followers);
  }

  public currentStream() {
    const sortedStreams = this.streams.sort((a, b) => {
      if (a.startedAt < b.startedAt) return 1;
      if (a.startedAt > b.startedAt) return -1;
      return 0;
    });
    return sortedStreams.length ? sortedStreams[0] : null;
  }
}
