export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  ssl?: boolean;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface SecurityConfig {
  bcryptRounds: number;
  corsOrigin: string;
  frontendUrl: string;
}

export interface AwsConfig {
  accessKeyId?: string;
  secretAccessKey?: string;
  region: string;
  s3BucketName?: string;
}

export interface RedisConfig {
  host: string;
  port: number;
}

export interface PostmarkConfig {
  apiKey?: string;
  fromName: string;
  fromEmail?: string;
}

export interface SmtpConfig {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  fromEmail?: string;
}

export interface FcmConfig {
  useV1Api: boolean;
  projectId?: string;
  privateKey?: string;
  clientEmail?: string;
  serverKey?: string;
}

export interface ApnsConfig {
  keyId?: string;
  teamId?: string;
  bundleId?: string;
  privateKey?: string;
  production: boolean;
}

export interface AuthConfig {
  otpExpiryMinutes: number;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  database: DatabaseConfig;
  jwt: JwtConfig;
  security: SecurityConfig;
  aws: AwsConfig;
  redis: RedisConfig;
  postmark: PostmarkConfig;
  smtp: SmtpConfig;
  fcm: FcmConfig;
  apns: ApnsConfig;
  auth: AuthConfig;
  adminEmail: string;
  autoRunMigrations: boolean;
}
