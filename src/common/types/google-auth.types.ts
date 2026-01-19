/**
 * Google Cloud Service Account Credentials
 * Based on the standard service account key JSON format
 */
export interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
}

/**
 * Parse service account key JSON string to typed object
 */
export function parseServiceAccountKey(
  keyJson: string,
): ServiceAccountCredentials {
  const trimmedKey = keyJson.trim();

  const parsed =
    tryParseServiceAccountJson(trimmedKey) ??
    tryParseServiceAccountJson(escapePrivateKeyNewlines(trimmedKey));

  // Validate required fields
  if (parsed) {
    return parsed;
  }

  throw new Error('Invalid service account key format');
}

function tryParseServiceAccountJson(
  value: string,
): ServiceAccountCredentials | null {
  try {
    const candidate: unknown = JSON.parse(value);
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      'type' in candidate &&
      'project_id' in candidate &&
      'private_key' in candidate &&
      'client_email' in candidate
    ) {
      return candidate as ServiceAccountCredentials;
    }
  } catch {
    // fall through to return null
  }

  return null;
}

/**
 * Handles multiline private_key values that contain unescaped newlines.
 * Replaces literal newlines inside the private_key string with "\n"
 * so JSON.parse can succeed.
 */
function escapePrivateKeyNewlines(value: string): string {
  return value.replace(
    /"private_key"\s*:\s*"([\s\S]*?)"/m,
    (_match: string, key: string) =>
      `"private_key":"${key.replace(/\r?\n/g, '\\n')}"`,
  );
}
