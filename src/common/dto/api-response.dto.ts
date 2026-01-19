/**
 * Standardized API response wrapper
 */
export class ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;

  constructor(
    success: boolean,
    data?: T,
    error?: { code: string; message: string; details?: unknown },
  ) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.timestamp = new Date().toISOString();
  }

  static success<T>(data: T): ApiResponse<T> {
    return new ApiResponse(true, data);
  }

  static error(
    code: string,
    message: string,
    details?: unknown,
  ): ApiResponse<null> {
    return new ApiResponse(false, null, { code, message, details });
  }
}
