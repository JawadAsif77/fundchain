import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { auth, db, supabase } from '../lib/supabase.js';
import { getUserRoleStatus } from '../lib/api.js';

// Import the API functions we need
import { userApi } from '../lib/api.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const defaultRoleStatus = {
  hasRole: false,
  role: null,
  isKYCVerified: false,
  companyData: null,
  success: true,
  kycStatus: 'not_started'
};

const clearSupabaseAuthStorage = () => {
  if (typeof window === 'undefined') return;

  const clearStorage = (storage) => {
    if (!storage) return;

    const keysToRemove = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      try {
        storage.removeItem(key);
      } catch (removeError) {
        console.warn('Unable to remove storage key:', key, removeError);
      }
    });
  };

  try {
    clearStorage(window.localStorage);
  } catch (storageError) {
    console.warn('Unable to clear Supabase localStorage keys:', storageError);
  }

  try {
    clearStorage(window.sessionStorage);
  } catch (sessionError) {
    console.warn('Unable to clear Supabase sessionStorage keys:', sessionError);
  }

  try {
    if (typeof document !== 'undefined') {
      document.cookie.split(';').forEach((cookie) => {
        const trimmed = cookie.trim();
        if (!trimmed) return;

        const cookieName = trimmed.split('=')[0];
        if (cookieName && (cookieName.startsWith('sb-') || cookieName.includes('supabase'))) {
          document.cookie = `${cookieName}=; Max-Age=0; path=/; SameSite=Lax;`;
          document.cookie = `${cookieName}=; Max-Age=0; path=/; domain=${window.location.hostname}; SameSite=Lax;`;
          // Also clear for root domain
          document.cookie = `${cookieName}=; Max-Age=0; path=/; domain=.${window.location.hostname}; SameSite=Lax;`;
        }
      });
    }
  } catch (cookieError) {
    console.warn('Unable to clear Supabase cookies:', cookieError);
  }
};

// Enhanced function to clear ALL authentication data
const clearAllAuthData = async () => {
  if (typeof window === 'undefined') return;

  localStorage.clear();
  // Clear all localStorage
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('sb-') || 
        key.includes('supabase') || 
        key === 'pendingUserProfile' ||
        key === 'fundchain-theme' ||
        key.includes('auth') ||
        key.includes('user') ||
        key.includes('session')
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Error clearing localStorage:', error);
  }

  // Clear all sessionStorage
  try {
    sessionStorage.clear();
  } catch (error) {
    console.warn('Error clearing sessionStorage:', error);
  }

  // Clear ALL cookies
  try {
    if (typeof document !== 'undefined') {
      document.cookie.split(';').forEach((cookie) => {
        const cookieName = cookie.split('=')[0].trim();
        if (cookieName) {
          // Clear for multiple domain configurations
          const domains = ['', `domain=${window.location.hostname}`, `domain=.${window.location.hostname}`];
          if (window.location.hostname === 'localhost') {
            domains.push('domain=localhost');
          }
          
          domains.forEach(domain => {
            document.cookie = `${cookieName}=; Max-Age=0; path=/; ${domain}; SameSite=Lax;`;
          });
        }
      });
    }
  } catch (error) {
    console.warn('Error clearing cookies:', error);
  }

  // Clear caches (for PWA/service workers)
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    }
  } catch (error) {
    console.warn('Error clearing caches:', error);
  }
};

