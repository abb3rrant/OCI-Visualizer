import { env } from '../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[env.LOG_LEVEL];
}

type Meta = Record<string, unknown>;

function emit(level: LogLevel, baseCtx: Meta, message: string, meta?: Meta) {
  if (!shouldLog(level)) return;
  const entry: Meta = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...baseCtx,
  };
  if (meta && Object.keys(meta).length > 0) {
    entry.meta = meta;
  }
  const output = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

export interface Logger {
  debug(message: string, meta?: Meta): void;
  info(message: string, meta?: Meta): void;
  warn(message: string, meta?: Meta): void;
  error(message: string, meta?: Meta): void;
  /** Returns a child logger that merges the given context into every log entry. */
  child(ctx: Meta): Logger;
}

function make(baseCtx: Meta): Logger {
  return {
    debug: (m, meta) => emit('debug', baseCtx, m, meta),
    info: (m, meta) => emit('info', baseCtx, m, meta),
    warn: (m, meta) => emit('warn', baseCtx, m, meta),
    error: (m, meta) => emit('error', baseCtx, m, meta),
    child: (ctx) => make({ ...baseCtx, ...ctx }),
  };
}

export const logger = make({});
