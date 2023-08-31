import Route from '@ioc:Adonis/Core/Route';

Route.group(() => {
  Route.get('/api', async ({ response }) => {
    return response.send({ ok: true });
  }).middleware('apiAuth');
}).prefix('/v1');
