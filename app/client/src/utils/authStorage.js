const AUTH_KEY_PATTERNS = ['sb-', 'supabase', 'auth', 'session'];

const matchesAuthKey = (key) => {
  if (!key) return false;
  return AUTH_KEY_PATTERNS.some((pattern) => key.toLowerCase().includes(pattern));
};

export const clearAuthStorage = () => {
  if (typeof window === 'undefined') return;

  const removeMatchingKeys = (storage) => {
    if (!storage) return;
    const keysToRemove = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (matchesAuthKey(key)) {
        keysToRemove.push(key);
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

export const clearAuthCookies = () => {
  if (typeof document === 'undefined') return;

  const cookies = document.cookie.split(';');
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  cookies.forEach((cookie) => {
    const trimmed = cookie.trim();
    if (!trimmed) return;

    const [cookieName] = trimmed.split('=');
    if (!matchesAuthKey(cookieName)) return;

    const cookieBases = [
      '',
      `; domain=${hostname}`,
      hostname ? `; domain=.${hostname}` : '',
    ];

    cookieBases.forEach((domainPart) => {
      try {
        document.cookie = `${cookieName}=; Max-Age=0; path=/${domainPart}; SameSite=Lax;`;
      } catch (error) {
        console.warn('Unable to clear cookie:', cookieName, error);
      }
    });
  });
};

export const clearAuthCaches = async () => {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => matchesAuthKey(name))
        .map((name) => caches.delete(name))
    );
  } catch (error) {
    console.warn('Unable to clear auth caches:', error);
  }
};

export const clearAllAuthArtifacts = async () => {
  clearAuthStorage();
  clearAuthCookies();
  await clearAuthCaches();
};
