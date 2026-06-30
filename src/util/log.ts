export interface Logger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
  child(fields: Record<string, unknown>): Logger;
}

function buildLogger(
  base: Record<string, unknown>,
  childCallback: (f: Record<string, unknown>) => Logger,
): Logger {
  return {
    info: (obj, msg) => {
      const entry = { ts: new Date().toISOString(), level: "info", ...base, ...obj, msg };
      console.log(JSON.stringify(entry));
    },
    warn: (obj, msg) => {
      const entry = { ts: new Date().toISOString(), level: "warn", ...base, ...obj, msg };
      console.warn(JSON.stringify(entry));
    },
    error: (obj, msg) => {
      const entry = { ts: new Date().toISOString(), level: "error", ...base, ...obj, msg };
      console.error(JSON.stringify(entry));
    },
    child: (extra) => childCallback({ ...base, ...extra }),
  };
}

export function createLogger(name: string): Logger {
  const base = { logger: name };

  const childFactory = (merged: Record<string, unknown>): Logger => {
    return buildLogger(merged, childFactory);
  };

  return buildLogger(base, childFactory);
}
