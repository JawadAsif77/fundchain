import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';

const Login = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Get the intended destination, default to dashboard
  const from = location.state?.from?.pathname || '/dashboard';

  const handleAuthSuccess = () => {
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