// CommonJS DataSource configuration for TypeORM CLI
// This file is separate from the TypeScript source to avoid ESM/CommonJS conflicts
require('dotenv').config();
const { DataSource } = require('typeorm');
const { join } = require('path');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'unimate_backend',
  entities: [
    join(__dirname, 'src', 'database', 'entities', '*.entity.{ts,js}'),
  ],
  migrations: [join(__dirname, 'src', 'database', 'migrations', '*.{ts,js}')],
  synchronize: false,
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
});

module.exports = AppDataSource;
