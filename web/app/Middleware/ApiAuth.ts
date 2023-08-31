import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Env from '@ioc:Adonis/Core/Env';

export default class ApiAuth {
  public async handle({ request, response }: HttpContextContract, next: () => Promise<void>) {
    const apiKey = request.header('x-streamcat-key');
    if (apiKey === Env.get('API_KEY')) {
      await next();
    } else {
      response.status(401).send({ error: 'Invalid API key' });
    }
  }
}
