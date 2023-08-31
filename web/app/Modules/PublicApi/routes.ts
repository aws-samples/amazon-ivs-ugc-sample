/* eslint-disable prettier/prettier */
import Route from '@ioc:Adonis/Core/Route';
import Database from '@ioc:Adonis/Lucid/Database';
import ChannelService from '@ioc:StreamCat/ChannelService';
import ChatRoomService from '@ioc:StreamCat/ChatRoomService';
import RealTimeService from '@ioc:StreamCat/RealTimeService';
import Channel from 'App/Models/Channel';
import ChatRoom from 'App/Models/ChatRoom';
import Metric from 'App/Models/Metric';
import Stage from 'App/Models/Stage';
import StageToken from 'App/Models/StageToken';
import Stream from 'App/Models/Stream';
import { DateTime } from 'luxon';
import uuid4 from 'uuid4';

Route.group(() => {
  Route.post('/chat/token', async ({ auth, request, response }) => {
    const body = request.body();
    const arn = body.chatArn;
    const chatRoom = await ChatRoom.findBy('arn', arn);
    const userId = auth.user?.id || uuid4();
    const username = auth.user?.username || `Guest${new Date().getTime().toString().substring(10, 13)}`;
    const isAdmin = auth.user?.id === chatRoom?.userId;
    const isGuest = !auth.user;
    const token = await ChatRoomService.createChatToken(arn, userId, username, isAdmin, isGuest);
    return response.send({ token: token.token, isAdmin, userId, username });
  });

  Route.post('/multihost/disconnect', async ({ auth, request, response }) => {
    const body = request.body();
    const participantId = body.participantId;
    const userId = body.userId;
    await auth.user?.load('stage');
    const stageArn = auth.user?.stage.arn;
    if (auth.user && stageArn) {
      await RealTimeService.disconnectParticipant(participantId, stageArn);
      // prettier-ignore
      await StageToken
        .query()
        .where('userId', Number(userId))
        .andWhere('stageId', auth.user?.stage.id)
        .delete();
      return response.noContent();
    } else {
      throw Error('Invalid multihost token request');
    }
  }).middleware('auth');

  Route.post('/multihost/invite', async ({ auth, request, response }) => {
    const body = request.body();
    const userId = body.userId;
    const username = body.username;
    const chatArn = body.chatArn;
    const broadcastType = body.broadcastType;
    if (!userId || !username) throw Error('Invalid multihost token request');
    await auth.user?.load('stage');
    const stageArn = auth.user?.stage.arn;
    if (auth.user && stageArn) {
      let token = await RealTimeService.createStageToken(
        userId,
        username,
        stageArn,
        ['PUBLISH', 'SUBSCRIBE']
      );
      await StageToken.create({
        participantId: token.participantToken?.participantId,
        token: token.participantToken?.token,
        userId: Number(token.participantToken?.userId),
        expiresAt: DateTime.fromJSDate(token.participantToken?.expirationTime!),
        stageId: auth.user?.stage.id,
      });
      ChatRoomService.sendChatEvent(chatArn, 'StreamCat:MultihostInvite', {
        userId,
        broadcastType,
        stage: auth.user?.stage.name
      });
      return response.created();
    } else {
      throw Error('Invalid multihost token request');
    }
  }).middleware('auth');

  Route.post('/stage/update', async ({ auth, request, response }) => {
    const body = request.body();
    const isLive = body.isLive;
    const chatArn = body.chatArn;
    await auth.user?.load('stage');
    auth.user!.stage.isLive = body.isLive;
    await auth.user?.stage.save();
    await ChatRoomService.sendChatEvent(
      chatArn,
      'StreamCat:RealTimeUpdate',
      { isLive: isLive.toString() }
    );
    return response.noContent();
  }).middleware('auth');

  Route.get('/stage/info/:name', async ({ response, params }) => {
    const channel: Channel = await Channel.findByOrFail('name', params.name);
    const stage: Stage = await Stage.findByOrFail('name', params.name);
    return response.send({ name: channel.name, isPartner: channel.isPartner, isLive: stage.isLive });
  });

  Route.post('/channel/follow', async ({ response, request, auth }) => {
    const id = request.body().channelId;
    const channel = await Channel.find(id);
    if (channel) {
      await auth.user?.related('followedChannels').attach([channel.id]);
      await channel.refresh();
      const followers = await channel.followerCount();
      if (followers >= 5 && !channel.isPartner) {
        channel.isPartner = true;
        channel.save();
        ChannelService.updateChannelType(channel.arn, 'ADVANCED_HD', 'HIGHER_BANDWIDTH_DELIVERY');
      }
    }
    return response.noContent();
  });

  Route.post('/player/analytics', async ({ request }) => {
    const body = request.body();
    const { channelId, ...metrics } = body;
    const stream = await Stream
      .query()
      .where('channelId', channelId)
      .andWhereNull('endedAt')
      .orderBy('startedAt', 'desc')
      .first();
    if (stream?.id) {
      const metric = await Metric.create(metrics);
      await metric.related('stream').associate(stream);
    }
  });

  Route.get('/stream/viewers/:channelId', async ({ params, response }) => {
    const channel = await Channel.find(params.channelId);
    await channel?.load('streams');
    const stream = channel?.currentStream();
    let viewers = 0;
    if (stream?.id) {
      const viewerQry = await Database.rawQuery(`
        select count(distinct ip) as unique_viewers
        from metrics
        where to_char(created_at, 'HH:MI') = (
          select max(to_char(created_at, 'HH:MI')) 
          from metrics
          where stream_id = ?
        )
        and stream_id = ?
        group by to_char(created_at, 'HH:MI')`,
        [stream.id, stream.id]
      );
      viewers = viewerQry.rows[0]?.unique_viewers || 0;
    }
    response.send({ viewers });
  });

  Route.get('/stream/:channelId', async ({ params, response }) => {
    const channel = await Channel.find(params.channelId);
    const streamResponse = await ChannelService.getStream(channel?.arn!);
    response.send(streamResponse.stream);
  });
}).prefix('/api');
