import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

const Login = () => {
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState(location?.state?.message || '');
  const { login, error, user, roleStatus, profile } = useAuth();
  const navigate = useNavigate();

  // Effect to handle navigation after user is set
  useEffect(() => {
    if (user && isSubmitting) {
      console.log('User is now authenticated:', user.id);
      
      // Give some time for roleStatus to load, but don't wait indefinitely
      const navigationTimeout = setTimeout(() => {
        if (roleStatus && roleStatus.hasRole && roleStatus.role) {
          // Check if user has basic profile info (don't require full profile completion)
          const hasBasicProfile = profile?.full_name && profile?.username;
          
          if (!hasBasicProfile) {
            console.log('Basic profile incomplete, redirecting to profile page...');
            navigate('/profile');
          } else {
            // Route based on user role to their appropriate DEFAULT page
            if (roleStatus.role === 'creator') {
              console.log('Redirecting creator to dashboard...');
              navigate('/dashboard');
            } else if (roleStatus.role === 'investor') {
              console.log('Redirecting investor to explore (default page)...');
              navigate('/explore');  // Investors go to explore by default
            } else if (roleStatus.role === 'admin') {
              console.log('Redirecting admin to admin panel...');
              navigate('/admin');
            } else {
              console.log('Unknown role, redirecting to explore...');
              navigate('/explore');
            }
          }
        } else {
          // User doesn't have a role yet, redirect to profile for role selection
          console.log('No role selected, redirecting to profile for role selection...');
          navigate('/profile');
        }
      }, 2000); // Wait 2 seconds for roleStatus to load

      // Clean up timeout if component unmounts
      return () => clearTimeout(navigationTimeout);
    }
  }, [user, isSubmitting, navigate, roleStatus, profile]);

  useEffect(() => {
    if (location?.state?.message) {
      setInfoMessage(location.state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      alert('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Attempting login with:', formData.email);
      const result = await login(formData.email, formData.password);
      console.log('Login successful, result:', result);
      console.log('Waiting for user state to update...');
      // Navigation will be handled by useEffect when user state updates
    } catch (err) {
      console.error('Login error:', err);
      alert(`Login failed: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #29C7AC, #0B132B)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '40px', 
        borderRadius: '12px', 
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h2 style={{ 
          textAlign: 'center', 
          marginBottom: '10px', 
          color: '#333',
          fontSize: '2rem'
        }}>
          Welcome Back
        </h2>
        
        <p style={{ 
          textAlign: 'center', 
          color: '#666', 
          marginBottom: '30px' 
        }}>
          Sign in to your account
        </p>

        {(infoMessage || error) && (
          <div style={{
            backgroundColor: error ? '#fee' : '#f0fdf4',
            color: error ? '#c33' : '#047857',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            border: error ? '1px solid #fcc' : '1px solid #bbf7d0'
          }}>
            {error || infoMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Email Address:
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="Enter your email"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Password:
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              placeholder="Enter your password"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#29C7AC',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <p style={{ margin: '0' }}>
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/register')}
              style={{
                background: 'none',
                border: 'none',
                color: '#29C7AC',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: 'inherit'
              }}
            >
              Sign Up
            </button>
          </p>
        </div>

        {/* Debug info */}
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: '#f9f9f9', 
          borderRadius: '4px',
          fontSize: '0.8rem',
          color: '#666'
        }}>
          <strong>Debug:</strong> Ready to test login with your registered accounts
        </div>
      </div>
    </div>
  );
};

export default Login;