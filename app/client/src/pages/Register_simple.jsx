import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { supabase } from '../lib/supabase';

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [waitingForProfile, setWaitingForProfile] = useState(false);
  const navigate = useNavigate();
  const { profile, loading } = useAuth();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

const handleSubmit = async (e) => {
  e.preventDefault();

  if (formData.password !== formData.confirmPassword) {
    setError('Passwords do not match');
    return;
  }

  setIsSubmitting(true);
  setStatusMessage('Creating your account...');
  setError('');

  try {
    console.log("[Register] Starting registration...", {
      email: formData.email,
      username: formData.username,
    });

    // Create auth user with metadata (no role - will be NULL)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          username: formData.username,
          // No role - will be NULL, user selects it after confirmation
        }
      }
    });

    if (authError) {
      console.error("[Register] Auth signup error:", authError);
      throw authError;
    }

    const userId = authData.user?.id;
    console.log("[Register] Auth user created:", userId);

    if (!userId) throw new Error("No user returned from signup");

    // Check if email confirmation is required
    if (!authData.session) {
      console.log("[Register] Email confirmation required");
      navigate("/login", {
        replace: true,
        state: {
          message: "Please check your email and click the confirmation link. After confirming, you'll choose your role to get started.",
        },
      });
      return;
    }

    // Wait for AuthContext to create profile and load data
    console.log("[Register] Waiting for profile to be created by AuthContext...");
    setStatusMessage("Setting up your account...");
    setWaitingForProfile(true);

  } catch (err) {
    console.error("[Register] Registration error:", err);
    setError(err.message || "An error occurred during registration");
    setStatusMessage("");
    setIsSubmitting(false);
  }
};

  // Handle navigation after profile is loaded
  useEffect(() => {
    if (waitingForProfile && !loading && profile) {
      console.log("[Register] Profile loaded with role:", profile.role);
      
      // Since role is NULL, ProtectedRoute will redirect to /role-selection
      // Just navigate to dashboard and let ProtectedRoute handle it
      navigate("/dashboard", { replace: true });
      
      setWaitingForProfile(false);
      setIsSubmitting(false);
    }
  }, [waitingForProfile, loading, profile, navigate]);

  // Registration form
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#ffffff', 
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
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ 
            margin: '0',
            color: '#333',
            fontSize: '1.8rem'
          }}>
            🚀 Create Account
          </h2>
          <p style={{ color: '#666', marginTop: '8px', fontSize: '0.95rem' }}>
            You'll choose your role after registration
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            border: '1px solid #fcc'
          }}>
            {error}
          </div>
        )}

        {statusMessage && !error && (
          <div style={{
            backgroundColor: '#f0fdf4',
            color: '#047857',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            border: '1px solid #bbf7d0'
          }}>
            {statusMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Full Name:
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              required
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
              Username:
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              required
              placeholder="Choose a unique username"
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
              Email:
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
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
              Confirm Password:
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
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
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
            By creating an account, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;