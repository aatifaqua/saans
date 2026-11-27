/** Runtime settings, read once from the environment at startup. */
export interface Config {
  readonly geminiApiKey: string | undefined;
  /** Tried in order; the next one is used when a model is busy, slow or answers badly. */
  readonly models: readonly string[];
  readonly port: number;
  /** Folder of the built web app; when set, the server hosts it on the same origin as the API. */
  readonly staticDir: string | undefined;
  /** Behind Cloud Run's front end the client address comes from X-Forwarded-For. */
  readonly trustProxy: boolean;
  readonly rateLimit: { readonly perMinute: number; readonly aiPerMinute: number };
}

/**
 * Fast models first: under heavy demand the larger flash models can stall for tens of seconds
 * while the lite models still answer in a few, and every answer is schema-checked either way.
 */
const DEFAULT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
];

const present = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
};

/**
 * Builds the config and fails fast on anything that would make the deployed app misbehave. In
 * production a missing key is an error rather than a quiet "AI off" mode.
 */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): Config {
  const geminiApiKey = present(env.GEMINI_API_KEY);
  if (env.NODE_ENV === 'production' && geminiApiKey === undefined) {
    throw new Error('GEMINI_API_KEY is required in production');
  }
  const port = Number(present(env.PORT) ?? '8080');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const models = (present(env.GEMINI_MODELS)?.split(',') ?? DEFAULT_MODELS)
    .map((model) => model.trim())
    .filter((model) => model !== '');
  return {
    geminiApiKey,
    models,
    port,
    staticDir: present(env.STATIC_DIR),
    trustProxy: env.TRUST_PROXY === '1',
    rateLimit: { perMinute: 60, aiPerMinute: 10 },
  };
}
