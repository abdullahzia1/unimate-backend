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
      database: process.env.DATABASE_NAME || 'unimate_backend',
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
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      s3BucketName: process.env.AWS_S3_BUCKET_NAME,
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    postmark: {
      apiKey: process.env.POSTMARK_API_KEY,
      fromName: process.env.POSTMARK_FROM_NAME || 'Unimate',
      fromEmail: process.env.POSTMARK_FROM_EMAIL,
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT
        ? parseInt(process.env.SMTP_PORT, 10)
        : undefined,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      fromEmail: process.env.SMTP_FROM_EMAIL,
    },
    fcm: {
      useV1Api: process.env.FCM_USE_V1_API !== 'false',
      projectId: process.env.FCM_PROJECT_ID,
      privateKey: process.env.FCM_PRIVATE_KEY,
      clientEmail: process.env.FCM_CLIENT_EMAIL,
      serverKey: process.env.FCM_SERVER_KEY,
    },
    apns: {
      keyId: process.env.APNS_KEY_ID,
      teamId: process.env.APNS_TEAM_ID,
      bundleId: process.env.APNS_BUNDLE_ID,
      privateKey: process.env.APNS_PRIVATE_KEY,
      production: process.env.APNS_PRODUCTION === 'true',
    },
    auth: {
      otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
    },
    adminEmail: process.env.ADMIN_EMAIL || 'noreply@unimate.com',
    autoRunMigrations: process.env.AUTO_RUN_MIGRATIONS !== 'false',
  };
};
