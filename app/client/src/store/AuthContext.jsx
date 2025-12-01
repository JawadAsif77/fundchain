import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback
} from 'react';
import { auth, db, supabase } from '../lib/supabase.js';
import { getUserRoleStatus, userApi } from '../lib/api.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

const defaultRoleStatus = {
  hasRole: false,
  role: null,
  isKYCVerified: false,
  companyData: null,
  success: true,
  kycStatus: 'not_started'
};

const clearAllAuthData = () => {
  if (typeof window === 'undefined') return;

  try {
    // Clear supabase + app specific localStorage keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('sb-') ||
          key.includes('supabase') ||
          key.startsWith('fundchain-') ||
          key === 'pendingUserProfile' ||
          key.includes('auth') ||
          key.includes('session'))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Clear sessionStorage
    sessionStorage.clear();

    // Clear cookies
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0].trim();
      if (!name) return;

      const host = window.location.hostname;
      const domains = ['', `domain=${host}`, `domain=.${host}`];

      if (host === 'localhost') {
        domains.push('domain=localhost', 'domain=.localhost');
      }

      domains.forEach((domain) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; ${domain}; SameSite=Lax;`;
      });
    });

    // Clear caches (best-effort)
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
  } catch (e) {
    console.warn('[Auth] clearAllAuthData error:', e);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);             // Supabase auth user
  const [profile, setProfile] = useState(null);       // Users table row
  const [roleStatus, setRoleStatus] = useState(null); // getUserRoleStatus result
  const [loading, setLoading] = useState(true);       // Auth bootstrap + initial profile/role loading
  const [error, setError] = useState(null);
  const [sessionVersion, setSessionVersion] = useState(0); // Forces consumers to re-run effects on session changes

  const debug = process.env.NODE_ENV === 'development';

  const loadUserProfile = useCallback(
    async (userId, sessionUser = null) => {
      if (!userId) return null;

      try {
        const { data, error } = await db.users.getProfile(userId);

        if (!error && data) {
          setProfile(data);
          return data;
        }

        // Profile missing: create a new one
        if (error && error.code === 'PGRST116') {
          if (debug) console.log('[Auth] No profile, creating default profile...');

          const baseUser = sessionUser || user;

          const newProfile = {
            id: userId,
            email: baseUser?.email || '',
            full_name: baseUser?.user_metadata?.full_name || '',
            username: baseUser?.user_metadata?.username || null,
            role: baseUser?.user_metadata?.role || 'investor',
            avatar_url: baseUser?.user_metadata?.avatar_url || null,
            is_verified: 'no'
          };

          const result = await userApi.createUser(newProfile);
          if (result?.error) {
            console.error('[Auth] createUser error:', result.error);
            return null;
          }

          const created = result.data || result;
          setProfile(created);
          return created;
        }

        return null;
      } catch (e) {
        console.error('[Auth] loadUserProfile exception:', e);
        return null;
      }
    },
    [user, debug]
  );

  const loadUserRoleStatus = useCallback(async (userId) => {
    if (!userId) {
      setRoleStatus(defaultRoleStatus);
      return defaultRoleStatus;
    }

    try {
      const status = await getUserRoleStatus(userId);
      if (status && typeof status === 'object') {
        const merged = { ...defaultRoleStatus, ...status };
        setRoleStatus(merged);
        return merged;
      }
      setRoleStatus(defaultRoleStatus);
      return defaultRoleStatus;
    } catch (e) {
      console.error('[Auth] loadUserRoleStatus error:', e);
      setRoleStatus(defaultRoleStatus);
      return defaultRoleStatus;
    }
  }, []);

  // Bootstrap session
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        if (debug) console.log('[Auth] Initializing session...');

        // Best-effort: clear stale caches on app start
        if ('caches' in window) {
          try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
          } catch (e) {
            console.warn('[Auth] Cache clear failed:', e);
          }
        }

        const {
          data: { session },
          error
        } = await supabase.auth.getSession();

        if (error) throw error;

        if (session?.user) {
          // Double-check session validity
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError || !userData?.user) {
            console.warn('[Auth] Invalid session on init, signing out + cleanup');
            try {
              await supabase.auth.signOut();
            } catch (_) {}

            clearAllAuthData();
            if (mounted) {
              setUser(null);
              setProfile(null);
              setRoleStatus(null);
              setLoading(false);
            }
            return;
          }

          if (debug) console.log('[Auth] Valid session for user:', session.user.id);

          if (mounted) setUser(session.user);

          await Promise.all([
            loadUserProfile(session.user.id, session.user),
            loadUserRoleStatus(session.user.id)
          ]);
        } else {
          if (debug) console.log('[Auth] No active session');
        }
      } catch (e) {
        console.error('[Auth] Session init error:', e);
        clearAllAuthData();
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (debug) console.log('[Auth] Auth state changed:', event);

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED' || !session) {
        if (debug) console.log('[Auth] Signed out / no session, clearing state');
        setUser(null);
        setProfile(null);
        setRoleStatus(null);
        setSessionVersion((v) => v + 1);
        setLoading(false);
        return;
      }

      if (session?.user) {
        const newUser = session.user;
        const isUserChange = user && user.id !== newUser.id;

        if (isUserChange) {
          if (debug) console.log('[Auth] Account switch detected, resetting profile + role');
          setProfile(null);
          setRoleStatus(null);
          setSessionVersion((v) => v + 1);
        }

        setUser(newUser);

        await Promise.all([
          loadUserProfile(newUser.id, newUser),
          loadUserRoleStatus(newUser.id)
        ]);

        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [loadUserProfile, loadUserRoleStatus, debug, user]);

  const login = useCallback(async (email, password) => {
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      setError(error.message);
      throw error;
    }
    return data;
  }, []);

  const register = useCallback(async (email, password, userData = {}) => {
    setError(null);
    const { data, error } = await auth.signUp(email, password, {
      full_name: userData.displayName || userData.fullName || '',
      ...userData
    });
    if (error) {
      setError(error.message);
      throw error;
    }
    return data;
  }, []);

  const logout = useCallback(async () => {
    setError(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('[Auth] supabase signOut error:', error.message || error);
      }
    } catch (e) {
      console.warn('[Auth] supabase signOut threw:', e);
    } finally {
      clearAllAuthData();

      setUser(null);
      setProfile(null);
      setRoleStatus(null);
      setSessionVersion((v) => v + 1);
      setLoading(false);

      window.location.replace('/');
    }
  }, []);

  const updateProfile = useCallback(
    async (updates) => {
      if (!user) throw new Error('No user logged in');
      setError(null);

      const result = await userApi.updateProfile(user.id, updates);
      const updated = result?.data || result;

      if (updated) setProfile(updated);
      return updated;
    },
    [user]
  );

  const resetPassword = useCallback(async (email) => {
    setError(null);
    const { error } = await auth.resetPassword(email);
    if (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const currentUser = useMemo(() => {
    if (!user) return null;
    return {
      ...user,
      ...profile,
      roleStatus
    };
  }, [user, profile, roleStatus]);

  const needsProfileCompletion = useMemo(() => {
    if (!user || !profile) return false;
    return !profile.full_name || !profile.username;
  }, [user, profile]);

  const needsRoleSelection = useMemo(() => {
    if (!user || !roleStatus) return false;
    const valid = ['investor', 'creator', 'admin'];
    return !(roleStatus.role && valid.includes(roleStatus.role));
  }, [user, roleStatus]);

  const needsKYC = useMemo(() => {
    if (!user || !roleStatus) return false;
    if (roleStatus.role !== 'creator') return false;
    return !roleStatus.companyData && !roleStatus.isKYCVerified;
  }, [user, roleStatus]);

  const isFullyOnboarded = useMemo(() => {
    if (!user || !roleStatus) return false;
    if (!roleStatus.hasRole) return false;
    if (roleStatus.role === 'creator') return !!roleStatus.companyData;
    return true;
  }, [user, roleStatus]);

  const value = useMemo(
    () => ({
      user: currentUser,
      profile,
      roleStatus,
      sessionVersion,
      loading,
      error,
      login,
      register,
      logout,
      updateProfile,
      resetPassword,
      clearError,
      isAuthenticated: !!user,
      isEmailConfirmed: !!user?.email_confirmed_at,
      needsProfileCompletion,
      needsRoleSelection,
      needsKYC,
      isFullyOnboarded
    }),
    [
      currentUser,
      profile,
      roleStatus,
      sessionVersion,
      loading,
      error,
      login,
      register,
      logout,
      updateProfile,
      resetPassword,
      clearError,
      user,
      needsProfileCompletion,
      needsRoleSelection,
      needsKYC,
      isFullyOnboarded
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
