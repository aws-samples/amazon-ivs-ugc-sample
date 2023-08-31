import BaseSeeder from '@ioc:Adonis/Lucid/Seeder';
import Category from 'App/Models/Category';

export default class extends BaseSeeder {
  public async run() {
    await Category.createMany([
      {
        name: 'Talk Shows & Podcasts',
        sortOrder: 1,
      },
      {
        name: 'Just Chatting',
        sortOrder: 2,
      },
      {
        name: 'Live Shopping',
        sortOrder: 3,
      },
      {
        name: 'Sports & Gaming',
        sortOrder: 4,
      },
      {
        name: 'Conferences & Events',
        sortOrder: 5,
      },
    ]);
  }
}
