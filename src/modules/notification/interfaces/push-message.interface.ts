export type NotificationPlatform = 'ios' | 'android' | 'web';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string | number | boolean>;
  badge?: number;
  sound?: string;
  priority?: 'high' | 'normal';
  collapseKey?: string;
}

export interface PushNotificationResult {
  success: boolean;
  token: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface BatchPushNotificationResult {
  deliveredTo: number;
  failedCount: number;
  totalDevices: number;
  invalidTokens: string[];
  results: PushNotificationResult[];
}

export interface NotificationJob {
  type: 'timetable' | 'custom' | 'announcement';
  tokens: string[];
  platform: NotificationPlatform;
  payload: PushNotificationPayload;
  departmentId?: string;
  metadata?: Record<string, any>;
}
