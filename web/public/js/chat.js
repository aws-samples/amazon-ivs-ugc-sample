import { Utils } from './utils.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('chatmodel', (chatArn, chatEndpoint, broadcastType, isMultihost) => ({
    broadcastType,
    isMultihost,
    inviteType: null,
    chatArn,
    chatEndpoint,
    isAdmin: false,
    chatConnection: null,
    messages: [],
    userId: null,
    username: null,
    stageName: null,
    async init() {
      const token = await this.getChatToken();
      this.userId = token.userId;
      this.username = token.username;
      this.isAdmin = token.isAdmin;
      this.chatConnection = new WebSocket(this.chatEndpoint, token.token);
      this.initChat();
    },
    async getChatToken() {
      const request = await fetch('/api/chat/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatArn: this.chatArn,
        }),
      });
      return await request.json();
    },
    initChat() {
      this.chatConnection.onopen = () => {
        const payload = {
          Action: 'SEND_MESSAGE',
          Content: '[joined chat]',
        };
        this.chatConnection.send(JSON.stringify(payload));
      };
      this.chatConnection.onerror = () => {
        bootstrap.Toast.getOrCreateInstance(document.getElementById('error-notification')).show();
      };
      this.chatConnection.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const chatEl = document.getElementById('chat');
        if (data.Type === 'MESSAGE') {
          this.messages.push(data);
          this.$nextTick(() => {
            chatEl.scrollTop = chatEl.scrollHeight;
          });
        }
        if (data.Type === 'EVENT') {
          if (data.EventName === 'aws:DELETE_MESSAGE') {
            const idx = this.messages.findIndex((m) => m.Id === data.Attributes.MessageId);
            this.messages = this.messages.filter((_, i) => i !== idx);
          }
          if (data.EventName === 'aws:DISCONNECT_USER') {
            if (data.Attributes.UserId === this.userId.toString()) {
              this.chatConnection = null;
              document.getElementById('chat-input-container').remove();
              alert('You have been disconnected by the moderator.');
            }
          }
          if (data.EventName === 'StreamCat:MultihostInvite') {
            if (this.userId === Number(data.Attributes.userId)) {
              this.stageName = data.Attributes.stage;
              this.inviteType = data.Attributes.broadcastType;
              bootstrap.Toast.getOrCreateInstance(document.getElementById('invite-notification')).show();
            }
          }
          if (data.EventName === 'StreamCat:RealTimeUpdate') {
            const isLive = data.Attributes.isLive === 'true';
            dispatchEvent(new CustomEvent('realTimeUpdate', { detail: { isLive } }));
          }
        }
        Utils.tooltips();
      };
    },
    sendChat(msgInput) {
      this.chatConnection.send(
        JSON.stringify({
          Action: 'SEND_MESSAGE',
          Content: Utils.stripHtml(msgInput.value),
        })
      );
      msgInput.value = '';
      msgInput.focus();
    },
    deleteMessage(msgId) {
      this.chatConnection.send(
        JSON.stringify({
          Action: 'DELETE_MESSAGE',
          Id: msgId,
        })
      );
    },
    disconnectUser(userId) {
      this.chatConnection.send(
        JSON.stringify({
          Action: 'DISCONNECT_USER',
          UserId: userId,
        })
      );
    },
    async inviteUserToStage(userId, username) {
      await fetch('/api/multihost/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          username,
          broadcastType,
          chatArn: this.chatArn,
        }),
      });
    },
  }));
});
