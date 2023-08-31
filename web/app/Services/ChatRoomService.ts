/* eslint-disable prettier/prettier */
import { CreateRoomCommandOutput, CreateChatTokenCommandOutput, IvschatClient, CreateRoomCommand, CreateChatTokenCommand, SendEventCommand } from '@aws-sdk/client-ivschat';
import Env from '@ioc:Adonis/Core/Env';
import ChatRoomInterface from 'Contracts/interfaces/ChatRoom.interface';

export default class ChatRoomService implements ChatRoomInterface {
  private ivsChatClient: IvschatClient = new IvschatClient({
    credentials: {
      accessKeyId: Env.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: Env.get('AWS_SECRET_ACCESS_KEY'),
    },
    region: Env.get('AWS_REGION'),
  });
  public async createChatRoom(name: string): Promise<CreateRoomCommandOutput> {
    const request: CreateRoomCommand = new CreateRoomCommand({
      name,
      messageReviewHandler: {
        uri: Env.get('MODERATE_CHAT_FUNCTION_ARN'),
        fallbackResult: 'ALLOW',
      },
      loggingConfigurationIdentifiers: [
        Env.get('CHAT_LOGGING_CONFIGURATION_ARN')
      ],
      tags: {
        project: Env.get('DEFAULT_TAG'),
      },
    });
    return await this.ivsChatClient.send(request);
  }

  public async createChatToken(
    roomArn: string,
    userId: string,
    username: string,
    isAdmin: boolean,
    isGuest: boolean): Promise<CreateChatTokenCommandOutput> {
    let capabilities = ['SEND_MESSAGE'];
    if (isAdmin) capabilities = [...capabilities, 'DISCONNECT_USER', 'DELETE_MESSAGE'];
    const request: CreateChatTokenCommand = new CreateChatTokenCommand({
      roomIdentifier: roomArn,
      userId: userId.toString(),
      attributes: {
        username,
        isGuest: isGuest.toString(),
      },
      capabilities,
    });
    return await this.ivsChatClient.send(request);
  }

  public async sendChatEvent(roomArn: string, eventName: any, attributes: any) {
    const request: SendEventCommand = new SendEventCommand({
      roomIdentifier: roomArn,
      eventName,
      attributes,
    });
    return await this.ivsChatClient.send(request);
  }
}
