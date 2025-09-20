import { capitalize } from './common';

export class TaggedError extends Error {
  constructor(
    public tag: string,
    public message: string,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TaggedError';
  }
}

export class HttpError extends TaggedError {
  constructor(
    public tag: string,
    public message: string,
    public response: Response
  ) {
    super(tag, message);
    this.name = 'HttpError';
  }
}

export function logInfo(tag: string, message: string) {
  console.info(`[INFO] ${tag}: ${message}`);
}

export function logWarn(tag: string, message: string) {
  console.warn(`[WARN] ${tag}: ${message}`);
}

export function logError(err: TaggedError, metadata?: Record<string, unknown>) {
  console.error(`[Error] ${err.tag}: ${err.message}`);
  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      console.error(`  → ${capitalize(key)}: ${value}`);
    });
  }
}

export async function logHttpError(tag: string, err: HttpError) {
  console.error(`[ERROR] ${tag}: ${err.message} (code: ${err.response.status})`);
  console.error(`  → URL: ${err.response.url}`);
  console.error(`  → Header: ${JSON.stringify(err.response.headers)}`);
  console.error(`  → Response: ${await err.response.text()}`);
}
