import { CloudWatchLogsClient, FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { profanity } from '@2toad/profanity';
import pg from "pg";
import fetch from "node-fetch";

const cloudwatchClient = new CloudWatchLogsClient();

const { Client, Pool } = pg;

const getSecretValue = async (secretName) => {
  const url = `http://localhost:2773/secretsmanager/get?secretId=${secretName}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "X-Aws-Parameters-Secrets-Token": process.env.AWS_SESSION_TOKEN },
  });
  if (!response.ok) {
    throw new Error(`Error occured while requesting secret ${secretName}. Responses status was ${response.status}`);
  }
  const secretContent = await response.json();
  return JSON.parse(secretContent.SecretString);
};

const responseObj = {
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE',
    'Content-Type': 'application/json',
  },
  body: '',
  isBase64Encoded: false,
};

/* event format
{
    "version": "0",
    "id": "98a31fbd-84bb-a4ee-b4ab-206c487e9705",
    "detail-type": "IVS Stream State Change",
    "source": "aws.ivs",
    "account": "639934345351",
    "time": "2023-05-16T15:54:09Z",
    "region": "us-east-1",
    "resources": [
        "arn:aws:ivs:us-east-1:639934345351:channel/nQ79t4EgS4wQ"
    ],
    "detail": {
        "event_name": "Stream End",
        "channel_name": "recursivecodes",
        "stream_id": "st-1DDZOtkxNK5Lbm1NuNnY5wM"
    }
}
*/

const parseEvents = (events) => {
  let parsedEvents = [];
  events.forEach(e => {
    switch (e.type) {
      case 'MESSAGE':
        parsedEvents.push(e);
        break;
      case 'EVENT':
        if (e.payload.EventName === 'aws:DELETE_MESSAGE') {
          const existingEventIdx = parsedEvents.findIndex(parsedEvent => {
            return parsedEvent.payload.Id === e.payload.Attributes.MessageID;
          });
          if (existingEventIdx > -1) {
            parsedEvents.splice(existingEventIdx, 1);
          }
        }
        break;
    }
  });
  return parsedEvents;
};

const getChatMessages = async (logStreamName, startTime, endTime) => {
  const filterLogEventsInput = {
    logGroupName: 'streamcat-chat-log-group',
    logStreamNames: [logStreamName],
    startTime,
    endTime,
  };
  const filterLogEventsRequest = new FilterLogEventsCommand(filterLogEventsInput);
  const filterLogEventsResponse = await cloudwatchClient.send(filterLogEventsRequest);
  const events = filterLogEventsResponse.events.map(e => JSON.parse(e.message));
  return parseEvents(events);
};

export const streamStateChanged = async (event) => {
  console.log(JSON.stringify(event, null, 2));
  const STREAM_STATE_EVENTS = ['Stream Start', 'Stream End'];
  const RECORDING_EVENTS = ['Recording Start', 'Recording End'];

  const getPool = async () => {
    const secrets = await getSecretValue(process.env.SECRET_NAME);
    const DB_USER = secrets.dbUser;
    const DB_PASSWORD = secrets.dbPassword;
    const DB_HOST = secrets.dbHost;
    const DB_DATABASE = secrets.dbDatabase;
    return new Pool({
      user: DB_USER,
      host: DB_HOST,
      database: DB_DATABASE,
      password: DB_PASSWORD,
      port: 5432,
    });
  };

  if (STREAM_STATE_EVENTS.indexOf(event.detail.event_name) > -1) {
    const pool = await getPool();
    const client = await pool.connect();
    client.on('error', (err) => console.error(err));
    try {
      const isLive = event.detail.event_name === 'Stream Start';
      const channelResult = await client.query(`
        select id, title, category_id
        from channels 
        where arn = $1`,
        [
          event.resources[0]
        ]);
      const channelId = channelResult.rows[0].id;
      await client.query(`
        update channels 
          set is_live = $1 
        where id = $2`,
        [
          isLive,
          channelId
        ]);
      await client.query(`
        insert into streams (stream_id, channel_id, started_at, title, category_id ) 
        values ($1, $2, $3, $4, $5) 
        on conflict(stream_id) do update set 
          ${isLive ? 'started_at' : 'ended_at'} = $3`,
        [
          event.detail.stream_id,
          channelId,
          event.time,
          channelResult.rows[0].title,
          channelResult.rows[0]?.category_id || null,
        ]
      );

      // archive chat messages
      if (event.detail.event_name === 'Stream End') {
        const stream = await client.query(`
          select 
            id, 
            date_part('epoch', started_at) * 1000 as started_at,
            date_part('epoch', ended_at) * 1000 as ended_at
          from streams
          where stream_id = $1`,
          [
            event.detail.stream_id,
          ]
        );
        const streamId = stream.rows[0].id;
        const streamStartedAt = stream.rows[0].started_at;
        const streamEndedAt = stream.rows[0].ended_at;
        const chatRoom = await client.query(`
          select id, arn
          from chat_rooms
          where name = $1`,
          [
            event.detail.channel_name,
          ]
        );
        const chatRoomId = chatRoom.rows[0].id;
        const chatRoomArn = chatRoom.rows[0].arn;
        const chatRoomArnId = chatRoomArn.split('/')[1];
        const chatLogName = `aws/IVSChatLogs/1.0/room_${chatRoomArnId}`;
        const chatMessages = await getChatMessages(chatLogName, streamStartedAt, streamEndedAt);
        let start = 0;
        await client.query(`
          insert into chat_messages (stream_id, chat_room_id, content, sent_at, sent_by_id)
          values
            ${Array
            .from({ length: chatMessages.length })
            .map((e, idx) => {
              start = Number(start) + 3;
              return '($1::integer, $2::integer, ' + '$' + start + '::text, $' + (Number(start) + 1) + '::timestamp, $' + (Number(start) + 2) + '::integer)';
            })
            .join()}
          `, [streamId, chatRoomId, chatMessages.map((e) => [e.payload.Content, e.payload.SendTime, e.payload?.Sender?.Attributes?.isGuest !== 'true' ? Number(e.payload?.Sender.UserId) : null]).flat()].flat()
        );
      }
    }
    catch (e) {
      console.log('*** ERROR ***');
      console.log(e);
    }
    finally {
      client.release(true);
      await pool.end();
    }
  }

  if (RECORDING_EVENTS.indexOf(event.detail.recording_status) > -1) {
    const pool = await getPool();
    const client = await pool.connect();
    client.on('error', (err) => console.error(err));
    try {
      if (event.detail.recording_status === 'Recording Start') {
        const channelResult = await client.query(`
          select id, title, category_id
          from channels 
          where arn = $1`,
          [
            event.resources[0]
          ]
        );
        const channelId = channelResult.rows[0].id;
        client.query(`
          insert into streams (stream_id, channel_id, recording_started_at, title, recording_path, category_id)
          values ($1, $2, $3, $4, $5, $6)
          on conflict(stream_id) do update set
            recording_started_at = $3,
            recording_path = $5`,
          [
            event.detail.stream_id,
            channelId,
            event.time,
            channelResult.rows[0].title,
            event.detail?.recording_s3_key_prefix,

          ]
        );
      }
      if (event.detail.recording_status === 'Recording End') {
        client.query(`
          update streams set 
            recording_ended_at = $1,
            recording_duration_ms = $2,
            recording_path = $3
          where stream_id = $4`,
          [
            event.time,
            event.detail?.recording_duration_ms,
            event.detail?.recording_s3_key_prefix,
            event.detail.stream_id,
          ]
        );
      }
    }
    catch (e) {
      console.log('*** ERROR ***');
      console.log(e);
    }
    finally {
      client.release(true);
      await pool.end();
    }
  }
  return responseObj;
};

export const moderateChat = async (event) => {
  console.log('moderateChat:', JSON.stringify(event, null, 2));
  return {
    ReviewResult: 'ALLOW',
    Content: profanity.censor(event.Content),
    Attributes: event.Attributes
  };
};