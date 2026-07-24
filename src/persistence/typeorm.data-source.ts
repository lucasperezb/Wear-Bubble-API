import { DataSource } from 'typeorm';
import ormconfig from './typeorm.config';

export default new DataSource(ormconfig);
