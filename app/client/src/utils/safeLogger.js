const IS_DEV = import.meta.env.DEV;

const SENSITIVE_KEYS = new Set([
  'access_token',
  'refresh_token',
  'token',
  'authorization',
  'password',
  'secret',
  'private_key',
  'service_role',
  'supabase_service_role_key',
  'openrouter_api_key',
  'ai_service_secret',
  'wallet',
  'wallet_address',
  'balance',
  'balance_fc',
  'locked_fc',
  'kyc',
  'verification',
  'transaction',
  'transactions',
  'tx',
  'txsignature'
]);

const JWT_REGEX = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;

const redactString = (value) => {
  if (typeof value !== 'string') return value;
  if (JWT_REGEX.test(value)) {
    return value.replace(JWT_REGEX, '[REDACTED_TOKEN]');
  }
  return value;
};

const sanitizeValue = (value, depth = 0) => {
  if (depth > 4) return '[REDACTED_DEPTH]';
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, depth + 1));
  }

  if (typeof value === 'object') {
    const output = {};
    for (const [key, val] of Object.entries(value)) {
      const keyLower = key.toLowerCase();
      if (SENSITIVE_KEYS.has(keyLower)) {
        output[key] = '[REDACTED]';
      } else if (keyLower.includes('token') || keyLower.includes('secret') || keyLower.includes('password')) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = sanitizeValue(val, depth + 1);
      }
    }
    return output;
  }

  return redactString(value);
};

const sanitizeArgs = (args) => args.map((arg) => sanitizeValue(arg));

export const safeLogger = {
  log: (...args) => {
    if (!IS_DEV) return;
    console.log(...sanitizeArgs(args));
  },
  info: (...args) => {
    if (!IS_DEV) return;
    console.info(...sanitizeArgs(args));
  },
  warn: (...args) => {
    if (!IS_DEV) return;
    console.warn(...sanitizeArgs(args));
  },
  error: (...args) => {
    if (!IS_DEV) return;
    console.error(...sanitizeArgs(args));
  },
  debug: (...args) => {
    if (!IS_DEV) return;
    console.debug(...sanitizeArgs(args));
  }
};

export const sanitizeLogArgs = sanitizeArgs;
