document.addEventListener('alpine:init', () => {
  Alpine.data('model', () => ({
    browserChart: null,
    osChart: null,
    qualityChart: null,
    viewersChart: null,
    latencyChart: null,
    bufferChart: null,
    bitrateChart: null,
    itemSaved: null,
    itemCopied: null,
    chartColors: {
      red: 'rgb(255, 99, 132)',
      orange: 'rgb(255, 159, 64)',
      yellow: 'rgb(255, 205, 86)',
      green: 'rgb(75, 192, 192)',
      blue: 'rgb(54, 162, 235)',
      purple: 'rgb(153, 102, 255)',
      grey: 'rgb(201, 203, 207)',
    },
    colorDark: getComputedStyle(document.documentElement).getPropertyValue('--bs-secondary'),
    colorLight: getComputedStyle(document.documentElement).getPropertyValue('--bs-gray-300'),
    gridlineColors: null,
    async init() {
      this.gridlineColors = localStorage.getItem('streamcat-dark-mode') === 'true' ? this.colorDark : this.colorLight;
      window.addEventListener('darkModeChanged', (evt) => {
        this.gridlineColors = evt.detail.isDarkMode ? this.colorDark : this.colorLight;
        this.viewersChart.options.scales.y.grid.color = this.gridlineColors;
        this.chatMessageChart.options.scales.y.grid.color = this.gridlineColors;
        this.bufferChart.options.scales.y.grid.color = this.gridlineColors;
        this.bitrateChart.options.scales.y.grid.color = this.gridlineColors;
        this.latencyChart.options.scales.y.grid.color = this.gridlineColors;
        this.viewersChart.options.scales.x.grid.color = this.gridlineColors;
        this.chatMessageChart.options.scales.x.grid.color = this.gridlineColors;
        this.bufferChart.options.scales.x.grid.color = this.gridlineColors;
        this.bitrateChart.options.scales.x.grid.color = this.gridlineColors;
        this.latencyChart.options.scales.x.grid.color = this.gridlineColors;
        Alpine.raw(this.viewersChart).update();
        Alpine.raw(this.chatMessageChart).update();
        Alpine.raw(this.bufferChart).update();
        Alpine.raw(this.bitrateChart).update();
        Alpine.raw(this.latencyChart).update();
      });
      this.channel = await this.getChannel();
      this.streams = await this.getStreams();
      this.categories = await this.getCategories();
      this.$watch('currentView', (view) => {
        if (view !== 'streams') {
          this.browserChart = null;
          this.osChart = null;
          this.qualityChart = null;
          this.viewersChart = null;
          this.latencyChart = null;
          this.bufferChart = null;
          this.bitrateChart = null;
          this.chatMessageChart = null;
        }
        if (view === 'streams') {
          this.vodPlayer = this.getIvsPlayer('vod-player');
          this.initVodPlayback();
          if (!this.browserChart) this.browserChart = this.renderBrowserChart();
          if (!this.osChart) this.osChart = this.renderOsChart();
          if (!this.qualityChart) this.qualityChart = this.renderQualityChart();
          if (!this.viewersChart) this.viewersChart = this.renderViewersChart();
          if (!this.latencyChart) this.latencyChart = this.renderLatencyChart();
          if (!this.bufferChart) this.bufferChart = this.renderBufferChart();
          if (!this.bitrateChart) this.bitrateChart = this.renderBitrateChart();
          if (!this.chatMessageChart) this.chatMessageChart = this.renderChatMessageChart();
        }
        if (view === 'player') {
          this.livePlayer = this.getIvsPlayer('live-player');
          this.initLiveStream();
        }
        return;
      });
      this.$watch('selectedVodStreamId', async (id) => {
        const stream = this.streams.find((s) => s.id === Number(id));
        this.selectedStream = stream;
        this.vodPlaybackUrl = stream.masterPlaylistUrl;
        this.vodPlayer.load(this.vodPlaybackUrl);
        this.streamMetrics = await this.getMetricsForStream();
        Alpine.raw(this.browserChart).data.labels = this.streamMetrics.browsers.map((row) => row.browser_name);
        Alpine.raw(this.browserChart).data.datasets[0].data = this.streamMetrics.browsers.map((row) => row.viewers);
        Alpine.raw(this.browserChart).update();
        Alpine.raw(this.osChart).data.labels = this.streamMetrics.os.map((row) => row.os);
        Alpine.raw(this.osChart).data.datasets[0].data = this.streamMetrics.os.map((row) => row.viewers);
        Alpine.raw(this.osChart).update();
        Alpine.raw(this.qualityChart).data.labels = this.streamMetrics.quality.map((row) => row.quality);
        Alpine.raw(this.qualityChart).data.datasets[0].data = this.streamMetrics.quality.map((row) => row.pct);
        Alpine.raw(this.qualityChart).update();
        Alpine.raw(this.viewersChart).data.labels = this.streamMetrics.viewers.map((row) => new Date(row.time).toLocaleTimeString());
        Alpine.raw(this.viewersChart).data.datasets[0].data = this.streamMetrics.viewers.map((row) => row.viewers);
        Alpine.raw(this.viewersChart).update();
        Alpine.raw(this.latencyChart).data.labels = this.streamMetrics.avgLatency.map((row) => new Date(row.time_period).toLocaleTimeString());
        Alpine.raw(this.latencyChart).data.datasets[0].data = this.streamMetrics.avgLatency.map((row) => row.avg_latency);
        Alpine.raw(this.latencyChart).update();
        Alpine.raw(this.bufferChart).data.labels = this.streamMetrics.avgBuffer.map((row) => new Date(row.time_period).toLocaleTimeString());
        Alpine.raw(this.bufferChart).data.datasets[0].data = this.streamMetrics.avgBuffer.map((row) => row.avg_buffer);
        Alpine.raw(this.bufferChart).update();
        Alpine.raw(this.bitrateChart).data.labels = this.streamMetrics.avgBitrate.map((row) => new Date(row.time_period).toLocaleTimeString());
        Alpine.raw(this.bitrateChart).data.datasets[0].data = this.streamMetrics.avgBitrate.map((row) => row.avg_bitrate);
        Alpine.raw(this.bitrateChart).update();
        Alpine.raw(this.chatMessageChart).data.labels = this.streamMetrics.chatMessages.map((row) => new Date(row.time_period).toLocaleTimeString());
        Alpine.raw(this.chatMessageChart).data.datasets[0].data = this.streamMetrics.chatMessages.map((row) => row.messages);
        Alpine.raw(this.chatMessageChart).update();
      });
    },
    async getChannel() {
      const request = await fetch('/dashboard/api/channel');
      return await request.json();
    },
    async getStreams() {
      const request = await fetch('/dashboard/api/streams');
      return await request.json();
    },
    async getMetricsForStream() {
      const request = await fetch(`/dashboard/api/metrics/${this.selectedVodStreamId}`);
      return await request.json();
    },
    async getCategories() {
      const request = await fetch('/dashboard/api/categories');
      return await request.json();
    },
    getIvsPlayer(id) {
      const player = IVSPlayer.create();
      player.attachHTMLVideoElement(document.getElementById(id));
      return player;
    },
    renderChatMessageChart() {
      return new Chart(document.getElementById('chat-chart'), {
        type: 'bar',
        options: { responsive: true, scales: { y: { beginAtZero: true, grid: { color: this.gridlineColors } }, x: { grid: { color: this.gridlineColors } } }, plugins: { title: { display: true, text: 'Chat Messages' } } },
        data: {
          labels: [],
          datasets: [{ label: 'Chat Messages', data: [] }],
        },
      });
    },
    renderViewersChart() {
      return new Chart(document.getElementById('viewers-chart'), {
        type: 'line',
        options: { responsive: true, scales: { y: { beginAtZero: true, grid: { color: this.gridlineColors } }, x: { grid: { color: this.gridlineColors } } }, plugins: { title: { display: true, text: 'Unique Viewers' } } },
        data: {
          labels: [],
          datasets: [{ label: 'Viewers', data: [] }],
        },
      });
    },
    renderLatencyChart() {
      return new Chart(document.getElementById('latency-chart'), {
        type: 'line',
        options: { responsive: true, scales: { y: { grid: { color: this.gridlineColors } }, x: { grid: { color: this.gridlineColors } } }, plugins: { title: { display: true, text: 'Average Playback Latency' } } },
        data: {
          labels: [],
          datasets: [{ label: 'Seconds', data: [] }],
        },
      });
    },
    renderBufferChart() {
      return new Chart(document.getElementById('buffer-chart'), {
        type: 'line',
        options: { responsive: true, scales: { y: { grid: { color: this.gridlineColors } }, x: { grid: { color: this.gridlineColors } } }, plugins: { title: { display: true, text: 'Average Playback Buffer' } } },
        data: {
          labels: [],
          datasets: [{ label: 'Seconds', data: [] }],
        },
      });
    },
    renderBitrateChart() {
      return new Chart(document.getElementById('bitrate-chart'), {
        type: 'line',
        options: { responsive: true, scales: { y: { grid: { color: this.gridlineColors } }, x: { grid: { color: this.gridlineColors } } }, plugins: { title: { display: true, text: 'Average Playback Bitrate' } } },
        data: {
          labels: [],
          datasets: [{ label: 'kbps', data: [] }],
        },
      });
    },
    renderBrowserChart() {
      return new Chart(document.getElementById('browser-chart'), {
        type: 'pie',
        options: { responsive: true, plugins: { title: { display: true, text: 'Viewer Browser' } } },
        data: {
          labels: [],
          datasets: [{ label: 'Viewers', data: [], backgroundColor: Object.values(this.chartColors) }],
        },
      });
    },
    renderOsChart() {
      return new Chart(document.getElementById('os-chart'), {
        type: 'pie',
        options: { responsive: true, plugins: { title: { display: true, text: 'Viewer OS' } } },
        data: {
          labels: [],
          datasets: [{ label: 'Viewers', data: [], backgroundColor: Object.values(this.chartColors) }],
        },
      });
    },
    renderQualityChart() {
      return new Chart(document.getElementById('quality-chart'), {
        type: 'pie',
        options: { responsive: true, plugins: { title: { display: true, text: 'Playback Quality' } } },
        data: {
          labels: [],
          datasets: [{ label: '% of playback', data: [], backgroundColor: Object.values(this.chartColors) }],
        },
      });
    },
    initLiveStream() {
      this.livePlayer.load(this.channel?.playbackUrl);
      this.livePlayer.addEventListener(IVSPlayer.PlayerEventType.STATE_CHANGED, (state) => {
        this.isLive = state === IVSPlayer.PlayerState.PLAYING;
      });
    },
    initVodPlayback() {
      return;
    },
    setIngestEndpoint() {
      navigator.clipboard.writeText(this.channel.rtmpsEndpoint);
      this.itemCopied = 'Ingest Endpoint';
      bootstrap.Toast.getOrCreateInstance(document.getElementById('copy-notification')).show();
    },
    setStreamKey() {
      navigator.clipboard.writeText(this.channel.streamKey);
      this.itemCopied = 'Stream Key';
      bootstrap.Toast.getOrCreateInstance(document.getElementById('copy-notification')).show();
    },
    async saveStream() {
      await fetch('/dashboard/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.selectedStream.id, title: this.selectedStream.title, categoryId: this.selectedStream.categoryId }),
      });
      this.itemSaved = 'Stream';
      bootstrap.Toast.getOrCreateInstance(document.getElementById('save-notification')).show();
    },
    async saveChannel() {
      await fetch('/dashboard/api/channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: this.channel.title,
          channelId: this.channel.id,
          categoryId: this.channel.categoryId,
        }),
      });
      this.itemSaved = 'Channel';
      bootstrap.Toast.getOrCreateInstance(document.getElementById('save-notification')).show();
    },
    currentView: 'channel',
    categories: {},
    channel: {},
    streams: null,
    selectedVodStreamId: null,
    selectedStream: {},
    vodPlaybackUrl: null,
    livePlayer: null,
    vodPlayer: null,
    isLive: false,
    streamMetrics: null,
  }));
});
