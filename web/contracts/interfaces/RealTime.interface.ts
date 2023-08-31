import { CreateParticipantTokenCommandOutput, CreateStageCommandOutput, DisconnectParticipantCommandOutput } from '@aws-sdk/client-ivs-realtime';

export default interface RealTimeInterface {
  createStage(name: string): Promise<CreateStageCommandOutput>;
  createStageToken(userId: string, username: string, stageArn: string, capabilities: string[]): Promise<CreateParticipantTokenCommandOutput>;
  disconnectParticipant(participantId: string, stageArn: string): Promise<DisconnectParticipantCommandOutput>;
}
