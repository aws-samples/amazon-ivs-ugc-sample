/* eslint-disable prettier/prettier */
import { Utils } from '../utils.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('model', () => ({
    isBroadcasting: false,
    isSharingScreen: false,
    channel: null,
    broadcastClient: null,
    audioDevices: null,
    videoDevices: null,
    selectedAudioDeviceId: null,
    selectedVideoDeviceId: null,
    audioStream: null,
    videoStream: null,
    defaultVideoComposition: null,
    currentVideoComposition: null,
    async init() {
      this.channel = await this.getChannel();

      const broadcastClient = await this.initBroadcastClient();
      this.broadcastClient = broadcastClient;

      const streamConfig =
        this.channel.isPartner ?
          IVSBroadcastClient.STANDARD_LANDSCAPE :
          IVSBroadcastClient.BASIC_FULL_HD_LANDSCAPE;
      this.defaultVideoComposition = {
        index: 1,
        height: streamConfig.maxResolution.height,
        width: streamConfig.maxResolution.width,
        x: 0,
        y: 0,
      };
      this.currentVideoComposition = this.defaultVideoComposition;

      this.$watch('selectedVideoDeviceId', async () => {
        const broadcastClient = Alpine.raw(this.broadcastClient);
        if (broadcastClient && broadcastClient.getVideoInputDevice('camera-1')) {
          broadcastClient.removeVideoInputDevice('camera-1');
        }
        localStorage.setItem('selectedCamera', this.selectedVideoDeviceId);
        this.videoStream = await this.createVideoStream();
        broadcastClient.addVideoInputDevice(this.videoStream, 'camera-1', this.currentVideoComposition);
      });
      this.$watch('selectedAudioDeviceId', async () => {
        const broadcastClient = Alpine.raw(this.broadcastClient);
        if (broadcastClient && broadcastClient.getAudioInputDevice('mic-1')) {
          broadcastClient.removeAudioInputDevice('mic-1');
        }
        localStorage.setItem('selectedMicrophone', this.selectedAudioDeviceId);
        this.audioStream = await this.createAudioStream();
        broadcastClient.addAudioInputDevice(this.audioStream, 'mic-1', { index: 1 });
      });
      await this.handlePermissions();
      await this.getDevices();

      this.selectedVideoDeviceId = localStorage.getItem('selectedCamera') || this.videoDevices[0].deviceId;
      this.selectedAudioDeviceId = localStorage.getItem('selectedMicrophone') || this.audioDevices[0].deviceId;

      const previewEl = document.getElementById('broadcast-preview');
      broadcastClient.attachPreview(previewEl);
      Utils.tooltips();
    },
    async initBroadcastClient() {
      const streamConfig =
        this.channel.isPartner ?
          IVSBroadcastClient.STANDARD_LANDSCAPE :
          IVSBroadcastClient.BASIC_FULL_HD_LANDSCAPE;
      const broadcastClient = IVSBroadcastClient.create({
        streamConfig,
        ingestEndpoint: this.channel.ingestEndpoint,
      });

      broadcastClient.on(IVSBroadcastClient.BroadcastClientEvents.ERROR, (state) => {
        console.log(state);
      });

      broadcastClient.on(IVSBroadcastClient.BroadcastClientEvents.CONNECTION_STATE_CHANGE, (state) => {
        this.isBroadcasting = state === IVSBroadcastClient.ConnectionState.CONNECTED;
      });
      return broadcastClient;
    },
    async getChannel() {
      const request = await fetch('/dashboard/api/channel');
      return await request.json();
    },
    async handlePermissions() {
      let permissions;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        for (const track of stream.getTracks()) {
          track.stop();
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
      const streamConfig =
        this.channel.isPartner ?
          IVSBroadcastClient.STANDARD_LANDSCAPE :
          IVSBroadcastClient.BASIC_FULL_HD_LANDSCAPE;
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
    toggleBroadcast() {
      const broadcastClient = Alpine.raw(this.broadcastClient);
      if (!this.isBroadcasting) {
        broadcastClient.startBroadcast(this.channel.streamKey);
      } else {
        broadcastClient.stopBroadcast();
      }
    },
    async toggleScreenShare() {
      const broadcastClient = Alpine.raw(this.broadcastClient);
      const streamConfig =
        this.channel.isPartner ?
          IVSBroadcastClient.STANDARD_LANDSCAPE :
          IVSBroadcastClient.BASIC_FULL_HD_LANDSCAPE;
      const preview = document.getElementById('broadcast-preview');
      if (!this.isSharingScreen) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        broadcastClient.addVideoInputDevice(stream, 'screenshare-video-1', { index: 0 });
        broadcastClient.addAudioInputDevice(stream, 'screenshare-audio-1', { index: 0 });
        this.currentVideoComposition = {
          index: 1,
          height: streamConfig.maxResolution.height * 0.25,
          width: streamConfig.maxResolution.width * 0.25,
          x: preview.width - preview.width / 4 - 20,
          y: preview.height - preview.height / 4 - 30,
        };
      } else {
        this.currentVideoComposition = this.defaultVideoComposition;
        this.broadcastClient.removeVideoInputDevice('screenshare-video-1');
        this.broadcastClient.removeAudioInputDevice('screenshare-audio-1');
      }
      this.isSharingScreen = !this.isSharingScreen;
      this.broadcastClient.updateVideoDeviceComposition('camera-1', this.currentVideoComposition);
    },
  }));
});
