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

/**
 * Runs a request down the model chain. `accept` validates each answer and returns null to reject
 * it, so a malformed answer is treated like a failed call and never reaches the user.
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
        try {
          const params = { model, contents: request.prompt, config: configFor(request, signal) };
          const response = await untilAborted(generate(params), signal);
          // An answer cut off by the token limit may still parse; it is not shown.
          const truncated = response.candidates?.[0]?.finishReason === 'MAX_TOKENS';
          const value = truncated ? null : accept(response.text ?? '');
          if (value !== null) return { value, model };
        } catch {
          // Busy, slow, retired (404) or rejected: any failure moves on to the next model, so
          // one bad model never stops the chain while another could still answer live.
        }
      }
      throw new GeminiUnavailableError('no model produced a usable answer');
    },
  };
}

/** The chain-running client the routes use. */
export type Gemini = ReturnType<typeof createGemini>;
