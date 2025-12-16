import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef
} from 'react';
import { auth, db, supabase } from '../lib/supabase.js';
import { getUserRoleStatus, userApi, clearRequestCache } from '../lib/api.js';
import { getWallet } from '../services/walletService.js';

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

// FIXED: Clean cache clearing that targets Supabase specifically
const clearAllAuthData = () => {
  if (typeof window === 'undefined') return;
  console.log('🧹 Clearing auth data...');

  try {
    // 1. Clear Supabase and App specific LocalStorage keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase') || key === 'fundchain-auth') {
        localStorage.removeItem(key);
      }
    });
    
    // 2. Clear SessionStorage
    sessionStorage.clear();

    // 3. Clear Cookies (Targeted)
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      if (name.includes('sb-') || name.includes('supabase')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });

    console.log('✅ Auth data cleared');
  } catch (e) {
    console.warn('[Auth] clearAllAuthData error:', e);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roleStatus, setRoleStatus] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionVersion, setSessionVersion] = useState(0);

  const debug = process.env.NODE_ENV === 'development';

  // Refs to prevent race conditions
  const initializationRef = useRef(null);
  const profileLoadRef = useRef(null);
  const roleLoadRef = useRef(null);
  const logoutRef = useRef(false);
  const walletRefreshTimeRef = useRef(0);

  // Load wallet data
  const refreshWallet = useCallback(async (userId) => {
    if (!userId) return;
    
    // Throttle: only allow refresh every 10 seconds
    const now = Date.now();
    const lastRefresh = walletRefreshTimeRef.current || 0;
    if (now - lastRefresh < 10000) {
      console.log('[Auth] Wallet refresh throttled');
      return;
    }
    walletRefreshTimeRef.current = now;
    
    try {
      console.log('[Auth] Loading wallet for user:', userId);
      const walletData = await getWallet(userId);
      
      if (walletData.status === 'success') {
        setWallet({
          balanceFc: walletData.balanceFc,
          lockedFc: walletData.lockedFc
        });
        console.log('[Auth] Wallet loaded:', walletData);
      } else if (walletData.status === 'not_found') {
        console.log('[Auth] Wallet not found for user');
        setWallet(null);
      }
    } catch (err) {
      console.error('[Auth] Failed to load wallet:', err);
    }
  }, []);

  // FIXED: Load user profile without state dependencies
  // Refresh profile data (for use after KYC submission, etc.)
  const refreshProfile = useCallback(async (userId) => {
    if (!userId) return null;
    profileLoadRef.current = null; // Clear the ref to allow reload
    roleLoadRef.current = null; // Also clear role status ref
    const profileData = await loadUserProfile(userId);
    await loadUserRoleStatus(userId); // Also reload role status
    return profileData;
  }, []);

  const loadUserProfile = useCallback(
    async (userId, sessionUser = null) => {
      if (!userId) return null;

      // Prevent concurrent profile loads
      if (profileLoadRef.current) {
        return profileLoadRef.current;
      }

      profileLoadRef.current = (async () => {
        try {
          const { data, error } = await db.users.getProfile(userId);

          if (!error && data) {
            setProfile(data);
            return data;
          }

          if (error && error.code === 'PGRST116') {
            if (debug) console.log('[Auth] No profile, creating...');

            const newProfile = {
              id: userId,
              email: sessionUser?.email || '',
              full_name: sessionUser?.user_metadata?.full_name || '',
              username: sessionUser?.user_metadata?.username || null,
              role: sessionUser?.user_metadata?.role || 'investor',
              avatar_url: sessionUser?.user_metadata?.avatar_url || null,
              is_verified: 'no'
            };

            let created;
            try {
              const result = await userApi.createUser(newProfile);
              if (result?.error) {
                console.error('[Auth] createUser error:', result.error);
                return null;
              }

              created = result.data || result;
              setProfile(created);
            } catch (createError) {
              // If user already exists (duplicate), try fetching again
              if (createError.message?.includes('duplicate') || createError.message?.includes('unique constraint')) {
                console.warn('[Auth] User already exists, fetching existing profile');
                const { data: existingData } = await db.users.getProfile(userId);
                if (existingData) {
                  setProfile(existingData);
                  created = existingData;
                } else {
                  throw createError;
                }
              } else {
                throw createError;
              }
            }

            /* ⭐ Create wallet AFTER profile creation */
            try {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

              const response = await fetch(`${supabaseUrl}/functions/v1/create-user-wallet`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ userId })
              });

              const walletResult = await response.json();
              console.log('[Auth] Wallet created after profile:', walletResult);

              await refreshWallet(userId);
            } catch (err) {
              console.error('[Auth] Wallet create error:', err);
            }

            return created;

          }

          return null;
        } catch (e) {
          console.error('[Auth] loadUserProfile exception:', e);
          return null;
        }
      })();

      // Clear ref AFTER promise settles
      profileLoadRef.current
        .finally(() => {
          profileLoadRef.current = null;
        });

      return profileLoadRef.current;
    },
    [debug]
  );

  const loadUserRoleStatus = useCallback(async (userId) => {
    if (!userId) {
      setRoleStatus(defaultRoleStatus);
      return defaultRoleStatus;
    }

    if (roleLoadRef.current) {
      return roleLoadRef.current;
    }

    roleLoadRef.current = (async () => {
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
    })();

    // Clear ref AFTER promise settles
    roleLoadRef.current
      .finally(() => {
        roleLoadRef.current = null;
      });

    return roleLoadRef.current;
  }, []);

  // FIXED: Bootstrap session with better error handling
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      // Prevent concurrent initializations
      if (initializationRef.current) {
        return initializationRef.current;
      }

      initializationRef.current = (async () => {
        try {
          if (debug) console.log('[Auth] Initializing session...');

          // Clear stale caches on init
          if ('caches' in window) {
            try {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
            } catch (e) {
              console.warn('[Auth] Cache clear failed:', e);
            }
          }

          // Better approach - 15 second timeout
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Session load timeout')), 15000)
          );

          const { data: { session }, error } = await Promise.race([
            sessionPromise,
            timeoutPromise
          ]);

          if (error) {
            console.error('[Auth] Session error:', error);
            throw error;
          }

          if (session?.user) {
            // Verify session is actually valid
            const { data: userData, error: userError } = await supabase.auth.getUser();
            
            if (userError || !userData?.user) {
              console.warn('[Auth] Invalid session on init, cleaning up');
              
              // Sign out from Supabase
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

            // Load profile first, then role (sequential to avoid races)
            const profileData = await loadUserProfile(session.user.id, session.user);
            if (mounted && profileData) {
              await loadUserRoleStatus(session.user.id);
              // Load wallet after session is restored
              await refreshWallet(session.user.id);
            }
          } else {
            if (debug) console.log('[Auth] No active session');
          }
        } catch (e) {
          console.error('[Auth] Session init error:', e);
          
          // Don't logout on timeout - user might already be logged in
          // Only clear if it's an actual auth error, not a timeout
          if (e.message?.includes('JWT') || e.message?.includes('invalid') || e.message?.includes('expired')) {
            console.warn('[Auth] Auth error detected, clearing session');
            clearAllAuthData();
            
            if (mounted) {
              setUser(null);
              setProfile(null);
              setRoleStatus(null);
            }
          } else {
            console.warn('[Auth] Non-auth error during init, keeping existing session');
          }
        } finally {
          if (mounted) {
            setLoading(false);
            initializationRef.current = null;
          }
        }
      })();

      return initializationRef.current;
    };

    initSession();

    // FIXED: Handle all auth state changes properly
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || logoutRef.current) return;

      if (debug) console.log('[Auth] Auth state changed:', event);

      // Handle signout/deletion
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED' || !session) {
        setUser(null);
        setProfile(null);
        setRoleStatus(null);
        setSessionVersion((v) => v + 1);
        setLoading(false);
        return;
      }

      // FIXED: Handle token refresh without reloading everything
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        if (user?.id === session.user.id) {
          // Same user, just update the user object
          setUser(session.user);
          return;
        }
      }

      // Handle signin/signup/user change
      if (session?.user) {
        // 🛑 STOP THE LOOP: If the user ID matches, do NOTHING.
        // This prevents the infinite "Memoizing profile" logs you saw.
        if (user && user.id === session.user.id) {
            return; 
        }

        const newUser = session.user;
        const isUserChange = !user || user.id !== newUser.id;

        if (isUserChange) {
          if (debug) console.log('[Auth] User changed, resetting');
          // Only reset these if it's actually a different person
          setProfile(null); 
          setRoleStatus(null);
          setSessionVersion((v) => v + 1);
        }

        setUser(newUser);

        // Only load profile if we don't have it or user changed
        if (isUserChange || !profile) {
          // Pass the user object to avoid async race conditions
          const profileData = await loadUserProfile(newUser.id, newUser);
          if (mounted && profileData) {
            await loadUserRoleStatus(newUser.id);
            // Load wallet if needed
            await refreshWallet(newUser.id); 
          }
        }

        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []); // Empty dependencies - only run once

  // FIXED: Passive visibility check
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && user) {
        // Just check if we have a session locally. 
        // Supabase auto-refresh handles the rest.
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
           console.log('[Auth] Session missing, attempting recovery...');
           const { error } = await supabase.auth.refreshSession();
           // Only logout if recovery explicitly fails
           if (error) logout(); 
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

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
    
    // Load wallet after successful login
    if (data.user?.id) {
      await refreshWallet(data.user.id);
    }
    
    return data;
  }, [refreshWallet]);

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
  }, [refreshWallet]);

  // FIXED: Logout with aggressive cleanup
  const logout = useCallback(async () => {
    console.log('🚪 Starting logout process...');
    
    // Set logout flag to prevent auth state change handler interference
    logoutRef.current = true;
    
    setError(null);
    setLoading(true);

    try {
      // 1. Sign out from Supabase (with timeout)
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((resolve) => 
        setTimeout(() => {
          console.warn('[Auth] Signout timeout, continuing with cleanup');
          resolve({ error: null });
        }, 3000)
      );

      const { error } = await Promise.race([signOutPromise, timeoutPromise]);
      
      if (error) {
        console.warn('[Auth] Supabase signOut error:', error.message);
      }
    } catch (e) {
      console.warn('[Auth] Supabase signOut threw:', e);
    }

    // 2. Clear ALL auth data (always do this, even if signOut failed)
    clearAllAuthData();
    clearRequestCache();

    // 3. Reset ALL state
    setUser(null);
    setProfile(null);
    setRoleStatus(null);
    setWallet(null);
    setSessionVersion((v) => v + 1);
    setLoading(false);
    
    // Reset refs
    initializationRef.current = null;
    profileLoadRef.current = null;
    roleLoadRef.current = null;

    console.log('✅ Logout complete, redirecting...');

    // 4. Force hard redirect (don't use react-router)
    // Use setTimeout to ensure state updates complete
    setTimeout(() => {
      logoutRef.current = false;
      window.location.href = '/';
    }, 100);
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
      userId: currentUser?.id || null,
      profile,
      roleStatus,
      wallet,
      sessionVersion,
      loading,
      error,
      login,
      register,
      logout,
      updateProfile,
      resetPassword,
      clearError,
      refreshWallet: () => refreshWallet(currentUser?.id),
      refreshProfile: () => refreshProfile(currentUser?.id),
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
      wallet,
      sessionVersion,
      loading,
      error,
      login,
      register,
      logout,
      updateProfile,
      resetPassword,
      clearError,
      refreshWallet,
      refreshProfile,
      user,
      needsProfileCompletion,
      needsRoleSelection,
      needsKYC,
      isFullyOnboarded
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};