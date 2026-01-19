import { AppConfig } from './interfaces/config.interface';

export default (): AppConfig => {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4000', 10),
    database: {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'spam_site_backend',
      // Disable automatic schema synchronization; use migrations instead.
      synchronize: false,
      ssl: process.env.DATABASE_SSL === 'true',
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'default-secret-change-this',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    security: {
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
      corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    },
  };
};
