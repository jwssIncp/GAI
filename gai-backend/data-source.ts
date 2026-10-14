import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

// Runs both via ts-node (project root, .ts) and compiled (dist/, .js).
const ext = __filename.endsWith('.ts') ? 'ts' : 'js';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME ?? 'gai',
  password: process.env.DB_PASSWORD ?? 'gai',
  database: process.env.DB_DATABASE ?? 'gai',
  charset: 'utf8mb4',
  extra: {
    bigNumberStrings: false,
  },
  entities: [join(__dirname, `src/**/*.entity.${ext}`)],
  migrations: [join(__dirname, `src/migrations/*.${ext}`)],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});
