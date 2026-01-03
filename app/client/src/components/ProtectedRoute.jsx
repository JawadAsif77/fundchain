import React, { useRef, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import Loader from './Loader';

const ProtectedRoute = ({ 
  children, 
  requireEmailConfirmed = false,
  requireRole = false,
  requireKYC = false 
}) => {
  const {
    user,
    loading,
    isAuthenticated,
    isEmailConfirmed,
    needsProfileCompletion,
    needsRoleSelection,
    needsKYC,
    roleStatus
  } = useAuth();

  const location = useLocation();
  const lastRedirectRef = useRef(null);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const mountTimeRef = useRef(Date.now());

  const debug = process.env.NODE_ENV === 'development';

  // Prevent rapid redirects to same path
  const shouldRedirect = (path) => {
    const now = Date.now();
    
    // Don't redirect if we just mounted (within 500ms)
    if (now - mountTimeRef.current < 500) {
      if (debug) console.log(`ProtectedRoute: Too soon after mount, waiting...`);
      return false;
    }
    
    if (lastRedirectRef.current?.path === path && 
        (now - lastRedirectRef.current.timestamp) < 2000) {
      if (debug) console.warn(`ProtectedRoute: Preventing rapid redirect to ${path}`);
      return false;
    }
    
    lastRedirectRef.current = { path, timestamp: now };
    return true;
  };

  // Wait for auth to complete with timeout protection
  useEffect(() => {
    if (!loading) {
      // Small delay to ensure state is stable
      const timer = setTimeout(() => {
        setAuthCheckComplete(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Reset check if loading starts again
      setAuthCheckComplete(false);
    }
  }, [loading]);

  // CRITICAL: Show loading while auth is initializing
  if (loading || !authCheckComplete) {
    return (
      <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>
        <Loader message="Loading..." />
      </div>
    );
  }

  const currentPath = location.pathname;

  // Get memoized values to prevent function call loops
  const needsProfileCompletionValue = typeof needsProfileCompletion === 'function' 
    ? needsProfileCompletion() 
    : needsProfileCompletion;
  const needsRoleSelectionValue = typeof needsRoleSelection === 'function' 
    ? needsRoleSelection() 
    : needsRoleSelection;
  const needsKYCValue = typeof needsKYC === 'function' 
    ? needsKYC() 
    : needsKYC;

  // 1. Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. PRIORITY: Role Selection - User has no role (Google OAuth)
  // They MUST select a role before doing anything else
  if (needsRoleSelectionValue) {
    // If already on role selection page, let them stay
    if (currentPath === '/role-selection') {
      return children;
    }
    // Otherwise, redirect to role selection
    return <Navigate to="/role-selection" replace />;
  }

  // 3. Profile Completion (after role is selected)
  if (needsProfileCompletionValue && currentPath !== '/profile' && currentPath !== '/profile-edit') {
    if (shouldRedirect('/profile')) {
      return <Navigate to="/profile" state={{ message: 'Please complete your profile.' }} replace />;
    }
  }

  // 4. KYC Check (only for creators) - Only redirect if they're on campaign creation
  // Dashboard is always accessible with warnings
  if (needsKYCValue && (currentPath === '/create-project' || currentPath.startsWith('/campaign/'))) {
    return <Navigate to="/kyc" state={{ message: 'Please complete KYC verification to create campaigns.' }} replace />;
  }

  // All checks passed - allow access
  return children;
};

export default ProtectedRoute;