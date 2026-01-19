import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type HealthStatus = 'ok' | 'degraded';

export interface HealthCheckResult {
  status: HealthStatus;
  uptime: number;
  timestamp: string;
  environment: string;
  database: {
    status: 'up' | 'down';
    latencyMs?: number;
    error?: string;
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async getHealth(): Promise<HealthCheckResult> {
    const database = await this.checkDatabase();

    return {
      status: database.status === 'up' ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: this.configService.get<string>('nodeEnv') || 'unknown',
      database,
    };
  }

  private async checkDatabase(): Promise<HealthCheckResult['database']> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
