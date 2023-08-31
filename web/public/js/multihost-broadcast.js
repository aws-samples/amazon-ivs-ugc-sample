/* eslint-disable prettier/prettier */
import { Utils } from './utils.js';
const { IVSBroadcastClient } = window;
const { Stage, SubscribeType, LocalStageStream, StageEvents, StreamType, StageConnectionState } = IVSBroadcastClient;

document.addEventListener('alpine:init', () => {
  Alpine.data('model', (stageName, stageToken, broadcastType, chatArn) => ({
    chatArn,
    broadcastType,
    REAL_TIME: 'realtime',
    LOW_LATENCY: 'lowlatency',
    stageName,
    stage: null,
    stageToken,
    stageStrategy: null,
    isBroadcasting: false,
    conferenceState: 'Offline',
    channel: null,
    broadcastClient: null,
    audioDevices: null,
    videoDevices: null,
    selectedAudioDeviceId: null,
    selectedVideoDeviceId: null,
    audioStream: null,
    videoStream: null,
    stageParticipants: [],
    participantIds: [],
    localStream: null,
    redirectSeconds: 5,
    stage: null,
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
      this.channel = await this.getChannel();

      const broadcastClient = await this.initBroadcastClient();
      this.broadcastClient = broadcastClient;

      await this.handlePermissions();
      await this.getDevices();
      const selectedVideoDeviceId = localStorage.getItem('selectedCamera') || this.videoDevices[0].deviceId;
      const selectedAudioDeviceId = localStorage.getItem('selectedMicrophone') || this.audioDevices[0].deviceId;
      this.selectedAudioDeviceId = selectedAudioDeviceId;
      this.selectedVideoDeviceId = selectedVideoDeviceId;
      this.audioStream = await this.createAudioStream();
      this.videoStream = await this.createVideoStream();

      this.$watch('selectedVideoDeviceId', async () => {
        const broadcastClient = Alpine.raw(this.broadcastClient);
        if (broadcastClient && broadcastClient.getVideoInputDevice('camera-1')) broadcastClient.removeVideoInputDevice('camera-1');
        localStorage.setItem('selectedCamera', this.selectedVideoDeviceId);
        this.videoStream = await this.createVideoStream();
        this.stage.refreshStrategy();
      });
      this.$watch('selectedAudioDeviceId', async () => {
        const broadcastClient = Alpine.raw(this.broadcastClient);
        if (broadcastClient && broadcastClient.getAudioInputDevice('mic-1')) broadcastClient.removeAudioInputDevice('mic-1');
        localStorage.setItem('selectedMicrophone', this.selectedAudioDeviceId);
        this.audioStream = await this.createAudioStream();
        this.stage.refreshStrategy();
      });

      const previewEl = document.getElementById('broadcast-preview');
      broadcastClient.attachPreview(previewEl);

      await this.initStage();
      Utils.tooltips();

      addEventListener('unload', () => {
        const body = { isLive: false, chatArn: this.chatArn };
        const headers = { type: 'application/json' };
        navigator.sendBeacon('/api/stage/update', new Blob([JSON.stringify(body)], headers));
      });

      return;
    },
    async getChannel() {
      const request = await fetch('/dashboard/api/channel');
      return await request.json();
    },
    async initBroadcastClient() {
      const streamConfig = this.channel.isPartner ? IVSBroadcastClient.STANDARD_LANDSCAPE : IVSBroadcastClient.BASIC_FULL_HD_LANDSCAPE;
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
    async initStage() {
      this.stageStrategy = {
        shouldSubscribeToParticipant: (participant) => {
          return SubscribeType.AUDIO_VIDEO;
        },
        shouldPublishParticipant: (participant) => {
          return true;
        },
        stageStreamsToPublish: () => {
          const videoTrack = this.videoStream.getVideoTracks()[0];
          const audioTrack = this.audioStream.getAudioTracks()[0];
          const streamsToPublish = [new LocalStageStream(audioTrack), new LocalStageStream(videoTrack)];
          return streamsToPublish;
        },
      };
      this.stage = new Stage(stageToken.token, this.stageStrategy);

      this.stage.on(StageEvents.STAGE_PARTICIPANT_LEFT, (participant, streams) => {
        console.log(participant);
      });

      this.stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED, (participant, streams) => {
        const broadcastClient = Alpine.raw(this.broadcastClient);
        const videoTrackId = `video-${participant.id}`;
        const audioTrackId = `audio-${participant.id}`;
        const localVideo = document.getElementById(`participant-${participant.id}`);
        const mediaStream = localVideo?.srcObject;
        streams.forEach((stream) => {
          if (broadcastClient.getVideoInputDevice(videoTrackId) && stream.streamType === 'video') {
            console.log(`${new Date()}: **PARTICIPANT ${participant.id} VIDEO REMOVED**`);
            broadcastClient.removeVideoInputDevice(videoTrackId);
          }
          if (broadcastClient.getAudioInputDevice(audioTrackId) && stream.streamType === 'audio') {
            console.log(`${new Date()}: **PARTICIPANT ${participant.id} AUDIO REMOVED**`);
            broadcastClient.removeAudioInputDevice(audioTrackId);
          }
          mediaStream?.removeTrack(stream.mediaStreamTrack);
        });
        localVideo.srcObject = mediaStream;
        const pIdx = this.stageParticipants.findIndex((id) => id === participant.id);
        this.stageParticipants.splice(pIdx, 1);
        this.updateVideoCompositions();
      });
      this.stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED, async (participant, streams) => {
        console.log(`${new Date()}: **PARTICIPANT ${participant.id} ADDED**`);
        this.stageParticipants.push(participant);
        this.renderParticipant(participant, streams);
        for (const s of streams) {
          console.log(await s.getStats());
        }
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
        }
      });
      this.stage.on(StageEvents.STAGE_CONNECTION_STATE_CHANGED, (state) => {
        this.conferenceState = `${state.substr(0, 1).toUpperCase()}${state.substr(1, state.length)}`;
        if (state === StageConnectionState.ERRORED) {
          bootstrap.Toast.getOrCreateInstance(document.getElementById('multihost-error-notification')).show();
          setInterval(() => {
            this.redirectSeconds = this.redirectSeconds - 1;
            if (this.redirectSeconds === 0) {
              window.location = `/channel/${this.broadcastType}/${this.stageName}`;
            }
          }, 1000);
        }
      });
      await this.stage.join();
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
      if (participant.isLocal) {
        streamsToDisplay = streams.filter((stream) => stream.streamType === StreamType.VIDEO);
      }
      this.$nextTick(() => {
        const localVideo = document.getElementById(`participant-${participant.id}`);
        const mediaStream = localVideo.srcObject || new MediaStream();
        streamsToDisplay.forEach((stream) => {
          mediaStream.addTrack(stream.mediaStreamTrack);
        });
        localVideo.srcObject = mediaStream;
      });
    },
    async renderAudioToClient(participant, stream) {
      const broadcastClient = Alpine.raw(this.broadcastClient);
      if (!stream?.mediaStreamTrack) return;
      const participantId = participant.id;
      console.log(`${new Date()}: **RENDERING ${participantId} AUDIO TO CLIENT**`);
      const audioTrackId = `audio-${participantId}`;
      const mediaStream = new MediaStream();
      mediaStream.addTrack(stream.mediaStreamTrack);
      await broadcastClient.addAudioInputDevice(mediaStream, audioTrackId);
      return Promise.resolve();
    },
    async renderVideosToClient(participant, stream) {
      const broadcastClient = Alpine.raw(this.broadcastClient);
      if (!stream?.mediaStreamTrack) return;
      const participantId = participant.id;
      const videoId = `video-${participantId}`;
      const pIdx = this.stageParticipants.findIndex((p) => p.id === participantId);
      let config = this.layouts[this.stageParticipants.length - 1][pIdx];
      config.index = pIdx + 1;
      console.log(`${new Date()}: **RENDERING ${participantId} VIDEO TO CLIENT**`);
      const mediaStream = new MediaStream([stream.mediaStreamTrack]);
      await broadcastClient.addVideoInputDevice(mediaStream, videoId, config);
      return Promise.resolve();
    },
    async handlePermissions() {
      let permissions;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        for (const track of stream.getTracks()) {
          //track.stop();
        }
        permissions = { video: true, audio: true };
      } catch (err) {
        permissions = { video: false, audio: false };
        console.error(err.message);
      }
      if (!permissions.video) {
        console.error('Failed to get video permissions.');
      } else if (!permissions.audio) {
        console.error('Failed to get audio permissions.');
      }
    },
    async getDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter((d) => d.kind === 'videoinput');
      this.audioDevices = devices.filter((d) => d.kind === 'audioinput');
    },
    async createVideoStream() {
      const streamConfig = this.channel.isPartner ? IVSBroadcastClient.STANDARD_LANDSCAPE : IVSBroadcastClient.BASIC_FULL_HD_LANDSCAPE;
      return navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: {
            exact: this.selectedVideoDeviceId,
          },
          width: {
            ideal: streamConfig.maxResolution.width,
            max: streamConfig.maxResolution.width,
          },
          height: {
            ideal: streamConfig.maxResolution.height,
            max: streamConfig.maxResolution.height,
          },
        },
      });
    },
    async createAudioStream() {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: this.selectedAudioDeviceId,
        },
      });
    },
    async toggleRealtime(isLive) {
      await fetch(`/api/stage/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLive,
          chatArn: this.chatArn,
        }),
      });
      this.isBroadcasting = isLive;
      return;
    },
    toggleBroadcast() {
      const broadcastClient = Alpine.raw(this.broadcastClient);
      if (!this.isBroadcasting) {
        if (this.broadcastType === this.LOW_LATENCY) {
          broadcastClient
            .startBroadcast(
              this.channel.streamKey,
              this.channel.ingestEndpoint
            );
        } else {
          this.toggleRealtime(true);
        }
      } else {
        if (this.broadcastType === this.LOW_LATENCY) {
          broadcastClient.stopBroadcast();
        } else {
          this.toggleRealtime(false);
        }
      }
    },
    async disconnectParticipant(userId, participantId) {
      console.log(participantId);
      const request = await fetch('/api/multihost/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          userId,
        }),
      });
    },
  }));
});
