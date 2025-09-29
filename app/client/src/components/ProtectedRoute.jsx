import React from 'react';
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
    needsRoleSelection,
    needsKYC,
    isFullyOnboarded,
    roleStatus
  } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader />;
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Email not confirmed - redirect to login with message
  if (requireEmailConfirmed && !isEmailConfirmed) {
    return <Navigate to="/login" state={{ 
      from: location,
      message: "Please confirm your email before continuing." 
    }} replace />;
  }

  // Handle onboarding flow redirects
  const currentPath = location.pathname;
  
  // If user needs KYC and not on KYC page
  if (needsKYC() && currentPath !== '/kyc') {
    return <Navigate to="/kyc" replace />;
  }
  
  // If route requires role but user doesn't have one, redirect to profile
  if (requireRole && needsRoleSelection()) {
    return <Navigate to="/profile" state={{ 
      message: "Please complete your profile setup." 
    }} replace />;
  }
  
  // If route requires specific role but user has different role
  if (typeof requireRole === 'string' && roleStatus?.role !== requireRole) {
    return <Navigate to="/dashboard" state={{ 
      message: `This page is only accessible to ${requireRole}s.` 
    }} replace />;
  }
  
  // If route requires KYC but user isn't verified
  if (requireKYC && needsKYC()) {
    return <Navigate to="/kyc" replace />;
  }

  return children;
};

export default ProtectedRoute;