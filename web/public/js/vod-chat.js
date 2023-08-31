import { Utils } from './utils.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('chatmodel', (chatLog) => ({
    chatLog,
    currentTimestamp: null,
    async init() {
      Alpine.raw(this.ivsPlayer).addEventListener(IVSPlayer.MetadataEventType.ID3, (evt) => {
        const segmentMetadata = evt.find((tag) => tag.desc === 'segmentmetadata');
        const segmentMetadataInfo = JSON.parse(segmentMetadata.info[0]);
        this.currentTimestamp = segmentMetadataInfo['transc_s'];
      });
    },
  }));
});
