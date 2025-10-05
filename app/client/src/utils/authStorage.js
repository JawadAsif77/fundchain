import { supabase } from '../lib/supabase.js';

const AUTH_KEY_PATTERNS = ['sb-', 'supabase', 'auth', 'session'];

const buildNormalizedSet = (items = []) => {
  const normalized = new Set();
  items.forEach((item) => {
    if (typeof item === 'string' && item.trim()) {
      normalized.add(item.toLowerCase());
    }
  });
  return normalized;
};

const shouldClearKey = (key, normalizedExtraKeys) => {
  if (!key) return false;
  const normalizedKey = key.toLowerCase();
  if (normalizedExtraKeys.has(normalizedKey)) {
    return true;
  }
  return AUTH_KEY_PATTERNS.some((pattern) => normalizedKey.includes(pattern));
};

const getSupabaseAuthKeyCandidates = () => {
  const keys = new Set();
  try {
    const authClient = supabase?.auth;
    const storageKey = authClient?.storageKey ?? authClient?.['storageKey'];
    if (storageKey) {
      keys.add(storageKey);
      keys.add(`${storageKey}-user`);
      keys.add(`${storageKey}-code-verifier`);
    }
  } catch (error) {
    console.warn('Unable to derive Supabase storage keys for cleanup:', error);
  }

  // Always include the default GoTrue key as a fallback for older sessions
  keys.add('supabase.auth.token');

  return Array.from(keys).filter(Boolean);
};

const uniqStrings = (items = []) => Array.from(new Set(items.filter((item) => typeof item === 'string' && item.trim())));

export const clearAuthStorage = (additionalKeys = []) => {
  if (typeof window === 'undefined') return;

  const normalizedExtraKeys = buildNormalizedSet(additionalKeys);
  const explicitKeys = uniqStrings(additionalKeys);

  const removeMatchingKeys = (storage) => {
    if (!storage) return;

    const keysToRemove = new Set(explicitKeys);

    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (shouldClearKey(key, normalizedExtraKeys)) {
        keysToRemove.add(key);
      }
    }

    keysToRemove.forEach((key) => {
      try {
        storage.removeItem(key);
      } catch (error) {
        console.warn('Unable to remove storage key:', key, error);
      }
    });
  };

  try {
    removeMatchingKeys(window.localStorage);
  } catch (error) {
    console.warn('Unable to clear auth keys from localStorage:', error);
  }

  try {
    removeMatchingKeys(window.sessionStorage);
  } catch (error) {
    console.warn('Unable to clear auth keys from sessionStorage:', error);
  }
};

export const clearAuthCookies = (additionalNames = []) => {
  if (typeof document === 'undefined') return;

  const normalizedExtraNames = buildNormalizedSet(additionalNames);
  const explicitNames = new Set(uniqStrings(additionalNames));

  const cookies = document.cookie.split(';');
  cookies.forEach((cookie) => {
    const trimmed = cookie.trim();
    if (!trimmed) return;

    const [cookieName] = trimmed.split('=');
    if (!cookieName) return;

    if (shouldClearKey(cookieName, normalizedExtraNames)) {
      explicitNames.add(cookieName);
    }
  });

  if (!explicitNames.size) return;

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const baseAttributes = ['Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'Path=/', 'SameSite=Lax'];
  if (secure) {
    baseAttributes.push('Secure');
  }

  const domainOptions = new Set([undefined]);
  if (hostname) {
    domainOptions.add(hostname);
    domainOptions.add(hostname.startsWith('.') ? hostname : `.${hostname}`);
  }

  explicitNames.forEach((cookieName) => {
    domainOptions.forEach((domain) => {
      const attributes = [...baseAttributes];
      if (domain) {
        attributes.push(`Domain=${domain}`);
      }

      try {
        document.cookie = `${cookieName}=; ${attributes.join('; ')};`;
      } catch (error) {
        console.warn('Unable to clear cookie:', cookieName, error);
      }
    });
  });
};

export const clearAuthCaches = async (additionalNames = []) => {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  const normalizedExtraNames = buildNormalizedSet(additionalNames);

  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => shouldClearKey(name, normalizedExtraNames))
        .map((name) => caches.delete(name))
    );
  } catch (error) {
    console.warn('Unable to clear auth caches:', error);
  }
};

export const clearAllAuthArtifacts = async ({
  additionalStorageKeys = [],
  additionalCookieNames = [],
  additionalCacheKeys = []
} = {}) => {
  const supabaseKeys = getSupabaseAuthKeyCandidates();

  const storageKeys = [...additionalStorageKeys, ...supabaseKeys];
  const cookieNames = [...additionalCookieNames, ...supabaseKeys];
  const cacheKeys = [...additionalCacheKeys, ...supabaseKeys];

  clearAuthStorage(storageKeys);
  clearAuthCookies(cookieNames);
  await clearAuthCaches(cacheKeys);
};

export const forceClearSupabaseSession = async () => {
  const supabaseKeys = getSupabaseAuthKeyCandidates();

  clearAuthStorage(supabaseKeys);
  clearAuthCookies(supabaseKeys);

  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      await clearAuthCaches(supabaseKeys);
    }
  } catch (error) {
    console.warn('Unable to clear auth caches during Supabase session reset:', error);
  }

  try {
    const authClient = supabase?.auth;
    if (!authClient) return;

    const removeFromStorage = async (storage) => {
      if (!storage) return;
      await Promise.all(
        supabaseKeys.map(async (key) => {
          if (!key) return;
          try {
            const result = storage.removeItem?.(key);
            if (result instanceof Promise) {
              await result;
            }
          } catch (error) {
            console.warn('Unable to remove Supabase storage key:', key, error);
          }
        })
      );
    };

    await removeFromStorage(authClient.storage ?? authClient['storage']);
    await removeFromStorage(authClient.userStorage ?? authClient['userStorage']);

    const memoryStorage = authClient.memoryStorage ?? authClient['memoryStorage'];
    if (memoryStorage && typeof memoryStorage === 'object') {
      supabaseKeys.forEach((key) => {
        if (key in memoryStorage) {
          try {
            delete memoryStorage[key];
          } catch (error) {
            console.warn('Unable to clear Supabase memory storage key:', key, error);
          }
        }
      });
    }

    if (typeof authClient._removeSession === 'function') {
      await authClient._removeSession();
    }
  } catch (error) {
    console.warn('Unable to force clear Supabase session:', error);
  }
};
