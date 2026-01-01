import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';

const Login = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const { isAuthenticated, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && profile) {
      // Check if user has selected a role
      if (!profile.role) {
        // No role - redirect to role selection
        navigate('/role-selection', { replace: true });
      } else {
        // Has role - redirect to dashboard or original destination
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }
    }
  }, [isAuthenticated, profile, loading, navigate, location]);

  const handleAuthSuccess = () => {
    const from = location.state?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  const handleSwitchToRegister = () => {
    setIsLoginMode(false);
  };

  const handleSwitchToLogin = () => {
    setIsLoginMode(true);
  };

  return (
    <div className="login-page">
      {isLoginMode ? (
        <LoginForm 
          onSwitchToRegister={handleSwitchToRegister}
          onClose={handleAuthSuccess}
        />
      ) : (
        <RegisterForm 
          onSwitchToLogin={handleSwitchToLogin}
          onClose={handleAuthSuccess}
        />
      )}
    </div>
  );
};

export default Login;