import { Injectable, Logger } from '@nestjs/common';
import apn from 'apn';
import { APNsConfigService } from '../config/apns.config';
import {
  PushNotificationPayload,
  PushNotificationResult,
  BatchPushNotificationResult,
} from '../interfaces/push-message.interface';

// Type definitions for APNs library responses
interface APNsProvider {
  send(
    notification: APNsNotification,
    deviceToken: string | string[],
  ): Promise<APNsResponse>;
}

interface APNsNotification {
  alert?: string | { title?: string; body?: string };
  badge?: number;
  sound?: string;
  topic?: string;
  priority?: number;
  payload?: Record<string, unknown>;
  collapseId?: string;
}

interface APNsResponse {
  sent: Array<{ device: string }>;
  failed: Array<{
    device: string;
    status?: number | string;
    response?: { reason?: string };
  }>;
}

@Injectable()
export class APNsService {
  private readonly logger = new Logger(APNsService.name);
  private apnProvider: APNsProvider | null = null;

  constructor(private apnsConfig: APNsConfigService) {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    const config = this.apnsConfig.getConfig();
    if (!config) {
      this.logger.warn('APNs not configured, skipping initialization');
      return;
    }

    try {
      const options: apn.ProviderOptions = {
        token: {
          key: config.key,
          keyId: config.keyId,
          teamId: config.teamId,
        },
        production: config.production,
      };

      // Type assertion needed because apn library types are not fully resolved
      const ProviderConstructor = (
        apn as { Provider: new (options: apn.ProviderOptions) => APNsProvider }
      ).Provider;
      this.apnProvider = new ProviderConstructor(options);
      this.logger.log(
        `APNs provider initialized (${config.production ? 'production' : 'sandbox'})`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize APNs provider', error);
      this.apnProvider = null;
    }
  }

  /**
   * Send notification to a single device
   */
  async sendToToken(
    token: string,
    payload: PushNotificationPayload,
  ): Promise<PushNotificationResult> {
    if (!this.apnProvider) {
      return {
        success: false,
        token,
        error: {
          code: 'apns_not_configured',
          message: 'APNs provider is not configured',
        },
      };
    }

    const config = this.apnsConfig.getConfig();
    if (!config) {
      return {
        success: false,
        token,
        error: {
          code: 'apns_not_configured',
          message: 'APNs configuration is missing',
        },
      };
    }

    try {
      const notification: APNsNotification = {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: payload.sound || 'default',
        topic: config.bundleId,
        priority: payload.priority === 'high' ? 10 : 5,
      };

      if (payload.badge !== undefined) {
        notification.badge = payload.badge;
      }

      if (payload.data) {
        notification.payload = payload.data as Record<string, unknown>;
      }

      if (payload.collapseKey) {
        notification.collapseId = payload.collapseKey;
      }

      const result = await this.apnProvider.send(notification, token);

      if (result.sent.length > 0) {
        return {
          success: true,
          token,
        };
      }

      if (result.failed.length > 0) {
        const failure = result.failed[0];
        const statusNumber =
          typeof failure.status === 'string'
            ? parseInt(failure.status, 10)
            : failure.status;
        const errorCode = this.mapAPNsErrorCode(
          typeof statusNumber === 'number' && !isNaN(statusNumber)
            ? statusNumber
            : undefined,
        );
        return {
          success: false,
          token,
          error: {
            code: errorCode,
            message: failure.response?.reason || 'Unknown APNs error',
          },
        };
      }

      return {
        success: false,
        token,
        error: {
          code: 'unknown_error',
          message: 'No response from APNs',
        },
      };
    } catch (error) {
      this.logger.error(`Failed to send APNs notification to ${token}`, error);
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
   * Send notifications to multiple devices (batch)
   * APNs supports up to 500 tokens per batch
   */
  async sendToTokens(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<BatchPushNotificationResult> {
    if (!this.apnProvider || tokens.length === 0) {
      return {
        deliveredTo: 0,
        failedCount: tokens.length,
        totalDevices: tokens.length,
        invalidTokens: [],
        results: tokens.map((token) => ({
          success: false,
          token,
          error: {
            code: 'apns_not_configured',
            message: 'APNs provider is not configured',
          },
        })),
      };
    }

    const config = this.apnsConfig.getConfig();
    if (!config) {
      return {
        deliveredTo: 0,
        failedCount: tokens.length,
        totalDevices: tokens.length,
        invalidTokens: [],
        results: tokens.map((token) => ({
          success: false,
          token,
          error: {
            code: 'apns_not_configured',
            message: 'APNs configuration is missing',
          },
        })),
      };
    }

    const results: PushNotificationResult[] = [];
    const invalidTokens: string[] = [];
    let deliveredTo = 0;
    let failedCount = 0;

    // Process in batches of 500 (APNs limit)
    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);

      try {
        const notification: APNsNotification = {
          alert: {
            title: payload.title,
            body: payload.body,
          },
          sound: payload.sound || 'default',
          topic: config.bundleId,
          priority: payload.priority === 'high' ? 10 : 5,
        };

        if (payload.badge !== undefined) {
          notification.badge = payload.badge;
        }

        if (payload.data) {
          notification.payload = payload.data as Record<string, unknown>;
        }

        if (payload.collapseKey) {
          notification.collapseId = payload.collapseKey;
        }

        const result = await this.apnProvider.send(notification, batch);

        // Process successful sends
        result.sent.forEach((device) => {
          deliveredTo++;
          results.push({
            success: true,
            token: device.device,
          });
        });

        // Process failures
        result.failed.forEach((failure) => {
          failedCount++;
          const statusNumber =
            typeof failure.status === 'string'
              ? parseInt(failure.status, 10)
              : failure.status;
          const errorCode = this.mapAPNsErrorCode(
            typeof statusNumber === 'number' && !isNaN(statusNumber)
              ? statusNumber
              : undefined,
          );
          const isInvalidToken =
            errorCode === 'invalid_token' || errorCode === 'unregistered_token';

          if (isInvalidToken) {
            invalidTokens.push(failure.device);
          }

          results.push({
            success: false,
            token: failure.device,
            error: {
              code: errorCode,
              message: failure.response?.reason || 'Unknown APNs error',
            },
          });
        });
      } catch (error) {
        this.logger.error(
          `Failed to send batch APNs notifications (batch ${i / batchSize + 1})`,
          error,
        );
        // Mark all tokens in this batch as failed
        batch.forEach((token) => {
          failedCount++;
          results.push({
            success: false,
            token,
            error: {
              code: 'batch_error',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          });
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
   * Map APNs status codes to error codes
   */
  private mapAPNsErrorCode(status: number | undefined): string {
    if (!status) {
      return 'unknown_error';
    }

    // APNs status codes
    switch (status) {
      case 400:
        return 'bad_request';
      case 403:
        return 'forbidden';
      case 405:
        return 'method_not_allowed';
      case 410:
        return 'unregistered_token'; // Token is no longer valid
      case 413:
        return 'payload_too_large';
      case 429:
        return 'too_many_requests';
      case 500:
      case 503:
        return 'server_error';
      default:
        return 'unknown_error';
    }
  }

  /**
   * Check if APNs is configured
   */
  isConfigured(): boolean {
    return this.apnProvider !== null && this.apnsConfig.isConfigured();
  }
}
