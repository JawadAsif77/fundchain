import React, { useRef } from 'react';
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
    isFullyOnboarded,
    roleStatus
  } = useAuth();
  const location = useLocation();
  const lastRedirectRef = useRef(null);

  // Prevent rapid redirects to same path
  const shouldRedirect = (path) => {
    const now = Date.now();
    if (lastRedirectRef.current?.path === path && 
        (now - lastRedirectRef.current.timestamp) < 2000) {
      console.warn(`ProtectedRoute: Preventing rapid redirect to ${path}`);
      return false;
    }
    lastRedirectRef.current = { path, timestamp: now };
    return true;
  };

  // Show loading only for a reasonable time
  // If auth is established but profile/role are still loading, don't block navigation aggressively
  if (loading || (isAuthenticated && (!user || !user.id))) {
    return (
      <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    if (shouldRedirect('/login')) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return <Loader message="Authenticating..." />;
  }

  // Email not confirmed - redirect to login with message
  if (requireEmailConfirmed && !isEmailConfirmed) {
    if (shouldRedirect('/login')) {
      return <Navigate to="/login" state={{ 
        from: location,
        message: "Please confirm your email before continuing." 
      }} replace />;
    }
    return <Loader message="Checking email confirmation..." />;
  }

  // Handle onboarding flow redirects with loop prevention
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

  // Force profile completion before accessing other protected areas (creators often need more info; investors can proceed with minimal profile)
  if (needsProfileCompletionValue && currentPath !== '/profile' && currentPath !== '/profile-edit') {
    if (shouldRedirect('/profile')) {
      return <Navigate to="/profile" state={{ message: 'Please complete your profile to continue.' }} replace />;
    }
    return <Loader message="Redirecting to profile..." />;
  }

  // If user needs role selection and not on profile page
  if (needsRoleSelectionValue && currentPath !== '/profile' && currentPath !== '/profile-edit') {
    if (shouldRedirect('/profile')) {
      return <Navigate to="/profile" state={{ 
        message: "Please complete your profile setup." 
      }} replace />;
    }
    return <Loader message="Redirecting to profile setup..." />;
  }

  // If user needs KYC and not on KYC page (only applies to creators)
  if (needsKYCValue && currentPath !== '/kyc' && currentPath !== '/dashboard' && currentPath !== '/profile') {
    if (shouldRedirect('/kyc')) {
      return <Navigate to="/kyc" replace />;
    }
    return <Loader message="Redirecting to verification..." />;
  }
  
  // If route requires specific role but user has different role
  if (typeof requireRole === 'string' && roleStatus?.role !== requireRole) {
    if (shouldRedirect('/dashboard')) {
      return <Navigate to="/dashboard" state={{ 
        message: `This page is only accessible to ${requireRole}s.` 
      }} replace />;
    }
    return <Loader message="Checking permissions..." />;
  }
  
  // If route requires KYC but user isn't verified (strict check for certain routes)
  if (requireKYC && needsKYCValue && currentPath !== '/dashboard' && currentPath !== '/kyc') {
    if (shouldRedirect('/kyc')) {
      return <Navigate to="/kyc" replace />;
    }
    return <Loader message="Verification required..." />;
  }

  return children;
};

export default ProtectedRoute;