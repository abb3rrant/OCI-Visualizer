/**
 * Streaming JSON array parser.
 *
 * Processes a readable stream containing JSON in one of these formats:
 *   - {"data": [...items...]}        (OCI CLI standard)
 *   - {"data": {"items": [...]}}     (OCI CLI paginated)
 *   - [...items...]                  (plain array)
 *
 * Yields individual items without loading the entire file into memory,
 * keeping peak heap usage proportional to a single item rather than the
 * full file (which can be 1-2 GB for 30k instances with base64 blobs).
 */

import { Readable, Transform, TransformCallback } from 'stream';
import { createRequire } from 'module';

// stream-json and stream-chain are CJS-only packages.  Named ESM imports
// fail at runtime ("does not provide an export named …") so we use
// createRequire to load them reliably under Node's ESM resolver.
const require = createRequire(import.meta.url);
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');
const { chain } = require('stream-chain');

/**
 * Detect the JSON wrapper format by peeking at the first non-whitespace byte
 * of in-memory data.  Returns 'array' for top-level arrays, 'object' for
 * wrapped `{"data": [...]}` format.
 */
export function detectFormat(input: string | Buffer): 'array' | 'object' {
  if (typeof input === 'string') {
    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      if (ch === 0x20 || ch === 0x09 || ch === 0x0a || ch === 0x0d) continue;
      return ch === 0x5b /* '[' */ ? 'array' : 'object';
    }
  } else {
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === 0x20 || ch === 0x09 || ch === 0x0a || ch === 0x0d) continue;
      return ch === 0x5b /* '[' */ ? 'array' : 'object';
    }
  }
  return 'object'; // default
}

/**
 * Custom objectMode Transform that navigates through the token stream
 * produced by stream-json's parser() to find the first JSON array nested
 * inside wrapper objects.
 *
 * Handles:
 *   {"data": [...]}           → skips outer object, passes array tokens
 *   {"data": {"items": [...]}} → skips two object layers, passes array tokens
 *
 * This replaces `pick({filter: 'data'})` which can't handle both formats.
 */
class FindNestedArray extends Transform {
  private depth = 0;
  private found = false;
  private arrayDepth = 0;

  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk: any, _encoding: string, callback: TransformCallback): void {
    if (this.found) {
      // Already inside the target array — pass through tokens
      this.push(chunk);
      if (chunk.name === 'startArray') this.arrayDepth++;
      if (chunk.name === 'endArray') {
        this.arrayDepth--;
        if (this.arrayDepth === 0) {
          // End of the target array — stop passing tokens
          this.found = false;
        }
      }
    } else {
      // Navigating wrapper objects to find the first array
      if (chunk.name === 'startArray') {
        this.found = true;
        this.arrayDepth = 1;
        this.push(chunk);
      } else if (chunk.name === 'startObject') {
        this.depth++;
      } else if (chunk.name === 'endObject') {
        this.depth--;
      }
      // All other tokens (keys, primitive values) are skipped
    }
    callback();
  }
}

/**
 * Stream individual JSON array items from a readable stream.
 *
 * @param readable  The source stream (e.g. JSZip nodeStream).
 * @param format    'object' for `{"data": [...]}` or `{"data": {"items": [...]}}`,
 *                  'array' for `[...]`.
 *                  The caller must determine this before calling — do NOT
 *                  try to peek at the stream (which causes data loss).
 */
export async function* streamJsonItems(
  readable: NodeJS.ReadableStream,
  format: 'array' | 'object',
): AsyncGenerator<any, void, void> {
  // Build the stream-json pipeline — pipe the readable directly in,
  // no peek / reconstruct needed.
  const stages: any[] = [readable, parser()];

  if (format === 'object') {
    // Navigate into wrapper objects to find the data array.
    // Handles both {"data": [...]} and {"data": {"items": [...]}}.
    stages.push(new FindNestedArray());
  }

  stages.push(streamArray());

  const pipeline = chain(stages);

  try {
    for await (const { value } of pipeline) {
      yield value;
    }
  } finally {
    pipeline.destroy();
  }
}

/**
 * Create a readable stream from a string or Buffer.
 */
export function toReadable(input: string | Buffer): Readable {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  const stream = new Readable({ read() {} });
  // Push in chunks to avoid holding the full buffer in the stream's internal queue
  const CHUNK = 64 * 1024;
  let offset = 0;
  const pushNext = () => {
    while (offset < buf.length) {
      const end = Math.min(offset + CHUNK, buf.length);
      const canContinue = stream.push(buf.subarray(offset, end));
      offset = end;
      if (!canContinue) {
        // Back-pressure: wait for drain
        stream._read = pushNext;
        return;
      }
    }
    stream.push(null);
    stream._read = () => {};
  };
  pushNext();
  return stream;
}
