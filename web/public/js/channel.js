import { Utils } from './utils.js';

const ClientJS = window.ClientJS;
const client = new ClientJS();

document.addEventListener('alpine:init', () => {
  Alpine.data('model', (channel, followsChannel, followersCount) => ({
    channel,
    followsChannel,
    followersCount,
    playbackInterval: null,
    viewerCountInterval: null,
    analyticsInterval: null,
    ivsPlayer: null,
    isLive: false,
    viewers: 0,
    async init() {
      this.ivsPlayer = this.getIvsPlayer('live-player');
      this.initLiveStream();
      Utils.tooltips();
    },
    getIvsPlayer(id) {
      const ivsPlayer = IVSPlayer.create();
      ivsPlayer.attachHTMLVideoElement(document.getElementById(id));
      return ivsPlayer;
    },
    async updateViewerCount() {
      const request = await fetch(`/api/stream/viewers/${this.channel.id}`);
      const response = await request.json();
      this.viewers = response.viewers || 1;
    },
    async postAnalytics() {
      const quality = this.ivsPlayer.getQuality();
      const session = this.ivsPlayer.getSessionData();
      const clientData = client.getBrowserData();
      await fetch('/api/player/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: this.channel.id,
          ip: session['USER-IP'],
          browserName: clientData.browser?.name,
          browserVersion: clientData.browser?.version,
          os: clientData.os?.name,
          userAgent: clientData?.ua,
          isMobile: client.isMobile(),
          tz: client.getTimeZone(),
          availableResolution: client.getAvailableResolution(),
          currentResolution: client.getCurrentResolution(),
          quality: quality.name,
          codecs: quality.codecs,
          bitrate: quality.bitrate,
          framerate: quality.framerate,
          latency: Number(this.ivsPlayer.getLiveLatency().toFixed(2)),
          buffer: Number(this.ivsPlayer.getBufferDuration().toFixed(2)),
        }),
      });
    },
    pollForStream() {
      this.playbackInterval = setInterval(async () => {
        this.ivsPlayer.load(this.channel?.playbackUrl);
      }, 5000);
    },
    initLiveStream() {
      this.ivsPlayer.load(this.channel?.playbackUrl);
      this.ivsPlayer.addEventListener(IVSPlayer.PlayerEventType.ERROR, (error) => {
        if (error.code === 404 && !this.playbackInterval) {
          this.pollForStream();
        }
      });
      this.ivsPlayer.addEventListener(IVSPlayer.PlayerEventType.STATE_CHANGED, (state) => {
        this.isLive = state === IVSPlayer.PlayerState.PLAYING;
      });
      this.$watch('isLive', async () => {
        if (this.isLive) {
          this.updateViewerCount();
          this.viewerCountInterval = setInterval(() => this.updateViewerCount(), 30000);
          clearInterval(this.playbackInterval);
          this.playbackInterval = null;
          this.postAnalytics();
          this.analyticsInterval = setInterval(() => this.postAnalytics(), 30000);
        } else {
          this.pollForStream();
          clearInterval(this.viewerCountInterval);
          clearInterval(this.analyticsInterval);
        }
      });
    },
    async followChannel() {
      const request = await fetch('/api/channel/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId: this.channel.id,
        }),
      });
      this.followsChannel = true;
      this.followersCount++;
    },
  }));
});