export const AuthProvider = ({ children }) => {
  console.log('AuthProvider initializing...');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roleStatus, setRoleStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Increment this whenever auth/session refreshes so views can refetch
  const [sessionVersion, setSessionVersion] = useState(0);

  // Load initial session and set up auth listener
  useEffect(() => {
    let mounted = true;

    const getInitialSession = async () => {
      try {
        console.log('AuthContext: Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setError(error.message);
        } else if (session?.user && mounted) {
          console.log('AuthContext: Session found, setting user:', session.user.id);
          setUser(session.user);
          
          try {
            console.log('AuthContext: Loading initial user profile...');
            await loadUserProfile(session.user.id, session.user);
            console.log('AuthContext: Initial user profile loaded successfully');
          } catch (profileError) {
            console.error('AuthContext: Error loading initial user profile:', profileError);
          }
          
          try {
            console.log('AuthContext: Loading initial user role status...');
            await loadUserRoleStatus(session.user.id);
            console.log('AuthContext: Initial user role status loaded successfully');
          } catch (roleError) {
            console.error('AuthContext: Error loading initial user role status:', roleError);
          }
        } else {
          console.log('AuthContext: No session found');
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
        setError(error.message);
      } finally {
        if (mounted) {
          console.log('AuthContext: Setting loading to false');
          setLoading(false);
        }
      }
    };

    // Add timeout to prevent infinite loading - reduce to 3 seconds for snappier UX
    const timeout = setTimeout(() => {
      if (mounted) {
        console.log('AuthContext: Loading timeout reached, forcing loading to false');
        setLoading(false);
      }
    }, 3000);

    getInitialSession();

    // Listen for auth state changes with enhanced token refresh handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthContext: Auth state change event:', event);
      if (!mounted) return;

      setError(null);
      
      // Handle token refresh specifically
      if (event === 'TOKEN_REFRESHED') {
        console.log('AuthContext: Token refreshed successfully');
        if (session?.user) {
          setUser(session.user);
          // Don't reload profile on token refresh to avoid unnecessary calls
        }
        // Bump session version so consumers can refetch protected data
        setSessionVersion(v => v + 1);
        setLoading(false);
        return;
      }
      
      // Handle sign out
      if (event === 'SIGNED_OUT') {
        console.log('AuthContext: User signed out');
        setUser(null);
        setProfile(null);
        setRoleStatus(null);
        setSessionVersion(v => v + 1);
        setLoading(false);
        return;
      }
      
      if (session?.user) {
        console.log('AuthContext: Setting user from auth change:', session.user.id);
        setUser(session.user);
        setSessionVersion(v => v + 1);
        
        try {
          console.log('AuthContext: Loading user profile...');
          await loadUserProfile(session.user.id, session.user);
          console.log('AuthContext: User profile loaded successfully');
        } catch (profileError) {
          console.error('AuthContext: Error loading user profile:', profileError);
        }
        
        try {
          console.log('AuthContext: Loading user role status...');
          await loadUserRoleStatus(session.user.id);
          console.log('AuthContext: User role status loaded successfully');
        } catch (roleError) {
          console.error('AuthContext: Error loading user role status:', roleError);
        }
      } else {
        console.log('AuthContext: Clearing user from auth change');
        setUser(null);
        setProfile(null);
        setRoleStatus(null);
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, []);

  // Session validation helper
  const validateSession = async () => {
    try {
      // Apply a short timeout so we never block UI on session checks
      const withTimeout = (p, ms = 12000) => new Promise((resolve, reject) => {
        const id = setTimeout(() => reject(new Error('getSession timed out')), ms);
        p.then((v) => { clearTimeout(id); resolve(v); })
         .catch((e) => { clearTimeout(id); reject(e); });
      });

      const { data: { session }, error } = await withTimeout(supabase.auth.getSession());

      if (error) {
        console.warn('AuthContext: Session validation error:', error);
        return false;
      }

      if (!session || !session.user) {
        console.warn('AuthContext: No valid session found');
        return false;
      }

      // Only force a refresh if the token is actually expired.
      const expiresAtMs = (session.expires_at || 0) * 1000;
      const now = Date.now();
      if (expiresAtMs && expiresAtMs <= now) {
        console.log('AuthContext: Token expired, refreshing...');
        const withRefreshTimeout = (p, ms = 12000) => new Promise((resolve) => {
          const id = setTimeout(() => resolve({ data: null, error: new Error('refresh timed out') }), ms);
          p.then((v) => { clearTimeout(id); resolve(v); })
           .catch((e) => { clearTimeout(id); resolve({ data: null, error: e }); });
        });
        const { data, error: refreshError } = await withRefreshTimeout(supabase.auth.refreshSession());
        if (refreshError) {
          console.error('AuthContext: Token refresh failed:', refreshError);
          return false;
        }
        return !!data?.session?.user;
      }

      return true;
    } catch (error) {
      console.error('AuthContext: Session validation failed:', error);
      return false;
    }
  };

  // Serialize profile updates to avoid concurrent state thrash
  const saveQueueRef = useRef(Promise.resolve());

  const loadUserRoleStatus = async (userId) => {
    try {
      console.log('Loading role status for userId:', userId);

      // Add more debugging for the API call
      console.log('Calling getUserRoleStatus API...');
      const status = await getUserRoleStatus(userId);
      console.log('getUserRoleStatus API returned:', status);

      if (status && typeof status === 'object') {
        const mergedStatus = {
          ...defaultRoleStatus,
          ...status
        };
        console.log('Setting roleStatus to:', mergedStatus);
        setRoleStatus(mergedStatus);
        console.log('Role status set in context successfully');
        return mergedStatus;
      }

      console.warn('Invalid role status returned, resetting to defaults:', status);
      setRoleStatus(defaultRoleStatus);
      return defaultRoleStatus;
    } catch (error) {
      console.error('Error loading role status:', error);
      console.error('Error details:', error.message, error.stack);
      // Set a default status if there's an error
      const fallbackStatus = {
        ...defaultRoleStatus,
        success: false,
        error: error.message
      };
      setRoleStatus(fallbackStatus);
      return fallbackStatus;
    }
  };

  const loadUserProfile = async (userId, userSession = null) => {
    try {
      console.log('Loading user profile for userId:', userId);
      const { data, error } = await db.users.getProfile(userId);
      
      if (error) {
        console.log('Profile error:', error);
        // If profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          console.log('Creating new profile for user');
          const sessionUser = userSession || user;
          
          // Check if there's pending profile data from registration
          const pendingProfileData = localStorage.getItem('pendingUserProfile');
          let newProfile;
          
          if (pendingProfileData) {
            try {
              const pendingData = JSON.parse(pendingProfileData);
              if (pendingData.id === userId) {
                console.log('Found pending profile data, using it:', pendingData);
                newProfile = {
                  id: userId,
                  email: pendingData.email,
                  username: pendingData.username,
                  full_name: pendingData.full_name,
                  role: pendingData.role,
                  is_verified: 'no'
                };
                // Clean up the stored data
                localStorage.removeItem('pendingUserProfile');
              }
            } catch (parseError) {
              console.error('Error parsing pending profile data:', parseError);
              localStorage.removeItem('pendingUserProfile');
            }
          }
          
          // Fallback to user metadata if no pending data
          if (!newProfile) {
            console.log('No pending data, creating profile from user metadata');
            newProfile = {
              id: userId,
              email: sessionUser?.email || '',
              full_name: sessionUser?.user_metadata?.full_name || '',
              username: sessionUser?.user_metadata?.username || null,
              role: sessionUser?.user_metadata?.role || 'investor',
              avatar_url: sessionUser?.user_metadata?.avatar_url || null,
              is_verified: 'no'
            };
          }
          
          console.log('Creating profile with data:', newProfile);
          const result = await userApi.createUser(newProfile);
          
          if (result.error) {
            console.error('Error creating profile:', result.error);
            setError('Failed to create user profile');
          } else {
            console.log('Profile created successfully:', result.data);
            setProfile(result.data);
          }
        } else {
          console.error('Error loading profile:', error);
          setError('Failed to load user profile');
        }
      } else {
        console.log('Profile loaded successfully:', data);
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      setError('Failed to load user profile');
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Attempting login for:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      if (error) {
        console.error('Login error:', error);
        setError(error.message);
        throw error;
      }
      
      console.log('Login successful, user data:', data);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, userData = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await auth.signUp(email, password, {
        full_name: userData.displayName || userData.fullName || '',
        ...userData
      });
      
      if (error) {
        setError(error.message);
        throw error;
      }
      
      // Note: User will need to confirm email before they can sign in
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Starting logout process...');
      setError(null);

      // Clear local state immediately
      setUser(null);
      setProfile(null);
      setRoleStatus(null);
      
      // Clear ALL authentication data thoroughly
      await clearAllAuthData();
      
      // Sign out from Supabase
      console.log('🔐 Signing out from Supabase...');
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.warn('⚠️ Supabase logout warning:', error.message);
      }
      
      // Additional cleanup for any remaining Supabase data
      clearSupabaseAuthStorage();
      
      console.log('✅ Logout complete, redirecting...');
      
      // Use replace to prevent back button issues
      window.location.replace('/');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      
      // Emergency cleanup - ensure logout happens even if there's an error
      setUser(null);
      setProfile(null);
      setRoleStatus(null);
      await clearAllAuthData();
      clearSupabaseAuthStorage();
      window.location.replace('/');
    }
  };

  const updateProfile = async (updates) => {
    const maxRetries = 3;
    let attempt = 0;
    
    const updateWithRetry = async () => {
      try {
        attempt++;
        console.log(`💾 Profile update attempt ${attempt}/${maxRetries}`);
        
        if (!user) throw new Error('No user logged in');
        
          // Don't block on pre-validation; supabase client auto-refreshes.
          // We'll handle JWT/session failures in the retry block below.
        
        setError(null);
        console.log('AuthContext: Updating profile for user:', user.id, 'with updates:', updates);
        
        // Use the correct API function with a client-side timeout safeguard
        const withTimeout = (p, ms = 15000) => {
          let t;
          const timeout = new Promise((_, rej) => {
            t = setTimeout(() => rej(new Error('Profile update timed out')), ms);
          });
          return Promise.race([p.finally(() => clearTimeout(t)), timeout]);
        };
        const result = await withTimeout(userApi.updateProfile(user.id, updates));

        // Accept both normalized shape { data } and raw row objects for backward compat
        const updated = result && Object.prototype.hasOwnProperty.call(result, 'data')
          ? result.data
          : result;

        if (!updated) {
          const err = new Error('Profile update returned no data');
          setError(err.message);
          throw err;
        }

        console.log('✅ Profile update successful:', updated);
        setProfile(updated);
        return updated;
        
      } catch (error) {
        console.error(`❌ Profile update attempt ${attempt} failed:`, error);
        
        // Retry on certain errors
        if (attempt < maxRetries && (
          error.message?.includes('JWT') ||
          error.message?.includes('session') ||
          error.message?.includes('expired') ||
          error.code === 'PGRST301'
        )) {
          console.log(`🔄 Retrying profile update in 2 seconds...`);
          // Attempt an explicit token refresh before retrying
          try {
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.warn('Token refresh before retry failed:', refreshError);
            } else {
              console.log('Token refreshed before retry');
            }
          } catch (e) {
            console.warn('Token refresh threw before retry:', e);
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
          return updateWithRetry();
        }
        
        setError(error.message || 'Failed to update profile');
        throw error;
      }
    };
    
    // Chain updates so they execute sequentially
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(() => updateWithRetry());
    return saveQueueRef.current;
  };

  const resetPassword = async (email) => {
    try {
      setError(null);
      const { error } = await auth.resetPassword(email);
      
      if (error) {
        setError(error.message);
        throw error;
      }
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const clearError = () => {
    setError(null);
  };

  // Helper to get full user data (auth + profile + role)
  const getCurrentUser = () => {
     // If there's no authenticated user at all, return null
    if (!user) return null;

    // If profile hasn't loaded yet, return basic auth user with metadata so auth-dependent
    // components (like navigation) can proceed while profile loads
    if (!profile) {
      const fallbackUser = {
        ...user,
        // Use metadata from sign-up if profile isn't loaded yet
        full_name: user.user_metadata?.full_name || '',
        username: user.user_metadata?.username || null,
        role: user.user_metadata?.role || 'investor',
        displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
      };
      return fallbackUser;
    }

    // Merge auth user, profile data, and role status once all are available
    const merged = {
      ...user,
      ...profile,
      // Keep some auth-specific fields
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      // Phase 3 role system
      roleStatus,
      // Legacy compatibility
      displayName: profile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
    };

    // Ensure we expose a normalized app role consistently across the app
    const appRole = roleStatus?.role || profile?.role || user.user_metadata?.role || 'investor';
    merged.appRole = appRole;
    // Backward-compat: many places use user.role; override Supabase's 'authenticated'
    merged.role = appRole;

    return merged;
  };

  // Helper to determine if user needs role selection - memoized to prevent infinite re-renders
  const needsRoleSelection = useMemo(() => {
    if (!user) {
      return false;
    }
    if (!roleStatus) {
      return false;
    }
    // Both investor and creator are valid end-states; only require selection if role is missing/unknown
    const validRoles = ['investor', 'creator', 'admin'];
    return !(roleStatus.role && validRoles.includes(roleStatus.role));
  }, [user, roleStatus]);

  // Helper to determine if user needs KYC - memoized to prevent infinite re-renders
  const needsKYC = useMemo(() => {
    if (!user) {
      return false;
    }
    if (!roleStatus) {
      return false;
    }
    if (roleStatus.role !== 'creator') {
      return false;
    }
    // User doesn't need KYC if they have already submitted verification or have company data
    const result = !roleStatus.companyData && !roleStatus.hasKycVerification;
    return result;
  }, [user, roleStatus]);

  // Helper to determine if user is fully onboarded - memoized to prevent infinite re-renders
  const isFullyOnboarded = useMemo(() => {
    if (!user) {
      return false;
    }
    if (!roleStatus) {
      return false;
    }
    if (!roleStatus.hasRole) {
      return false;
    }

    if (roleStatus.role === 'creator') {
      const result = !!roleStatus.companyData;
      return result;
    }

    return true;
  }, [user, roleStatus]);

  // Helper to determine if user needs profile completion - memoized to prevent infinite re-renders
  const needsProfileCompletion = useMemo(() => {
    if (!user) {
      return false;
    }
    if (!profile) {
      // If profile is still loading, don't force redirect
      return false;
    }

    const requiredFields = ['full_name', 'username'];
    const result = requiredFields.some((field) => {
      const value = profile?.[field];
      if (typeof value === 'string') {
        return value.trim() === '';
      }
      return !value;
    });
    return result;
  }, [user, profile]);

  const value = {
    user: getCurrentUser(),
    profile,
    roleStatus,
    sessionVersion,
    login,
    register,
    logout,
    updateProfile,
    resetPassword,
    loading,
    error,
    clearError,
    // Helper methods
    isAuthenticated: !!user,
    isEmailConfirmed: !!user?.email_confirmed_at,
    needsProfileCompletion,
    // Phase 3 onboarding helpers
    needsRoleSelection,
    needsKYC,
    isFullyOnboarded,
    validateSession, // Add session validation
    // Refresh role status after role selection or KYC
    refreshRoleStatus: async () => {
      try {
        console.log('Refreshing role status...');
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          console.log('Current user found, loading role status for:', currentUser.id);
          const status = await loadUserRoleStatus(currentUser.id);
          console.log('Role status refreshed successfully');
          return status;
        }

        console.warn('No current user found during refresh');
        setRoleStatus(defaultRoleStatus);
        return defaultRoleStatus;
      } catch (error) {
        console.error('Error refreshing role status:', error);
        const fallbackStatus = {
          ...defaultRoleStatus,
          success: false,
          error: error.message
        };
        setRoleStatus(fallbackStatus);
        return fallbackStatus;
      }
    },
    updateRoleStatus: (updates) => {
      setRoleStatus(prev => ({
        ...(prev || defaultRoleStatus),
        ...updates
      }));
    },
    // Refresh user data (profile and role status)
    refreshUserData: async () => {
      try {
        console.log('Refreshing user data...');
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          console.log('Current user found, refreshing data for:', currentUser.id);
          
          // Refresh profile
          await loadUserProfile(currentUser.id, currentUser);
          
          // Refresh role status
          await loadUserRoleStatus(currentUser.id);
          
          console.log('User data refreshed successfully');
          return true;
        }

        console.warn('No current user found during refresh');
        return false;
      } catch (error) {
        console.error('Error refreshing user data:', error);
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};