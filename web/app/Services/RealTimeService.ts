/* eslint-disable prettier/prettier */
import { CreateParticipantTokenCommand, CreateParticipantTokenCommandOutput, CreateStageCommand, CreateStageCommandOutput, DisconnectParticipantCommand, DisconnectParticipantCommandOutput, IVSRealTimeClient } from '@aws-sdk/client-ivs-realtime';
import Env from '@ioc:Adonis/Core/Env';
import RealTimeInterface from 'Contracts/interfaces/RealTime.interface';

export default class RealTimeService implements RealTimeInterface {
  private ivsRealtimeClient: IVSRealTimeClient = new IVSRealTimeClient({
    credentials: {
      accessKeyId: Env.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: Env.get('AWS_SECRET_ACCESS_KEY'),
    },
    region: Env.get('AWS_REGION'),
  });

  public async createStage(name: string): Promise<CreateStageCommandOutput> {
    const request: CreateStageCommand = new CreateStageCommand({
      name,
      tags: {
        project: Env.get('DEFAULT_TAG'),
      },
    });
    return await this.ivsRealtimeClient.send(request);
  }

  public async createStageToken(
    userId: string,
    username: string,
    stageArn: string,
    capabilities: string[]): Promise<CreateParticipantTokenCommandOutput> {
    const request: CreateParticipantTokenCommand = new CreateParticipantTokenCommand({
      userId,
      capabilities,
      attributes: {
        username,
      },
      stageArn,
    });
    return await this.ivsRealtimeClient.send(request);
  }

  public async disconnectParticipant(participantId: string, stageArn: string): Promise<DisconnectParticipantCommandOutput> {
    const request: DisconnectParticipantCommand = new DisconnectParticipantCommand({
      participantId,
      stageArn,
    });
    return await this.ivsRealtimeClient.send(request);
  }
}
