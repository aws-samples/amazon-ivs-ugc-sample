/* eslint-disable prettier/prettier */
import Route from '@ioc:Adonis/Core/Route';
import User from 'App/Models/User';
import Env from '@ioc:Adonis/Core/Env';
import ChannelService from '@ioc:StreamCat/ChannelService';
import ChatRoomService from '@ioc:StreamCat/ChatRoomService';
import RealTimeService from '@ioc:StreamCat/RealTimeService';
import { CreateChannelCommandOutput } from '@aws-sdk/client-ivs';
import { CreateRoomCommandOutput } from '@aws-sdk/client-ivschat';
import { CreateStageCommandOutput } from '@aws-sdk/client-ivs-realtime';
import Channel from 'App/Models/Channel';
import ChatRoom from 'App/Models/ChatRoom';
import Stream from 'App/Models/Stream';
import Stage from 'App/Models/Stage';
import ChatMessage from 'App/Models/ChatMessage';
import uuid4 from 'uuid4';
import Category from 'App/Models/Category';

Route.group(() => {
  Route.get('/', async ({ view }) => {
    const liveChannels = await Channel
      .query()
      .where('isLive', true)
      .preload('streams')
      .preload('category')
      .limit(8);
    const liveRealtimeChannels = await Stage
      .query()
      .where('isLive', true)
      .limit(8);
    const recentBroadcasts = await Stream
      .query()
      .whereNotNull('recordingEndedAt')
      .orderBy('startedAt', 'desc')
      .preload('channel')
      .preload('category')
      .limit(8);
    return view.render('index', {
      liveChannels,
      liveRealtimeChannels,
      recentBroadcasts,
    });
  });

  Route.get('/category/:categoryName', async ({ view, params }) => {
    // prettier-ignore
    const liveChannels = await Channel.query()
      .where('is_live', true)
      .preload('category', (categoryQuery) => {
        categoryQuery.where(
          'name',
          decodeURIComponent(params.categoryName)
        );
      })
      .preload('streams')
      .limit(8);
    return view.render('category', {
      liveChannels,
      categoryName: params.categoryName,
    });
  });

  Route.get('/channel/:channelName', async ({ auth, view, params }) => {
    // retrieve the Channel from the DB
    const channel = await Channel
      .query()
      .preload('category')
      .preload('streams', (streamQry) => {
        streamQry
          .whereNotNull('recordingEndedAt')
          .orderBy('startedAt', 'desc')
          .limit(8);
      })
      .where('name', params.channelName)
      .first();
    // retrieve the ChatRoom from the DB
    const chatRoom = await ChatRoom.findBy('user_id', channel?.userId);

    // load the user's followed channels
    await auth.user?.load('followedChannels');

    // does the user follow this channel?
    const userChannelIdx = channel ? auth.user?.followedChannels.findIndex((c) => c.id === channel?.id) : -1;

    // render the view
    return view.render('channel', {
      channel,
      chatRoom,
      followsChannel: userChannelIdx! > -1,
    });
  });

  Route.get('/channel/realtime/:stageName', async ({ auth, params, view }) => {
    // retrieve the Stage from the DB
    const stageName = params.stageName;
    const stage = await Stage.query().where('name', stageName).first();

    // retrieve the Channel from the DB
    const channel = await Channel.query().where('name', stageName).first();
    await channel?.load('category');

    // retrieve the ChatRoom from the DB
    const chatRoom = await ChatRoom.query().where('userId', channel?.userId!).first();

    // generate a stage participant token for the viewer
    const userId = auth.user?.id.toString() || uuid4();
    const username = auth.user?.username || `Guest${new Date().getTime().toString().substring(10, 13)}`;
    const stageToken = await RealTimeService.createStageToken(
      userId,
      username,
      stage?.arn!,
      ['SUBSCRIBE']
    );

    // render the view
    return view.render('multihost-player', {
      stageToken: stageToken.participantToken,
      stage: { name: stageName, id: stage?.id },
      channel: channel,
      chatArn: chatRoom?.arn,
      chatEndpoint: chatRoom?.endpoint,
    });
  });

  Route.get('/multihost/:broadcastType/:stageName', async ({ auth, params, view, response }) => {
    const stageName = params.stageName;
    const broadcastType = params.broadcastType;
    if (['lowlatency', 'realtime'].indexOf(broadcastType) === -1) response.redirect('/');
    const stage = await Stage.query().where('name', stageName).first();
    const channel = await Channel.query().where('name', stageName).first();
    const chatRoom = await ChatRoom.query().where('userId', channel?.userId!).first();
    const isHost = auth.user?.id === stage?.userId;
    if (!stage) response.redirect('/');
    const stageToken = await auth.user?.getCurrentTokenForStage(stage?.id!);
    await stageToken?.load('user');
    return view.render('multihost-broadcast', {
      broadcastType,
      isHost,
      stageToken,
      stage: { name: stageName, id: stage?.id },
      channel: channel,
      chatArn: chatRoom?.arn,
      chatEndpoint: chatRoom?.endpoint,
    });
  })
    .middleware('auth')
    .middleware('multiHostAuth');

  Route.get('/vod/:streamId', async ({ auth, view, params, response }) => {
    const stream = await Stream
      .query()
      .where('id', params.streamId)
      .preload('channel', (channelQry) => {
        channelQry
          .preload('category')
          .preload('streams', (streamsQry) => {
            streamsQry
              .whereNotNull('recordingEndedAt')
              .orderBy('startedAt', 'desc')
              .limit(8);
          });
      })
      .first();
    if (!stream) return response.redirect('/');
    const chatLog = await ChatMessage.query().where('streamId', params.streamId).preload('sentBy');
    await auth.user?.load('followedChannels');
    const userChannelIdx = stream?.channel ? auth.user?.followedChannels.findIndex((c) => c.id === stream?.channel?.id) : -1;
    return view.render('vod', {
      chatLog,
      stream,
      channel: stream?.channel,
      followsChannel: userChannelIdx! > -1,
    });
  });

  Route.get('/login', async ({ view }) => {
    return view.render('login');
  });

  Route.post('/register', async ({ auth, request, response }) => {
    const username: string = request.input('username');
    const password: string = request.input('password');
    const user: User = await User.create({ username, password });
    const defaultCategory: Category = await Category.findByOrFail('name', 'Just Chatting');

    // create channel, chat room, and stage
    const createChannelResponse: CreateChannelCommandOutput = await ChannelService.createChannel(username);
    user.related('channel').create({
      name: createChannelResponse.channel?.name,
      playbackUrl: createChannelResponse.channel?.playbackUrl,
      arn: createChannelResponse.channel?.arn,
      ingestEndpoint: createChannelResponse.channel?.ingestEndpoint,
      streamKey: createChannelResponse.streamKey?.value,
      title: `${username}'s Live Stream`,
      categoryId: defaultCategory.id,
    });

    const createChatRoomResponse: CreateRoomCommandOutput = await ChatRoomService.createChatRoom(username);
    user.related('chatRoom').create({
      name: createChatRoomResponse.name,
      arn: createChatRoomResponse.arn,
      endpoint: `wss://edge.ivschat.${Env.get('AWS_REGION')}.amazonaws.com`,
    });

    const createStageResponse: CreateStageCommandOutput = await RealTimeService.createStage(username);
    user.related('stage').create({
      name: createStageResponse.stage?.name,
      arn: createStageResponse.stage?.arn,
    });

    await auth.use('web').attempt(username, password, true);
    return response.redirect('/dashboard');
  });

  Route.post('/login', async ({ auth, request, response, session }) => {
    const username = request.input('username');
    const password = request.input('password');
    try {
      await auth.use('web').attempt(username, password, true);
      response.redirect('/');
    } catch (e) {
      if (e.name === 'InvalidCredentialsException') {
        session.flash('message', 'Invalid login.');
        return response.redirect('/login');
      }
    }
  });

  Route.get('/logout', async ({ auth, response }) => {
    await auth.use('web').logout();
    response.redirect('/login');
  });
});
