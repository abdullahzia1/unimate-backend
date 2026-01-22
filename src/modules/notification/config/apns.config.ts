import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface APNsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  key: string; // Private key content
  production: boolean;
  defaultTopic?: string;
}

@Injectable()
export class APNsConfigService {
  constructor(private configService: ConfigService) {}

  getConfig(): APNsConfig | null {
    const apnsConfig = this.configService.get<{
      keyId?: string;
      teamId?: string;
      bundleId?: string;
      privateKey?: string;
      production: boolean;
    }>('apns');

    if (!apnsConfig) {
      return null;
    }

    const { keyId, teamId, bundleId, privateKey, production } = apnsConfig;

    if (!keyId || !teamId || !bundleId || !privateKey) {
      return null;
    }

    return {
      keyId,
      teamId,
      bundleId,
      key: privateKey,
      production,
      defaultTopic: bundleId,
    };
  }

  isConfigured(): boolean {
    return this.getConfig() !== null;
  }
}
