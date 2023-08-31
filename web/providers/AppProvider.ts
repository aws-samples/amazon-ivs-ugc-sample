import type { ApplicationContract } from '@ioc:Adonis/Core/Application';
import ChannelService from 'App/Services/ChannelService';
import ChatRoomService from 'App/Services/ChatRoomService';
import RealTimeService from 'App/Services/RealTimeService';

export default class AppProvider {
  constructor(protected app: ApplicationContract) {}

  public register() {
    // Register your own bindings
    this.app.container.singleton('StreamCat/ChannelService', () => new ChannelService());
    this.app.container.singleton('StreamCat/ChatRoomService', () => new ChatRoomService());
    this.app.container.singleton('StreamCat/RealTimeService', () => new RealTimeService());
  }

  public async boot() {
    // IoC container is ready
  }

  public async ready() {
    // App is ready
  }

  public async shutdown() {
    // Cleanup, since app is going down
  }
}
