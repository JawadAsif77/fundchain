import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../lib/supabase.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial session and set up auth listener
  useEffect(() => {
    let mounted = true;

    const getInitialSession = async () => {
      try {
        const { session, error } = await auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setError(error.message);
        } else if (session?.user && mounted) {
          setUser(session.user);
          await loadUserProfile(session.user.id, session.user);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
        setError(error.message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      setError(null);
      
      if (session?.user) {
        setUser(session.user);
        await loadUserProfile(session.user.id, session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

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
          const newProfile = {
            id: userId,
            email: sessionUser?.email || '',
            full_name: sessionUser?.user_metadata?.full_name || '',
            avatar_url: sessionUser?.user_metadata?.avatar_url || null
          };
          
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
      
      const { data, error } = await auth.signIn(email, password);
      
      if (error) {
        setError(error.message);
        throw error;
      }
      
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
      setError(null);
      const { error } = await auth.signOut();
      
      if (error) {
        setError(error.message);
        throw error;
      }
      
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
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

  // Helper to get full user data (auth + profile)
  const getCurrentUser = () => {
    if (!user || !profile) return null;
    
    return {
      ...user,
      ...profile,
      // Keep some auth-specific fields
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      // Legacy compatibility
      displayName: profile.full_name,
      role: profile.is_accredited_investor ? 'accredited_investor' : 'investor'
    };
  };

  const value = {
    user: getCurrentUser(),
    profile,
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
    isEmailConfirmed: !!user?.email_confirmed_at
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};