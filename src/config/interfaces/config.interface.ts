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

export interface AppConfig {
  nodeEnv: string;
  port: number;
  database: DatabaseConfig;
  jwt: JwtConfig;
  security: SecurityConfig;
}
