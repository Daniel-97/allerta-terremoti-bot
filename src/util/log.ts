export interface Logger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
  child(fields: Record<string, unknown>): Logger;
}

export function createLogger(name: string): Logger {
  const base = { logger: name };

  function makeLogFn(level: string, consoleFn: (...args: unknown[]) => void) {
    return (obj: Record<string, unknown>, msg: string): void => {
      const entry = { ts: new Date().toISOString(), level, ...base, ...obj, msg };
      consoleFn(JSON.stringify(entry));
    };
  }

  const logger: Logger = {
    info: makeLogFn("info", console.log),
    warn: makeLogFn("warn", console.warn),
    error: makeLogFn("error", console.error),
    child: (_extraFields) => logger,
  };

  logger.child = (extraFields: Record<string, unknown>): Logger => {
    const merged = { ...base, ...extraFields };
    return {
      info: (obj, msg) => {
        const entry = { ts: new Date().toISOString(), level: "info", ...merged, ...obj, msg };
        console.log(JSON.stringify(entry));
      },
      warn: (obj, msg) => {
        const entry = { ts: new Date().toISOString(), level: "warn", ...merged, ...obj, msg };
        console.warn(JSON.stringify(entry));
      },
      error: (obj, msg) => {
        const entry = { ts: new Date().toISOString(), level: "error", ...merged, ...obj, msg };
        console.error(JSON.stringify(entry));
      },
    };
  };

  return logger;
}
