import { BaseModel } from '@ioc:Adonis/Lucid/Orm';
import CamelCaseNamingStrategy from 'App/Strategies/CamelCaseNamingStrategy';

export default class AbstractModel extends BaseModel {
  public static namingStrategy = new CamelCaseNamingStrategy();
}
