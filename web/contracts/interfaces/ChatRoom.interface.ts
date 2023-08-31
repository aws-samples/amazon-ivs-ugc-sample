import { CreateChatTokenCommandOutput, CreateRoomCommandOutput } from '@aws-sdk/client-ivschat';

export default interface ChatRoomInterface {
  createChatRoom(name: string): Promise<CreateRoomCommandOutput>;
  createChatToken(roomArn: string, userId: string, username: string, isAdmin: boolean, isGuest: boolean): Promise<CreateChatTokenCommandOutput>;
  sendChatEvent(roomArn: string, eventName: any, attributes: any);
}
