/* eslint-disable prettier/prettier */
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import RealTimeService from '@ioc:StreamCat/RealTimeService';
import Stage from 'App/Models/Stage';
import StageToken from 'App/Models/StageToken';
import { DateTime } from 'luxon';

export default class MultihostAuth {
  public async handle({ auth, params, response, session }: HttpContextContract, next: () => Promise<void>) {
    const stageName = params.stageName;
    if (!stageName || !auth.user) response.redirect('/');
    const stage = await Stage.query().where('name', stageName).first();
    const isHost = auth.user?.id === stage?.userId;
    let token;
    if (auth.user && stage) {
      token = await auth.user?.getCurrentTokenForStage(stage?.id);
      if (!isHost && !token) {
        response.redirect('/');
      }
      if (isHost && (!token || token?.isStageTokenExpired())) {
        token = await RealTimeService.createStageToken(
          auth.user.id.toString(),
          auth.user?.username,
          stage?.arn,
          ['PUBLISH', 'SUBSCRIBE']);
        await StageToken.create({
          participantId: token.participantToken?.participantId,
          token: token.participantToken?.token,
          userId: Number(token.participantToken?.userId),
          expiresAt: DateTime.fromJSDate(token.participantToken?.expirationTime!),
          stageId: stage.id,
        });
      }
      if (!isHost && token && token.isStageTokenExpired()) {
        session.flash({
          multihost: {
            tokenExpired: 'Your invitation to this stream has expired.',
          },
        });
        response.redirect(`/channel/${stageName}`);
      }
    }
    // code for middleware goes here. ABOVE THE NEXT CALL
    await next();
  }
}
