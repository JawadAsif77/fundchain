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
  const failedUserCreationsRef = useRef(new Set()); // Track users that failed creation

  // --- 1. CORE DATA LOADER (Prevents Duplicate Fetches) ---
  const loadUserData = useCallback(async (userId, sessionUser = null) => {
    if (fetchingUserDataRef.current === userId) return;
    
    // Check if this user already failed creation - prevent infinite retries
    if (failedUserCreationsRef.current.has(userId) && !sessionUser) {
      console.log('[Auth] Skipping retry for user with failed creation:', userId);
      setLoading(false);
      return;
    }
    
    fetchingUserDataRef.current = userId;

    try {
      console.log('[Auth] Loading user data for:', userId);
      
      // Try to get existing profile from database
      const { data: existingProfile, error } = await userApi.getProfile(userId);
      
      console.log('[Auth] Profile fetch result:', { existingProfile, error });
      
      let userProfile = existingProfile;
      
      // If user doesn't exist in database, create them
      if (!existingProfile && sessionUser) {
        console.log('[Auth] New user, creating profile...');
        
        // Generate base username
        let baseUsername = sessionUser.user_metadata?.username || 
                           sessionUser.user_metadata?.preferred_username ||
                           sessionUser.user_metadata?.name?.toLowerCase().replace(/\s+/g, '') ||
                           `user_${userId.substring(0, 8)}`;
        
        const newUser = {
          id: userId,
          email: sessionUser.email,
          full_name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || '',
          username: baseUsername,
          role: null, // Always NULL for new users - they must select
          avatar_url: sessionUser.user_metadata?.avatar_url || sessionUser.user_metadata?.picture || null,
          is_verified: 'no'
        };
        
        console.log('[Auth] Creating user with username:', newUser.username);
        
        let { data: createdUser, error: createError } = await userApi.createUser(newUser);
        
        // Handle username conflict - generate unique username
        if (createError?.code === '23505' && createError?.message?.includes('users_username_key')) {
          console.log('[Auth] Username conflict detected, generating unique username...');
          
          // Try up to 5 times with random suffixes
          for (let attempt = 1; attempt <= 5; attempt++) {
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            newUser.username = `${baseUsername}${randomSuffix}`;
            
            console.log(`[Auth] Retry ${attempt}/5 with username:`, newUser.username);
            
            const retry = await userApi.createUser(newUser);
            createdUser = retry.data;
            createError = retry.error;
            
            if (!createError) {
              console.log('[Auth] Successfully created user with unique username:', newUser.username);
              break;
            }
            
            if (createError?.code !== '23505') {
              // Different error, stop retrying
              break;
            }
          }
        }
        
        if (createError) {
          console.error('[Auth] Failed to create user after retries:', createError);
          failedUserCreationsRef.current.add(userId);
          
          // Still set loading to false and return - user can't proceed without profile
          setProfile(null);
          setLoading(false);
          return;
        }
        
        userProfile = createdUser;
        console.log('[Auth] User created successfully:', userProfile);
        
        // Clear from failed set if it was there
        failedUserCreationsRef.current.delete(userId);
      }
      
      console.log('[Auth] Setting profile:', userProfile);
      console.log('[Auth] Profile is_verified value:', userProfile?.is_verified, 'Type:', typeof userProfile?.is_verified);
      
      // Set profile state
      setProfile(userProfile);
      
      // Set role status
      if (userProfile) {
        const isVerified = userProfile.is_verified === 'verified';
        console.log('[Auth] KYC Check - is_verified:', userProfile.is_verified, '- isVerified:', isVerified);
        const roleStatusValue = {
          ...defaultRoleStatus,
          hasRole: !!userProfile.role,
          role: userProfile.role,
          isKYCVerified: isVerified,
          kycStatus: isVerified ? 'approved' : 'not_started'
        };
        console.log('[Auth] Setting roleStatus:', roleStatusValue);
        setRoleStatus(roleStatusValue);
      }
      
      // Load wallet if user exists
      if (userProfile) {
        getWallet(userId).then(w => {
          if (w.status === 'success') {
            setWallet({ balanceFc: w.balanceFc, lockedFc: w.lockedFc });
          }
        }).catch(e => console.warn('Wallet load warning:', e));
      }

    } catch (e) {
      console.error('[Auth] loadUserData error:', e);
    } finally {
      fetchingUserDataRef.current = null;
      console.log('[Auth] Setting loading to false');
      setLoading(false);
    }
  }, []);

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

    // --- 3. AUTH LISTENER ---
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log(`[Auth] Auth Event: ${event}`);

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setProfile(null);
        setRoleStatus(null);
        setWallet(null);
        failedUserCreationsRef.current.clear(); // Clear failed attempts on logout
        setLoading(false);
        return;
      }

      if (session?.user) {
        // Set user immediately
        setUser(session.user);
        
        // Only load user data on meaningful events, NOT on token refresh
        // TOKEN_REFRESHED happens every few seconds and doesn't mean user data changed
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          console.log(`[Auth] Loading user data for event: ${event}`);
          loadUserData(session.user.id, session.user);
        } else {
          console.log(`[Auth] Skipping data load for ${event} event - user data unchanged`);
        }
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
    if (!user || !profile) return false;
    // User needs to select role if role is NULL
    return !profile.role;
  }, [user, profile]);

  const needsKYC = useMemo(() => {
    if (!user || !roleStatus) return false;
    if (roleStatus.role !== 'creator') return false;
    // Creators need KYC if they haven't been verified yet
    return !roleStatus.isKYCVerified;
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