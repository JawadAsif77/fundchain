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

// Minimal targeted cleanup for Supabase auth
const clearSupabaseStorage = () => {
  if (typeof window === 'undefined') return;

  const safeClear = (storage) => {
    if (!storage) return;
    const keysToRemove = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (
        key &&
        (key.startsWith('sb-') ||
          key.includes('supabase') ||
          key === 'pendingUserProfile')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        storage.removeItem(k);
      } catch (_) {}
    });
  };

  try {
    safeClear(window.localStorage);
    safeClear(window.sessionStorage);
  } catch (_) {}

  try {
    if (typeof document !== 'undefined') {
      document.cookie.split(';').forEach((cookie) => {
        const name = cookie.split('=')[0].trim();
        if (!name) return;

        const base = `${name}=; Max-Age=0; path=/; SameSite=Lax;`;
        document.cookie = base;
        document.cookie = `${base} domain=${window.location.hostname};`;
        document.cookie = `${base} domain=.${window.location.hostname};`;
      });
    }
  } catch (_) {}
};

// Wrapper used by older code paths – keep it simple & safe
const clearAllAuthData = () => {
  try {
    clearSupabaseStorage();
  } catch (e) {
    console.warn('[Auth] clearAllAuthData error', e);
  }
};

export const AuthProvider = ({ children }) => {
  console.log('[Auth] Provider mount');

  const [user, setUser] = useState(null); // supabase auth user
  const [profile, setProfile] = useState(null);
  const [roleStatus, setRoleStatus] = useState(null);
  const [loading, setLoading] = useState(true); // only for initial big transitions
  const [error, setError] = useState(null);
  const [sessionVersion, setSessionVersion] = useState(0);

  // ---------- Helpers to load profile / role ----------

  const loadUserProfile = useCallback(
    async (userId, sessionUser = null) => {
      if (!userId) return null;

      // PART 5 FIX: Validate userId matches current session
      try {
        const { data: currentSession } = await supabase.auth.getUser();
        if (!currentSession?.user || currentSession.user.id !== userId) {
          console.warn('[Auth] loadUserProfile: userId mismatch with current session, ignoring');
          return null;
        }
      } catch (e) {
        console.warn('[Auth] loadUserProfile: Failed to validate session, aborting');
        return null;
      }

      try {
        console.log('[Auth] loadUserProfile', userId);
        const { data, error } = await db.users.getProfile(userId);

        if (!error && data) {
          setProfile(data);
          return data;
        }

        if (error && error.code === 'PGRST116') {
          console.log('[Auth] profile missing, creating…');
          const baseUser = sessionUser || user;

          let newProfile = null;

          // pending profile from register_simple
          try {
            const raw = localStorage.getItem('pendingUserProfile');
            if (raw) {
              const pending = JSON.parse(raw);
              if (pending?.id === userId) {
                newProfile = {
                  id: userId,
                  email: pending.email,
                  username: pending.username,
                  full_name: pending.full_name,
                  role: pending.role || 'investor',
                  is_verified: 'no'
                };
              }
            }
            localStorage.removeItem('pendingUserProfile');
          } catch {
            localStorage.removeItem('pendingUserProfile');
          }

          if (!newProfile) {
            newProfile = {
              id: userId,
              email: baseUser?.email || '',
              full_name: baseUser?.user_metadata?.full_name || '',
              username: baseUser?.user_metadata?.username || null,
              role: baseUser?.user_metadata?.role || 'investor',
              avatar_url: baseUser?.user_metadata?.avatar_url || null,
              is_verified: 'no'
            };
          }

          const result = await userApi.createUser(newProfile);
          if (result?.error) {
            console.error('[Auth] createUser error:', result.error);
            setError('Failed to create user profile');
            return null;
          }

          const created = result.data || result;
          setProfile(created);
          return created;
        }

        if (error) {
          console.error('[Auth] getProfile error:', error);
          setError('Failed to load user profile');
          return null;
        }

        return null;
      } catch (e) {
        console.error('[Auth] loadUserProfile exception:', e);
        setError('Failed to load user profile');
        return null;
      }
    },
    [user]
  );

  const loadUserRoleStatus = useCallback(async (userId) => {
    if (!userId) {
      setRoleStatus(defaultRoleStatus);
      return defaultRoleStatus;
    }
    try {
      console.log('[Auth] loadUserRoleStatus', userId);
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
      const fallback = { ...defaultRoleStatus, success: false, error: e.message };
      setRoleStatus(fallback);
      return fallback;
    }
  }, []);

  // ---------- Hard session validation to kill ghost sessions ----------

  const ensureHealthySession = useCallback(
    async (session) => {
      if (!session?.user) return null;

      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          console.warn('[Auth] invalid/expired session detected, cleaning up');
          try {
            await supabase.auth.signOut();
          } catch (_) {}
          clearAllAuthData();
          setUser(null);
          setProfile(null);
          setRoleStatus(null);
          return null;
        }
        return data.user;
      } catch (e) {
        console.warn('[Auth] getUser failed, cleaning session', e);
        try {
          await supabase.auth.signOut();
        } catch (_) {}
        clearAllAuthData();
        setUser(null);
        setProfile(null);
        setRoleStatus(null);
        return null;
      }
    },
    []
  );

  // ---------- Initial session + listener ----------

  useEffect(() => {
    let alive = true;
    let timeoutId;

    const init = async () => {
      try {
        console.log('[Auth] init getSession');
        
        // PART 3 FIX: Add timeout protection
        timeoutId = setTimeout(() => {
          if (alive) {
            console.warn('[Auth] getSession timeout after 2000ms');
            setLoading(false);
          }
        }, 2000);

        const { data, error } = await supabase.auth.getSession();
        
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        if (!alive) return;

        if (error) {
          console.error('[Auth] getSession error:', error);
          setError(error.message);
          setLoading(false);
          return;
        }

        const session = data?.session;
        if (!session?.user) {
          console.log('[Auth] no session at init');
          setLoading(false);
          return;
        }

        // validate that session is actually usable
        const healthyUser = await ensureHealthySession(session);
        if (!alive || !healthyUser) {
          setLoading(false);
          return;
        }

        console.log('[Auth] healthy session found', healthyUser.id);
        setUser(healthyUser);

        await Promise.all([
          loadUserProfile(healthyUser.id, healthyUser),
          loadUserRoleStatus(healthyUser.id)
        ]);
      } catch (e) {
        console.error('[Auth] init error:', e);
        if (alive) setError(e.message);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (alive) setLoading(false);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] onAuthStateChange', event);

        if (!alive) return;
        setError(null);

        // PART 2 FIX: Handle logout properly
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setRoleStatus(null);
          setSessionVersion((v) => v + 1);
          setLoading(false);
          return;
        }

        // PART 2 FIX: Don't assume session exists if no session/user
        if (!session?.user) {
          setUser(null);
          setProfile(null);
          setRoleStatus(null);
          setLoading(false);
          return;
        }

        // PART 3 FIX: validate every new session
        const healthyUser = await ensureHealthySession(session);
        if (!alive || !healthyUser) {
          setLoading(false);
          return;
        }

        setUser(healthyUser);
        setSessionVersion((v) => v + 1);

        // PART 4 FIX: Don't block if profile loading fails
        try {
          await Promise.all([
            loadUserProfile(healthyUser.id, healthyUser),
            loadUserRoleStatus(healthyUser.id)
          ]);
        } catch (e) {
          console.warn('[Auth] Profile loading failed during auth change, continuing...', e);
        }

        setLoading(false);
      }
    );

    return () => {
      alive = false;
      listener?.subscription?.unsubscribe();
    };
  }, [ensureHealthySession, loadUserProfile, loadUserRoleStatus]);

  // ---------- Actions ----------

  const login = useCallback(async (email, password) => {
    setError(null);
    console.log('[Auth] login', email);

    // LoginForm controls its own isSubmitting – don’t touch global loading
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('[Auth] login error:', error);
      setError(error.message);
      throw error;
    }

    // onAuthStateChange will take care of user/profile/role
    return data;
  }, []);

  const register = useCallback(async (email, password, userData = {}) => {
    setError(null);
    console.log('[Auth] register', email);

    const { data, error } = await auth.signUp(email, password, {
      full_name: userData.displayName || userData.fullName || '',
      ...userData
    });

    if (error) {
      console.error('[Auth] register error:', error);
      setError(error.message);
      throw error;
    }

    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      console.log('[Auth] logout start');
      setError(null);

      // PART 6 FIX: Correct cleanup sequence
      // 1. signOut first
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[Auth] signOut warning', e?.message || e);
      }

      // 2. Clear storage
      clearAllAuthData();

      // 3. Reset React states
      setUser(null);
      setProfile(null);
      setRoleStatus(null);
      setSessionVersion((v) => v + 1);
      setLoading(false);

      console.log('[Auth] logout done, reloading');
      
      // 4. Force page reload
      window.location.replace('/');
    } catch (e) {
      console.error('[Auth] logout fatal', e);
      clearAllAuthData();
      window.location.replace('/');
    }
  }, []);

  const updateProfile = useCallback(
    async (updates) => {
      if (!user) throw new Error('No user logged in');
      setError(null);

      console.log('[Auth] updateProfile', user.id, updates);
      const result = await userApi.updateProfile(user.id, updates);
      const updated = result?.data || result;

      if (!updated) {
        const err = new Error('Profile update returned no data');
        setError(err.message);
        throw err;
      }

      setProfile(updated);
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

  const clearError = () => setError(null);

  // ---------- Derived state ----------

  const validateSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return false;
      return !!data?.session?.user;
    } catch {
      return false;
    }
  }, []);

  const getCurrentUser = useCallback(() => {
    if (!user) return null;

    if (!profile) {
      return {
        ...user,
        full_name: user.user_metadata?.full_name || '',
        username: user.user_metadata?.username || null,
        role: user.user_metadata?.role || 'investor',
        displayName:
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'User'
      };
    }

    const merged = {
      ...user,
      ...profile,
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      roleStatus
    };

    const appRole =
      roleStatus?.role ||
      profile?.role ||
      user.user_metadata?.role ||
      'investor';

    merged.appRole = appRole;
    merged.role = appRole;
    return merged;
  }, [user, profile, roleStatus]);

  const needsRoleSelection = useMemo(() => {
    if (!user || !roleStatus) return false;
    const valid = ['investor', 'creator', 'admin'];
    return !(roleStatus.role && valid.includes(roleStatus.role));
  }, [user, roleStatus]);

  const needsKYC = useMemo(() => {
    if (!user || !roleStatus) return false;
    if (roleStatus.role !== 'creator') return false;
    return !roleStatus.companyData && !roleStatus.hasKycVerification;
  }, [user, roleStatus]);

  const isFullyOnboarded = useMemo(() => {
    if (!user || !roleStatus) return false;
    if (!roleStatus.hasRole) return false;
    if (roleStatus.role === 'creator') return !!roleStatus.companyData;
    return true;
  }, [user, roleStatus]);

  const needsProfileCompletion = useMemo(() => {
    if (!user || !profile) return false;
    const required = ['full_name', 'username'];
    return required.some((field) => {
      const value = profile[field];
      return typeof value === 'string' ? value.trim() === '' : !value;
    });
  }, [user, profile]);

  const refreshRoleStatus = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const current = data?.user;
      if (!current) {
        setRoleStatus(defaultRoleStatus);
        return defaultRoleStatus;
      }
      return await loadUserRoleStatus(current.id);
    } catch (e) {
      const fallback = { ...defaultRoleStatus, success: false, error: e.message };
      setRoleStatus(fallback);
      return fallback;
    }
  }, [loadUserRoleStatus]);

  const refreshUserData = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const current = data?.user;
      if (!current) return false;

      setUser(current);
      await Promise.all([
        loadUserProfile(current.id, current),
        loadUserRoleStatus(current.id)
      ]);
      return true;
    } catch (e) {
      console.error('[Auth] refreshUserData error', e);
      return false;
    }
  }, [loadUserProfile, loadUserRoleStatus]);

  const updateRoleStatus = useCallback((updates) => {
    setRoleStatus((prev) => ({
      ...(prev || defaultRoleStatus),
      ...updates
    }));
  }, []);

  const value = {
    user: getCurrentUser(),
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
    isFullyOnboarded,

    validateSession,
    refreshRoleStatus,
    updateRoleStatus,
    refreshUserData
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
