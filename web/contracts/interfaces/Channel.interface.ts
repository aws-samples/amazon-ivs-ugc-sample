import { CreateChannelCommandOutput, GetStreamCommandOutput, PutMetadataCommandOutput } from '@aws-sdk/client-ivs';

export default interface ChannelInterface {
  createChannel(name: string): Promise<CreateChannelCommandOutput>;
  updateChannelType(arn: string, type: string, preset?: string);
  getStream(channelArn: string): Promise<GetStreamCommandOutput>;
  putMetadata(channelArn: string, metadata: string): Promise<PutMetadataCommandOutput>;
}
