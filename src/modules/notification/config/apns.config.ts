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
    const keyId = this.configService.get<string>('APNS_KEY_ID');
    const teamId = this.configService.get<string>('APNS_TEAM_ID');
    const bundleId = this.configService.get<string>('APNS_BUNDLE_ID');
    const key = this.configService.get<string>('APNS_PRIVATE_KEY');
    const production =
      this.configService.get<string>('APNS_PRODUCTION', 'false') === 'true';

    if (!keyId || !teamId || !bundleId || !key) {
      return null;
    }

    return {
      keyId,
      teamId,
      bundleId,
      key,
      production,
      defaultTopic: bundleId,
    };
  }

  isConfigured(): boolean {
    return this.getConfig() !== null;
  }
}
