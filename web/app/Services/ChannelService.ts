import { CreateChannelCommand, CreateChannelCommandOutput, GetStreamCommand, GetStreamCommandOutput, IvsClient, PutMetadataCommand, PutMetadataCommandOutput, UpdateChannelCommand, UpdateChannelCommandOutput } from '@aws-sdk/client-ivs';
import Env from '@ioc:Adonis/Core/Env';
import ChannelInterface from 'Contracts/interfaces/Channel.interface';

export default class ChannelService implements ChannelInterface {
  private ivsClient: IvsClient = new IvsClient({
    credentials: {
      accessKeyId: Env.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: Env.get('AWS_SECRET_ACCESS_KEY'),
    },
    region: Env.get('AWS_REGION'),
  });

  public async createChannel(name: string): Promise<CreateChannelCommandOutput> {
    const request: CreateChannelCommand = new CreateChannelCommand({
      name,
      type: 'BASIC',
      latencyMode: 'LOW',
      tags: {
        project: Env.get('DEFAULT_TAG'),
      },
      recordingConfigurationArn: Env.get('RECORDING_CONFIGURATION_ARN'),
    });
    return await this.ivsClient.send(request);
  }

  public async updateChannelType(arn: string, type: string, preset: string = ''): Promise<UpdateChannelCommandOutput> {
    const request: UpdateChannelCommand = new UpdateChannelCommand({
      arn,
      type,
      preset,
    });
    return await this.ivsClient.send(request);
  }

  public async getStream(channelArn: string): Promise<GetStreamCommandOutput> {
    const request: GetStreamCommand = new GetStreamCommand({
      channelArn,
    });
    return await this.ivsClient.send(request);
  }

  public async putMetadata(channelArn: string, metadata: string): Promise<PutMetadataCommandOutput> {
    const request: PutMetadataCommand = new PutMetadataCommand({
      channelArn,
      metadata,
    });
    return await this.ivsClient.send(request);
  }
}
