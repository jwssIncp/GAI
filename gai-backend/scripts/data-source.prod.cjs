'use strict';

require('reflect-metadata');
const { DataSource } = require('typeorm');
const { MYSQL_UTC_OPTIONS } = require('../dist/src/common/persistence/mysql-utc-options.js');

module.exports = new DataSource({
  type: 'mysql',
  ...MYSQL_UTC_OPTIONS,
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME ?? 'gai',
  password: process.env.DB_PASSWORD ?? 'gai',
  database: process.env.DB_DATABASE ?? 'gai',
  charset: 'utf8mb4',
  extra: {
    bigNumberStrings: false,
  },
  entities: ['dist/src/**/*.entity.js'],
  migrations: ['dist/src/migrations/*.js'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});
