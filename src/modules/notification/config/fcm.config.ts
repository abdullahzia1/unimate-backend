import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FCMConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
  useV1API: boolean; // Use FCM HTTP v1 API (recommended) or legacy API
  serverKey?: string; // For legacy API only
}

@Injectable()
export class FCMConfigService {
  constructor(private configService: ConfigService) {}

  getConfig(): FCMConfig | null {
    const useV1API =
      this.configService.get<string>('FCM_USE_V1_API', 'true') === 'true';

    if (useV1API) {
      // FCM HTTP v1 API (recommended)
      const projectId = this.configService.get<string>('FCM_PROJECT_ID');
      const privateKey = this.configService
        .get<string>('FCM_PRIVATE_KEY')
        ?.replace(/\\n/g, '\n');
      const clientEmail = this.configService.get<string>('FCM_CLIENT_EMAIL');

      if (!projectId || !privateKey || !clientEmail) {
        return null;
      }

      return {
        projectId,
        privateKey,
        clientEmail,
        useV1API: true,
      };
    } else {
      // Legacy FCM API
      const serverKey = this.configService.get<string>('FCM_SERVER_KEY');

      if (!serverKey) {
        return null;
      }

      return {
        projectId: '',
        privateKey: '',
        clientEmail: '',
        useV1API: false,
        serverKey,
      };
    }
  }

  isConfigured(): boolean {
    return this.getConfig() !== null;
  }
}
