import { Utils } from './utils.js';
const { IVSBroadcastClient } = window;
const { Stage, SubscribeType, StageEvents, StreamType } = IVSBroadcastClient;

document.addEventListener('alpine:init', () => {
  Alpine.data('model', (stageName, stageToken) => ({
    audioStream: false,
    stageName,
    stage: null,
    stageToken,
    stageObj: null,
    isLive: false,
    broadcastClient: null,
    stageParticipants: [],
    participantIds: [],
    participantStreams: {},
    // prettier-ignore
    layouts: [
      [{ height: 720, width: 1280, x: 320, y: 180 }],
      [{ height: 450, width: 800, x: 80, y: 315 }, { height: 450, width: 800, x: 1040, y: 315 }],
      [{ height: 450, width: 800, x: 80, y: 45 }, { height: 450, width: 800, x: 1040, y: 45 }, { height: 450, width: 800, x: 560, y: 585 }],
      [{ height: 450, width: 800, x: 80, y: 45 }, { height: 450, width: 800, x: 1040, y: 45 }, { height: 450, width: 800, x: 80, y: 585 }, { height: 450, width: 800, x: 1040, y: 585 }],
      [{ height: 337, width: 600, x: 20, y: 100 }, { height: 337, width: 600, x: 650, y: 100 }, { height: 337, width: 600, x: 1280, y: 100 }, { height: 337, width: 600, x: 340, y: 640 }, { height: 337, width: 600, x: 980, y: 640 }],
      [{ height: 337, width: 600, x: 20, y: 100 }, { height: 337, width: 600, x: 650, y: 100 }, { height: 337, width: 600, x: 1280, y: 100 }, { height: 337, width: 600, x: 20, y: 640 }, { height: 337, width: 600, x: 650, y: 640 }, { height: 337, width: 600, x: 1280, y: 640 }]
    ],
    async init() {
      this.stageObj = await this.getStageInfo(this.stageName);
      const broadcastClient = await this.initBroadcastClient();
      this.broadcastClient = broadcastClient;

      const broadcastEl = document.getElementById('broadcast');
      broadcastClient.attachPreview(broadcastEl);

      this.initAudio();
      await this.initStage();
      Utils.tooltips();
      addEventListener('realTimeUpdate', async (evt) => {
        this.isLive = evt.detail.isLive;
        if (!evt.detail.isLive) {
          this.stage.leave();
        } else {
          await this.stage.join();
        }
      });
      return;
    },
    async getStageInfo(name) {
      const request = await fetch(`/api/stage/info/${name}`);
      return await request.json();
    },
    async initBroadcastClient() {
      const streamConfig = this.stageObj.isPartner ? IVSBroadcastClient.STANDARD_LANDSCAPE : IVSBroadcastClient.BASIC_FULL_HD_LANDSCAPE;
      const broadcastClient = IVSBroadcastClient.create({
        streamConfig,
      });

      broadcastClient.on(IVSBroadcastClient.BroadcastClientEvents.ERROR, (state) => {
        console.log(state);
      });

      broadcastClient.on(IVSBroadcastClient.BroadcastClientEvents.CONNECTION_STATE_CHANGE, (state) => {
        this.isBroadcasting = state === IVSBroadcastClient.ConnectionState.CONNECTED;
      });
      return broadcastClient;
    },
    initAudio() {
      this.audioStream = new MediaStream();
      const audioOutput = document.getElementById('audio-player');
      audioOutput.srcObject = this.audioStream;
    },
    async initStage() {
      const strategy = {
        shouldSubscribeToParticipant: (participant) => {
          return SubscribeType.AUDIO_VIDEO;
        },
        shouldPublishParticipant: (participant) => {
          return false;
        },
        stageStreamsToPublish: () => {
          return [];
        },
      };
      this.stage = new Stage(this.stageToken.token, strategy);

      this.stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED, (participant, streams) => {
        const broadcastClient = Alpine.raw(this.broadcastClient);
        console.log(`${new Date()}: **PARTICIPANT ${participant.id} REMOVED**`);
        const videoTrackId = `video-${participant.id}`;
        if (broadcastClient.getVideoInputDevice(videoTrackId)) broadcastClient.removeVideoInputDevice(videoTrackId);
        const pIdx = this.stageParticipants.findIndex((id) => id === participant.id);
        this.stageParticipants.splice(pIdx, 1);
        this.isLive = this.stageParticipants.length > 0;
        const participantAudioStream = streams.find((s) => s.mediaStreamTrack.kind === 'audio');
        this.audioStream.removeTrack(participantAudioStream.mediaStreamTrack);
        this.updateVideoCompositions();
      });

      this.stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED, async (participant, streams) => {
        console.log(`${new Date()}: **PARTICIPANT ${participant.id} ADDED**`);
        this.stageParticipants.push(participant);
        this.renderParticipant(participant, streams);
        await this.renderAudioToClient(
          participant,
          streams.find((s) => s.streamType === StreamType.AUDIO)
        );
        if (this.stageParticipants.length < 7) {
          await this.renderVideosToClient(
            participant,
            streams.find((s) => s.streamType === StreamType.VIDEO)
          );
          await this.updateVideoCompositions();
          this.isLive = this.stageParticipants.length > 0;
        }
      });
      this.stage.on(StageEvents.STAGE_CONNECTION_STATE_CHANGED, (state) => {
        //this.isLive = state.toLowerCase() === 'connected';
      });
      if (this.stageObj.isLive) await this.stage.join();
    },
    async updateVideoCompositions() {
      const broadcastClient = Alpine.raw(this.broadcastClient);
      let idx = 0;
      const filteredParticipants = this.stageParticipants.slice(0, 6);
      for (const p of filteredParticipants) {
        const videoId = `video-${p.id}`;
        console.log(`${new Date()}: **UPDATE ${p.id} COMPOSITION ON CLIENT**`);
        let config = this.layouts[filteredParticipants.length - 1][idx];
        config.index = idx + 1;
        await broadcastClient.updateVideoDeviceComposition(videoId, config);
        idx = idx + 1;
      }
      return Promise.resolve();
    },
    renderParticipant(participant, streams) {
      let streamsToDisplay = streams;
      const mediaStream = new MediaStream();
      streamsToDisplay.forEach((stream) => {
        mediaStream.addTrack(stream.mediaStreamTrack);
      });
      this.participantStreams[participant.id] = mediaStream;
    },
    async renderAudioToClient(participant, stream) {
      const broadcastClient = Alpine.raw(this.broadcastClient);
      if (!stream?.mediaStreamTrack) return;
      const participantId = participant.id;
      console.log(`${new Date()}: **RENDERING ${participantId} AUDIO TO CLIENT**`);
      this.audioStream.addTrack(stream.mediaStreamTrack);
      return Promise.resolve();
    },
    async renderVideosToClient(participant, stream) {
      const broadcastClient = Alpine.raw(this.broadcastClient);
      if (!stream?.mediaStreamTrack) return;
      const participantId = participant.id;
      console.log(`${new Date()}: **RENDERING ${participantId} VIDEO TO CLIENT**`);
      const videoId = `video-${participantId}`;
      const pIdx = this.stageParticipants.findIndex((p) => p.id === participantId);
      let config = this.layouts[this.stageParticipants.length - 1][pIdx];
      config.index = pIdx + 1;
      const mediaStream = new MediaStream([stream.mediaStreamTrack]);
      await broadcastClient.addVideoInputDevice(mediaStream, videoId, config);
      return Promise.resolve();
    },
  }));
});
