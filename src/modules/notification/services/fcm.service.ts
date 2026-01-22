import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { GoogleAuth } from 'google-auth-library';
import { FCMConfigService } from '../config/fcm.config';
import {
  PushNotificationPayload,
  PushNotificationResult,
  BatchPushNotificationResult,
} from '../interfaces/push-message.interface';

@Injectable()
export class FCMService {
  private readonly logger = new Logger(FCMService.name);
  private authClient: GoogleAuth | null = null;
  private httpClient: AxiosInstance;
  private fcmEndpoint: string | null = null;

  constructor(private fcmConfig: FCMConfigService) {
    this.httpClient = axios.create({
      timeout: 30000, // 30 seconds
    });
    this.initializeProvider();
  }

  private initializeProvider(): void {
    const config = this.fcmConfig.getConfig();
    if (!config) {
      this.logger.warn('FCM not configured, skipping initialization');
      return;
    }

    try {
      if (config.useV1API) {
        // FCM HTTP v1 API (recommended)
        this.authClient = new GoogleAuth({
          credentials: {
            client_email: config.clientEmail,
            private_key: config.privateKey,
          },
          scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
        });

        this.fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`;
        this.logger.log('FCM HTTP v1 API initialized');
      } else {
        // Legacy API
        this.fcmEndpoint = 'https://fcm.googleapis.com/fcm/send';
        this.logger.log('FCM Legacy API initialized');
      }
    } catch (error) {
      this.logger.error('Failed to initialize FCM provider', error);
      this.authClient = null;
      this.fcmEndpoint = null;
    }
  }

  /**
   * Send notification to a single device using FCM HTTP v1 API
   */
  async sendToToken(
    token: string,
    payload: PushNotificationPayload,
  ): Promise<PushNotificationResult> {
    const config = this.fcmConfig.getConfig();
    if (!config || !this.fcmEndpoint) {
      return {
        success: false,
        token,
        error: {
          code: 'fcm_not_configured',
          message: 'FCM provider is not configured',
        },
      };
    }

    try {
      if (config.useV1API) {
        return await this.sendV1API(token, payload);
      } else {
        return await this.sendLegacyAPI(token, payload, config.serverKey!);
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to send FCM notification to ${token}`, error);
      return {
        success: false,
        token,
        error: {
          code: 'send_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Send using FCM HTTP v1 API
   */
  private async sendV1API(
    token: string,
    payload: PushNotificationPayload,
  ): Promise<PushNotificationResult> {
    if (!this.authClient) {
      return {
        success: false,
        token,
        error: {
          code: 'fcm_not_configured',
          message: 'FCM auth client is not initialized',
        },
      };
    }

    try {
      const accessToken = await this.authClient.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          token,
          error: {
            code: 'auth_error',
            message: 'Failed to get access token',
          },
        };
      }

      const message = {
        message: {
          token: token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: this.formatDataPayload(payload.data),
          android: {
            priority: payload.priority === 'high' ? 'high' : 'normal',
          },
          apns: {
            headers: {
              'apns-priority': payload.priority === 'high' ? '10' : '5',
            },
            payload: {
              aps: {
                alert: {
                  title: payload.title,
                  body: payload.body,
                },
                badge: payload.badge,
                sound: payload.sound || 'default',
              },
            },
          },
        },
      };

      const response = await this.httpClient.post(this.fcmEndpoint!, message, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const responseData = response.data as { name?: string };
      if (responseData.name) {
        return {
          success: true,
          token,
        };
      }

      return {
        success: false,
        token,
        error: {
          code: 'unknown_error',
          message: 'Unexpected response from FCM',
        },
      };
    } catch (error: unknown) {
      const errorCode = this.mapFCMErrorCode(error);
      const errorMessage =
        (
          error as {
            response?: { data?: { error?: { message?: string } } };
            message?: string;
          }
        )?.response?.data?.error?.message ||
        (error as { message?: string })?.message ||
        'Unknown FCM error';
      return {
        success: false,
        token,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }
  }

  /**
   * Send using Legacy FCM API
   */
  private async sendLegacyAPI(
    token: string,
    payload: PushNotificationPayload,
    serverKey: string,
  ): Promise<PushNotificationResult> {
    try {
      const message = {
        to: token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: this.formatDataPayload(payload.data),
        priority: payload.priority === 'high' ? 'high' : 'normal',
        collapse_key: payload.collapseKey,
      };

      const response = await this.httpClient.post(this.fcmEndpoint!, message, {
        headers: {
          Authorization: `key=${serverKey}`,
          'Content-Type': 'application/json',
        },
      });

      const responseData = response.data as {
        success?: number;
        results?: Array<{ error?: string }>;
      };

      if (responseData.success === 1) {
        return {
          success: true,
          token,
        };
      }

      const errorMessage = responseData.results?.[0]?.error || 'Unknown error';
      const errorCode = this.mapLegacyFCMErrorCode(errorMessage);

      return {
        success: false,
        token,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    } catch (error: unknown) {
      const errorCode = this.mapFCMErrorCode(error);
      const errorMessage =
        (
          error as {
            response?: { data?: { error?: string } };
            message?: string;
          }
        )?.response?.data?.error ||
        (error as { message?: string })?.message ||
        'Unknown error';
      return {
        success: false,
        token,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      };
    }
  }

  /**
   * Send notifications to multiple devices (batch)
   * FCM v1 API supports up to 500 messages per batch
   */
  async sendToTokens(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<BatchPushNotificationResult> {
    const config = this.fcmConfig.getConfig();
    if (!config || !this.fcmEndpoint || tokens.length === 0) {
      return {
        deliveredTo: 0,
        failedCount: tokens.length,
        totalDevices: tokens.length,
        invalidTokens: [],
        results: tokens.map((token) => ({
          success: false,
          token,
          error: {
            code: 'fcm_not_configured',
            message: 'FCM provider is not configured',
          },
        })),
      };
    }

    const results: PushNotificationResult[] = [];
    const invalidTokens: string[] = [];
    let deliveredTo = 0;
    let failedCount = 0;

    // Process in batches of 500 (FCM limit)
    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);

      if (config.useV1API) {
        // FCM v1 API - send individually (v1 doesn't support true batch)
        // But we can parallelize with Promise.all
        const batchResults = await Promise.allSettled(
          batch.map((token) => this.sendV1API(token, payload)),
        );

        batchResults.forEach((result, index) => {
          const token = batch[index];
          if (result.status === 'fulfilled') {
            const pushResult = result.value;
            results.push(pushResult);

            if (pushResult.success) {
              deliveredTo++;
            } else {
              failedCount++;
              if (
                pushResult.error?.code === 'invalid_token' ||
                pushResult.error?.code === 'unregistered_token'
              ) {
                invalidTokens.push(token);
              }
            }
          } else {
            failedCount++;
            const reason = result.reason as { message?: string } | undefined;
            results.push({
              success: false,
              token,
              error: {
                code: 'batch_error',
                message: reason?.message || 'Unknown error',
              },
            });
          }
        });
      } else {
        // Legacy API - can use multicast (up to 1000 tokens)
        // But for consistency, we'll process in batches
        const batchResults = await Promise.allSettled(
          batch.map((token) =>
            this.sendLegacyAPI(token, payload, config.serverKey!),
          ),
        );

        batchResults.forEach((result, index) => {
          const token = batch[index];
          if (result.status === 'fulfilled') {
            const pushResult = result.value;
            results.push(pushResult);

            if (pushResult.success) {
              deliveredTo++;
            } else {
              failedCount++;
              if (
                pushResult.error?.code === 'invalid_token' ||
                pushResult.error?.code === 'unregistered_token'
              ) {
                invalidTokens.push(token);
              }
            }
          } else {
            failedCount++;
            const reason = result.reason as { message?: string } | undefined;
            results.push({
              success: false,
              token,
              error: {
                code: 'batch_error',
                message: reason?.message || 'Unknown error',
              },
            });
          }
        });
      }
    }

    return {
      deliveredTo,
      failedCount,
      totalDevices: tokens.length,
      invalidTokens,
      results,
    };
  }

  /**
   * Format data payload for FCM (all values must be strings)
   */
  private formatDataPayload(
    data?: Record<string, string | number | boolean>,
  ): Record<string, string> | undefined {
    if (!data) {
      return undefined;
    }

    const formatted: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      formatted[key] = String(value);
    }
    return formatted;
  }

  /**
   * Map FCM v1 API error codes
   */
  private mapFCMErrorCode(error: unknown): string {
    const errorResponse = (
      error as {
        response?: { status?: number; data?: { error?: { status?: string } } };
      }
    )?.response;
    if (errorResponse?.status) {
      const status = errorResponse.status;
      if (status === 400) return 'bad_request';
      if (status === 401) return 'unauthorized';
      if (status === 403) return 'forbidden';
      if (status === 404) return 'invalid_token';
      if (status === 429) return 'too_many_requests';
      if (status >= 500) return 'server_error';
    }

    const errorCode = errorResponse?.data?.error?.status;
    if (errorCode) {
      if (errorCode === 'INVALID_ARGUMENT') return 'invalid_token';
      if (errorCode === 'NOT_FOUND') return 'unregistered_token';
      if (errorCode === 'PERMISSION_DENIED') return 'forbidden';
      if (errorCode === 'UNAUTHENTICATED') return 'unauthorized';
      if (errorCode === 'RESOURCE_EXHAUSTED') return 'too_many_requests';
    }

    return 'unknown_error';
  }

  /**
   * Map Legacy FCM error codes
   */
  private mapLegacyFCMErrorCode(errorMessage: string): string {
    if (errorMessage.includes('InvalidRegistration')) return 'invalid_token';
    if (errorMessage.includes('NotRegistered')) return 'unregistered_token';
    if (errorMessage.includes('MismatchSenderId')) return 'forbidden';
    if (errorMessage.includes('InvalidPackageName')) return 'bad_request';
    return 'unknown_error';
  }

  /**
   * Check if FCM is configured
   */
  isConfigured(): boolean {
    return this.fcmEndpoint !== null && this.fcmConfig.isConfigured();
  }
}
