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
    const fcmConfig = this.configService.get<{
      useV1Api: boolean;
      projectId?: string;
      privateKey?: string;
      clientEmail?: string;
      serverKey?: string;
    }>('fcm');

    if (!fcmConfig) {
      return null;
    }

    if (fcmConfig.useV1Api) {
      // FCM HTTP v1 API (recommended)
      const projectId = fcmConfig.projectId;
      const privateKey = fcmConfig.privateKey?.replace(/\\n/g, '\n');
      const clientEmail = fcmConfig.clientEmail;

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
      const serverKey = fcmConfig.serverKey;

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
