import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import Loader from './Loader';

/**
 * PublicRoute - For pages that should only be accessible when NOT logged in
 * Redirects authenticated users to dashboard
 * Used for Login and Register pages
 */
const PublicRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Show loading while auth is initializing
  if (loading) {
    return (
      <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>
        <Loader message="Loading..." />
      </div>
    );
  }

  // If user is authenticated, redirect to dashboard
  if (isAuthenticated && user) {
    // Check if there's a redirect path from previous navigation
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  // Not authenticated - allow access to public auth pages
  return children;
};

export default PublicRoute;
