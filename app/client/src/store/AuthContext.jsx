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

// HELPER: Safe cleanup that doesn't break the browser
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

  // Refs to prevent race conditions & loops
  const initializationRef = useRef(null);
  const fetchingUserDataRef = useRef(false);

  // --- 1. CORE DATA LOADER (Prevents Duplicate Fetches) ---
  const loadUserData = useCallback(async (userId, sessionUser = null) => {
    // If already fetching for this specific user, skip
    if (fetchingUserDataRef.current === userId) return;
    fetchingUserDataRef.current = userId;

    try {
      console.log('[Auth] Loading full user data for:', userId);
      
      // A. Load Profile
      let userProfile = null;
      // Use the safe API method we fixed
      const { data, error } = await userApi.getProfile(userId);

      if (!error && data) {
        userProfile = data;
      } else if (sessionUser) {
        // Create profile if missing
        if (debug) console.log('[Auth] No profile found, creating default...');
        const newProfile = {
          id: userId,
          email: sessionUser.email,
          full_name: sessionUser.user_metadata?.full_name || '',
          username: sessionUser.user_metadata?.username || null,
          role: sessionUser.user_metadata?.role || 'investor',
          avatar_url: sessionUser.user_metadata?.avatar_url || null,
          is_verified: 'no'
        };
        const result = await userApi.createUser(newProfile);
        userProfile = result.data || result;
      }

      // Update Profile State
      setProfile(userProfile);

      // B. Load Role Status (Parallel is fine here if API is stable, sequential is safer)
      const status = await getUserRoleStatus(userId);
      const userRoleStatus = { ...defaultRoleStatus, ...(status || {}) };
      setRoleStatus(userRoleStatus);
      
      // C. Load Wallet (Fire and forget, don't block auth)
      getWallet(userId).then(w => {
        if (w.status === 'success') {
          setWallet({ balanceFc: w.balanceFc, lockedFc: w.lockedFc });
        }
      }).catch(e => console.warn('Wallet load warning:', e));

    } catch (e) {
      console.error('[Auth] loadUserData error:', e);
    } finally {
      fetchingUserDataRef.current = null;
    }
  }, [debug]);

  // --- 2. INITIALIZATION ---
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      if (initializationRef.current) return;
      initializationRef.current = true;

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session?.user && mounted) {
          // Set user immediately
          setUser(session.user);
          // Load data
          await loadUserData(session.user.id, session.user);
        }
      } catch (e) {
        console.error('[Auth] Init error:', e);
        if (e.message?.includes('JWT')) clearAllAuthData();
      } finally {
        if (mounted) {
          setLoading(false);
          initializationRef.current = null;
        }
      }
    };

    initSession();

    // --- 3. THE CRITICAL FIX: LOOP-PROOF AUTH LISTENER ---
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log(`[Auth] Auth Event: ${event}`);

      if (event === 'SIGNED_OUT' || !session) {
        // Clean Reset
        setUser(null);
        setProfile(null);
        setRoleStatus(null);
        setWallet(null);
        setLoading(false);
        clearRequestCache();
        return;
      }

      if (session?.user) {
        // ⭐ THE FIX: STRICT ID CHECK ⭐
        // This stops the infinite loop. If the user ID hasn't changed, 
        // DO NOT update state and DO NOT fetch data.
        setUser(prevUser => {
          if (prevUser?.id === session.user.id) {
            return prevUser; // Return exact same object reference -> No Re-render
          }
          
          // Only if ID is different (Real Login/User Switch):
          console.log('[Auth] User identity changed, fetching new data...');
          loadUserData(session.user.id, session.user);
          return session.user;
        });
        
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [loadUserData]);

  // --- 4. PUBLIC ACTIONS ---

  const login = useCallback(async (email, password) => {
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
    try {
      await supabase.auth.signOut();
    } catch (e) { console.warn('SignOut warning', e); }
    
    clearAllAuthData();
    clearRequestCache();
    
    // Reset State
    setUser(null);
    setProfile(null);
    setRoleStatus(null);
    setWallet(null);
    setSessionVersion(v => v + 1);
    
    // Hard redirect to clear any lingering memory state
    window.location.href = '/';
  }, []);

  const updateProfileHandler = useCallback(async (updates) => {
    if (!user) throw new Error('No user logged in');
    setError(null);

    const result = await userApi.updateProfile(user.id, updates);
    const updated = result?.data || result;

    if (updated) setProfile(updated);
    return updated;
  }, [user]);

  const resetPassword = useCallback(async (email) => {
    setError(null);
    const { error } = await auth.resetPassword(email);
    if (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // --- 5. COMPUTED VALUES (Preserved from your original file) ---
  
  const currentUser = useMemo(() => {
    if (!user) return null;
    return { ...user, ...profile, roleStatus };
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

  const value = useMemo(() => ({
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
    updateProfile: updateProfileHandler,
    resetPassword,
    clearError,
    refreshWallet: () => getWallet(user?.id).then(w => w.status==='success' && setWallet({balanceFc: w.balanceFc, lockedFc: w.lockedFc})),
    refreshProfile: () => loadUserData(user?.id, user),
    isAuthenticated: !!user,
    isEmailConfirmed: !!user?.email_confirmed_at,
    needsProfileCompletion,
    needsRoleSelection,
    needsKYC,
    isFullyOnboarded
  }), [
    currentUser, profile, roleStatus, wallet, sessionVersion, loading, error,
    login, register, logout, updateProfileHandler, resetPassword, clearError,
    loadUserData, user, needsProfileCompletion, needsRoleSelection, needsKYC, isFullyOnboarded
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};