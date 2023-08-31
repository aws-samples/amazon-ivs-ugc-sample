/* eslint-disable prettier/prettier */
import Route from '@ioc:Adonis/Core/Route';
import Database from '@ioc:Adonis/Lucid/Database';
import Category from 'App/Models/Category';
import Channel from 'App/Models/Channel';
import Stream from 'App/Models/Stream';

Route.group(() => {
  Route.get('/', async ({ view }) => {
    return view.render('dashboard/index');
  });

  Route.get('/broadcast', async ({ view, auth }) => {
    await auth.user?.load('channel');
    await auth.user?.load('chatRoom');
    return view.render('dashboard/broadcast', {
      channel: auth.user?.channel,
      chatArn: auth.user?.chatRoom?.arn,
      chatEndpoint: auth.user?.chatRoom?.endpoint,
    });
  });

  Route.get('/api/categories', async ({ response }) => {
    return response.send(await Category.query().select('*').orderBy('sortOrder'));
  });

  Route.post('/api/stream', async ({ auth, request, response }) => {
    const body = request.body();
    const stream = await Stream.findOrFail(body.id);
    await auth.user?.load('channel');
    if (auth.user?.channel.id !== stream?.channelId) {
      throw new Error('Invalid channel owner.');
    }
    stream.$setAttribute('title', body.title);
    stream.$setAttribute('categoryId', body?.categoryId || null);
    stream.save();
    return response.noContent();
  });

  Route.get('/api/channel', async ({ auth, response }) => {
    await auth.user?.load('channel');
    await auth.user?.channel.load('category');
    return response.send(auth.user?.channel);
  });

  Route.get('/api/streams', async ({ auth, response }) => {
    await auth.user?.load('channel');
    const streams = await Stream.query().where('channel_id', auth.user?.channel.id!).orderBy('started_at', 'desc');
    return response.send(streams);
  });

  Route.post('/api/channel', async ({ request, response }) => {
    const body = request.body();
    const channel = await Channel.find(body.channelId);
    const category = await Category.find(body.categoryId);
    const title = body.title;
    if (channel && category) channel.related('category').associate(category);
    if (title) channel?.$setAttribute('title', title);
    channel?.save();
    return response.noContent();
  });

  Route.get('/api/metrics/:streamId', async ({ params, response }) => {
    const browsers = await Database.rawQuery(`
        select 
          count(distinct ip) as viewers, 
          browser_name
        from metrics 
        where stream_id = ?
        group by browser_name
    `, [params.streamId]
    );
    const quality = await Database.rawQuery(`
        with total as (
          select count(id) as total
          from metrics
          where stream_id = ?
        )
        select 
          quality,
          case when total.total > 0 
            then round((count(id)::decimal / total.total::decimal) * 100, 2)
            else 0
          end as pct
        from metrics, total
        where stream_id = ?
        group by quality, total.total
    `, [params.streamId, params.streamId]
    );
    const os = await Database.rawQuery(`
        select 
          count(distinct ip) as viewers, 
          os
        from metrics 
        where stream_id = ?
        group by os
    `, [params.streamId]
    );
    const avgLatency = await Database.rawQuery(`
        select 
          avg(latency) as avg_latency,
          TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from created_at) / 300) * 300 as time_period
        from metrics
        where stream_id = ?
        group by TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from created_at) / 300) * 300
        order by TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from created_at) / 300) * 300
    `, [params.streamId]
    );
    const avgBuffer = await Database.rawQuery(`
        select 
          avg(buffer) as avg_buffer,
          TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from created_at) / 300) * 300 as time_period
        from metrics
        where stream_id = ?
        group by TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from created_at) / 300) * 300
        order by TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from created_at) / 300) * 300
    `, [params.streamId]
    );
    const avgBitrate = await Database.rawQuery(`
        select 
          avg(bitrate / 1000) as avg_bitrate,
          TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from created_at) / 300) * 300 as time_period
        from metrics
        where stream_id = ?
        group by TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from created_at) / 300) * 300
        order by TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from created_at) / 300) * 300
    `, [params.streamId]
    );
    const viewers = await Database.rawQuery(`
        select 
          count(distinct ip) as viewers,
          TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from created_at) / 300) * 300 as time
        from metrics
        where stream_id = ?
        group by TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from created_at) / 300) * 300
        order by TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from created_at) / 300) * 300
    `, [params.streamId]
    );
    const chatMessages = await Database.rawQuery(`
        select 
          count(distinct id) as messages, 
          TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from sent_at) / 60) * 60 as time_period
        from chat_messages 
        where stream_id = ?
        group by TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from sent_at) / 60) * 60
        order by TIMESTAMP WITH TIME ZONE 'epoch' + INTERVAL '1 second' * round(extract('epoch' from sent_at) / 60) * 60
    `, [params.streamId]
    );
    return response.send({
      viewers: viewers.rows,
      chatMessages: chatMessages.rows,
      browsers: browsers.rows,
      os: os.rows,
      avgLatency: avgLatency.rows,
      avgBuffer: avgBuffer.rows,
      avgBitrate: avgBitrate.rows,
      quality: quality.rows,
    });
  });
})
  .middleware('auth')
  .prefix('/dashboard');
