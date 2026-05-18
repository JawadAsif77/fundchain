import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import Loader from './Loader';

const ProtectedRoute = ({
  children,
  requireEmailConfirmed = false,
  // Pass a role string (e.g. "admin") to enforce role-based access at the route level.
  // NOTE: this is UI-level protection only. Real enforcement is in RLS + Edge Functions.
  requireRole = null,
  requireKYC = false
}) => {
  const {
    user,
    profile,
    loading,
    isAuthenticated,
    isEmailConfirmed,
    needsProfileCompletion,
    needsRoleSelection,
    needsKYC,
    roleStatus
  } = useAuth();

  const location = useLocation();

  // Show loading while auth is initializing
  if (loading) {
    return (
      <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>
        <Loader message="Loading..." />
      </div>
    );
  }

  const currentPath = location.pathname;

  const needsProfileCompletionValue = typeof needsProfileCompletion === 'function'
    ? needsProfileCompletion()
    : needsProfileCompletion;
  const needsRoleSelectionValue = typeof needsRoleSelection === 'function'
    ? needsRoleSelection()
    : needsRoleSelection;
  const needsKYCValue = typeof needsKYC === 'function'
    ? needsKYC()
    : needsKYC;

  // 1. Not authenticated — redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 1.5. Email confirmation required
  if (requireEmailConfirmed && !isEmailConfirmed) {
    return (
      <Navigate
        to="/login"
        state={{ from: location, message: 'Please verify your email to continue.' }}
        replace
      />
    );
  }

  // 2. Role-based access control (UI layer — real enforcement is server-side)
  if (requireRole) {
    const userRole = profile?.role || roleStatus?.role;
    if (userRole !== requireRole) {
      // Non-admin users are silently redirected, not shown an error page
      return <Navigate to="/" replace />;
    }
  }

  // 3. Role Selection — user has no role yet
  if (needsRoleSelectionValue) {
    if (currentPath === '/role-selection') return children;
    return <Navigate to="/role-selection" replace />;
  }

  // 4. Profile Completion
  if (needsProfileCompletionValue && currentPath !== '/profile' && currentPath !== '/profile-edit') {
    return <Navigate to="/profile" state={{ message: 'Please complete your profile.' }} replace />;
  }

  // 5. KYC Check (creators only, on campaign-related pages)
  if (needsKYCValue && (currentPath === '/create-project' || currentPath.startsWith('/campaign/'))) {
    return <Navigate to="/kyc" state={{ message: 'Please complete KYC verification to create campaigns.' }} replace />;
  }

  return children;
};

export default ProtectedRoute;