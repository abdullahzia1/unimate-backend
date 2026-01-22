import axios from 'axios';

type DopplerSecretValue = {
  raw?: string;
  computed?: string;
  value?: string;
};

type DopplerSecretsResponse = {
  secrets?: Record<string, DopplerSecretValue>;
};

/**
 * Fetches secrets from Doppler and populates process.env.
 * Only runs in production when DOPPLER_TOKEN is present.
 */
export async function loadDopplerSecretsIfNeeded(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  const token = process.env.DOPPLER_TOKEN;

  if (!isProd || !token) {
    return;
  }

  const project = process.env.DOPPLER_PROJECT || 'unimate-backend';
  const config = process.env.DOPPLER_CONFIG || 'prd';

  try {
    const response = await axios.get<DopplerSecretsResponse>(
      'https://api.doppler.com/v3/configs/config/secrets',
      {
        params: { project, config },
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const secrets = response.data?.secrets ?? {};

    Object.entries(secrets).forEach(([key, secret]) => {
      const value = secret.computed ?? secret.raw ?? secret.value;
      if (typeof value === 'string') {
        process.env[key] = value;
      }
    });

    console.log(
      `[doppler] Loaded ${Object.keys(secrets).length} secrets for ${project}/${config}`,
    );
  } catch (error) {
    // Log non-sensitive context to help diagnose why Doppler failed.
    console.error('[doppler] Failed to load secrets', error, {
      nodeEnv: process.env.NODE_ENV,
      dopplerProject: project,
      dopplerConfig: config,
      dopplerTokenPresent: Boolean(token),
    });
    throw error;
  }
}
