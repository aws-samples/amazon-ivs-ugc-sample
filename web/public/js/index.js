const getChannel = async () => {
  const request = await fetch('/dashboard/api/channel');
  return await request.json();
};

const getStreams = async () => {
  const request = await fetch('/dashboard/api/streams');
  return await request.json();
};

const initPlayer = (channel) => {
  if (IVSPlayer.isPlayerSupported) {
    const ivsPlayer = IVSPlayer.create();
    ivsPlayer.attachHTMLVideoElement(document.getElementById('video-player'));
    ivsPlayer.load(channel.playbackUrl);
    ivsPlayer.play();
    return ivsPlayer;
  } else {
    return;
  }
};

document.addEventListener('alpine:init', () => {
  Alpine.data('model', () => ({
    async init() {
      this.channel = await getChannel();
      this.streams = await getStreams();
      this.ivsPlayer = initPlayer(this.channel);
    },
    currentView: 'channel',
    channel: null,
    streams: null,
    ivsPlayer: null,
  }));
});
