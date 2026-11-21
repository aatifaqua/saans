import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { GoogleGenAI } from '@google/genai';
import type { GenerateFn } from './ai/gemini.ts';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig(process.env);

/** The real Gemini call; everything else talks to it through the injected `GenerateFn`. */
function sdkGenerate(apiKey: string): GenerateFn {
  const ai = new GoogleGenAI({ apiKey });
  return (params) => ai.models.generateContent(params);
}

const generate = config.geminiApiKey === undefined ? null : sdkGenerate(config.geminiApiKey);
const app = createApp({
  config,
  fetch: (url, init) => fetch(url, init),
  generate,
  now: Date.now,
  socketAddress: (c) => getConnInfo(c).remote.address,
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(JSON.stringify({ event: 'listening', port: info.port, ai: generate !== null }));
});

const shutdown = (): void => {
  server.close(() => process.exit(0));
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
