document.addEventListener('alpine:init', () => {
  Alpine.data('model', (stream, channel, followsChannel, followersCount) => ({
    stream,
    channel,
    followsChannel,
    followersCount,
    async init() {
      this.ivsPlayer = this.getIvsPlayer('vod-player');
      this.initVodPlayback();
    },
    getIvsPlayer(id) {
      const ivsPlayer = IVSPlayer.create();
      ivsPlayer.attachHTMLVideoElement(document.getElementById(id));
      return ivsPlayer;
    },
    initVodPlayback() {
      this.ivsPlayer.load(this.stream?.masterPlaylistUrl);
      this.ivsPlayer.play();
      this.ivsPlayer.addEventListener(IVSPlayer.PlayerEventType.STATE_CHANGED, (state) => {
        this.isPlaying = state === IVSPlayer.PlayerState.PLAYING;
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
    ivsPlayer: null,
    isPlaying: false,
  }));
});
