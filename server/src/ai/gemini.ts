import {
  HarmBlockThreshold,
  HarmCategory,
  ThinkingLevel,
  type GenerateContentConfig,
  type GenerateContentParameters,
} from '@google/genai';

/** The one SDK call the app makes (`ai.models.generateContent`), injected so tests can fake it. */
export type GenerateFn = (params: GenerateContentParameters) => Promise<{
  readonly text?: string | undefined;
  readonly candidates?: readonly { readonly finishReason?: string | undefined }[] | undefined;
}>;

/** What one call to Gemini needs: the system prompt, the user prompt and its limits. */
export interface GenerateRequest {
  readonly system: string;
  readonly prompt: string;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  /** JSON Schema for structured output; omitted for plain text answers. */
  readonly json?: object;
}

/** The model chain and its two time limits. */
export interface GeminiOptions {
  readonly models: readonly string[];
  readonly callTimeoutMs: number;
  readonly deadlineMs: number;
  /** Told about every model that failed before the chain moved on, for the server log. */
  readonly onModelFailure?: (model: string, reason: string) => void;
}

/** A short, log-safe reason: a timeout or the HTTP status. Never the error's text. */
function reasonOf(error: unknown): string {
  if (error instanceof GeminiUnavailableError) return 'timed out';
  const status =
    typeof error === 'object' && error !== null && 'status' in error ? error.status : null;
  return typeof status === 'number' ? `HTTP ${String(status)}` : 'request failed';
}

/** Every model in the chain failed, or the deadline passed. The route answers 503. */
export class GeminiUnavailableError extends Error {
  override readonly name = 'GeminiUnavailableError';
}

// Stated explicitly so the policy does not depend on the API's defaults.
const SAFETY_SETTINGS = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }));

/** Rejects when `signal` aborts, so a call that ignores its signal still cannot hang the chain. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => {
      reject(new GeminiUnavailableError('timed out'));
    };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort);
    });
  });
}

function configFor(request: GenerateRequest, signal: AbortSignal): GenerateContentConfig {
  return {
    systemInstruction: request.system,
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
    safetySettings: SAFETY_SETTINGS,
    // The forecast maths already did the reasoning; low thinking keeps answers fast.
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    abortSignal: signal,
    ...(request.json === undefined
      ? {}
      : { responseMimeType: 'application/json', responseJsonSchema: request.json }),
  };
}

/** One request, the SDK call that answers it and the check its answer must pass. */
interface Job<T> {
  readonly generate: GenerateFn;
  readonly request: GenerateRequest;
  readonly accept: (text: string) => T | null;
}

/** One model's attempt: its accepted answer, or a short reason it failed. */
async function tryModel<T>(
  job: Job<T>,
  model: string,
  signal: AbortSignal,
): Promise<{ readonly value: T } | { readonly reason: string }> {
  try {
    const params = { model, contents: job.request.prompt, config: configFor(job.request, signal) };
    const response = await untilAborted(job.generate(params), signal);
    // An answer cut off by the token limit may still parse; it is not shown.
    if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      return { reason: 'cut off at the token limit' };
    }
    const value = job.accept(response.text ?? '');
    return value === null ? { reason: 'invalid answer' } : { value };
  } catch (error) {
    return { reason: reasonOf(error) };
  }
}

/**
 * Runs a request down the model chain. `accept` validates each answer and returns null to reject
 * it, so a malformed answer is treated like a failed call and never reaches the user. Busy, slow,
 * retired or rejected: any failure moves on to the next model, so one bad model never stops the
 * chain while another could still answer live.
 */
export function createGemini(generate: GenerateFn, options: GeminiOptions) {
  return {
    async run<T>(
      request: GenerateRequest,
      accept: (text: string) => T | null,
    ): Promise<{ value: T; model: string }> {
      const deadline = AbortSignal.timeout(options.deadlineMs);
      for (const model of options.models) {
        if (deadline.aborted) break;
        const signal = AbortSignal.any([deadline, AbortSignal.timeout(options.callTimeoutMs)]);
        const result = await tryModel({ generate, request, accept }, model, signal);
        if ('value' in result) return { value: result.value, model };
        options.onModelFailure?.(model, result.reason);
      }
      throw new GeminiUnavailableError('no model produced a usable answer');
    },
  };
}

export type Gemini = ReturnType<typeof createGemini>;
