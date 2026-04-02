import React from 'react';
import { useNavigate } from 'react-router-dom';
import RegisterForm from '../components/auth/RegisterForm';

const Register = () => {
  const navigate = useNavigate();

  return (
    <div className="register-page">
      <RegisterForm
        onSwitchToLogin={() => navigate('/login', { replace: true })}
        onClose={() => navigate('/dashboard', { replace: true })}
      />
    </div>
  );
};

export default Register;
