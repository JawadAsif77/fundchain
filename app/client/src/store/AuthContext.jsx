import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, supabase } from '../lib/supabase.js';
import { getUserRoleStatus } from '../lib/api.js';

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

export const AuthProvider = ({ children }) => {
  console.log('AuthProvider initializing...');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roleStatus, setRoleStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (mounted) {
        console.log('AuthContext: Loading timeout reached, forcing loading to false');
        setLoading(false);
      }
    }, 8000); // 8 second timeout

    getInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthContext: Auth state change event:', event);
      if (!mounted) return;

      setError(null);
      
      if (session?.user) {
        console.log('AuthContext: Setting user from auth change:', session.user.id);
        setUser(session.user);
        
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
          
          const { data: createdProfile, error: createError } = await db.users.createProfile(newProfile);
          
          if (createError) {
            console.error('Error creating profile:', createError);
            setError('Failed to create user profile');
          } else {
            console.log('Profile created successfully:', createdProfile);
            setProfile(createdProfile);
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
      console.log('Logging out user...');
      setError(null);
      
      // Clear local state immediately
      setUser(null);
      setProfile(null);
      setRoleStatus(null);
      
      // Clear any stored data
      localStorage.removeItem('pendingUserProfile');
      localStorage.removeItem('fundchain-theme'); // Optional: reset theme
      
      // Attempt to sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.warn('Supabase logout error (but continuing with logout):', error);
        // Don't throw here, we still want to redirect
      }
      
      // Force redirect to home page after logout (always execute)
      console.log('Redirecting to home page...');
      window.location.href = '/';
      
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, clear state and redirect
      setUser(null);
      setProfile(null);
      setRoleStatus(null);
      localStorage.removeItem('pendingUserProfile');
      window.location.href = '/';
    }
  };

  const updateProfile = async (updates) => {
    try {
      if (!user) throw new Error('No user logged in');
      
      setError(null);
      const { data, error } = await db.users.updateProfile(user.id, updates);
      
      if (error) {
        setError(error.message);
        throw error;
      }
      
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
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

    // If profile hasn't loaded yet, return basic auth user so auth-dependent
    // components (like navigation) can proceed while profile loads
    if (!profile) return user;

    // Merge auth user, profile data, and role status once all are available
    return {
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
      displayName: profile.full_name,
      role: profile.is_accredited_investor ? 'accredited_investor' : 'investor'
    };
  };

  // Helper to determine if user needs role selection
  const needsRoleSelection = () => {
    if (!user) {
      console.log('needsRoleSelection: No user');
      return false;
    }
    if (!roleStatus) {
      console.log('needsRoleSelection: Role status not yet loaded');
      return false;
    }
    const result = roleStatus.hasRole === false;
    console.log('needsRoleSelection result:', result, 'roleStatus:', roleStatus);
    return result;
  };

  // Helper to validate current session
  const validateSession = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.log('Session validation failed, clearing state');
        setUser(null);
        setProfile(null);
        setRoleStatus(null);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error validating session:', error);
      setUser(null);
      setProfile(null);
      setRoleStatus(null);
      return false;
    }
  };

  // Helper to determine if user needs KYC
  const needsKYC = () => {
    if (!user) {
      console.log('needsKYC: No user');
      return false;
    }
    if (!roleStatus) {
      console.log('needsKYC: Role status not yet loaded');
      return false;
    }
    if (roleStatus.role !== 'creator') {
      console.log('needsKYC: User is not a creator');
      return false;
    }
    const result = !roleStatus.companyData;
    console.log('needsKYC result:', result, 'roleStatus:', roleStatus);
    return result;
  };

  // Helper to determine if user is fully onboarded
  const isFullyOnboarded = () => {
    if (!user) {
      console.log('isFullyOnboarded: No user');
      return false;
    }
    if (!roleStatus) {
      console.log('isFullyOnboarded: Role status not yet loaded');
      return false;
    }
    if (!roleStatus.hasRole) {
      console.log('isFullyOnboarded: User has no role');
      return false;
    }

    if (roleStatus.role === 'creator') {
      const result = !!roleStatus.companyData;
      console.log('isFullyOnboarded (creator) result:', result, 'roleStatus:', roleStatus);
      return result;
    }

    const result = true;
    console.log('isFullyOnboarded result:', result, 'roleStatus:', roleStatus);
    return result;
  };

  const value = {
    user: getCurrentUser(),
    profile,
    roleStatus,
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
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};