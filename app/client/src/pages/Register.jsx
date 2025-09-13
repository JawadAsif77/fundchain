import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RegisterForm from '../components/auth/RegisterForm';
import LoginForm from '../components/auth/LoginForm';

const Register = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(true);
  const navigate = useNavigate();

  const handleAuthSuccess = () => {
    navigate('/dashboard', { replace: true });
  };

  const handleSwitchToLogin = () => {
    setIsRegisterMode(false);
  };

  const handleSwitchToRegister = () => {
    setIsRegisterMode(true);
  };

  return (
    <div className="register-page">
      {isRegisterMode ? (
        <RegisterForm 
          onSwitchToLogin={handleSwitchToLogin}
          onClose={handleAuthSuccess}
        />
      ) : (
        <LoginForm 
          onSwitchToRegister={handleSwitchToRegister}
          onClose={handleAuthSuccess}
        />
      )}
    </div>
  );
};

