import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { supabase } from '../lib/supabase';

const Register = () => {
  const [step, setStep] = useState('role'); // 'role' or 'form'
  const [selectedRole, setSelectedRole] = useState('');
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
  const registrationRoleRef = useRef(null);
  const navigate = useNavigate();
  const { profile, loading } = useAuth();

  const handleRoleSelection = (role) => {
    setSelectedRole(role);
    setStep('form');
  };

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

  if (!selectedRole) {
    setError('Please select a role');
    return;
  }

  setIsSubmitting(true);
  setStatusMessage('Creating your account...');
  setError('');

  try {
    console.log("[Register] Starting registration...", {
      email: formData.email,
      username: formData.username,
      role: selectedRole,
    });

    // STEP 1 — Create auth user with metadata
    // AuthContext will automatically create the profile when SIGNED_IN event fires
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          username: formData.username,
          role: selectedRole,
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
          message: "Please check your email and click the confirmation link to complete your registration.",
        },
      });
      return;
    }

    // STEP 2 — Wait for AuthContext to create profile and load data
    console.log("[Register] Waiting for profile to be created by AuthContext...");
    setStatusMessage("Setting up your account...");
    
    // Store the role for the redirect logic
    registrationRoleRef.current = selectedRole;
    setWaitingForProfile(true);
    
    // Note: The useEffect below will handle navigation once profile is loaded

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
      console.log("[Register] Profile loaded, navigating...");
      const role = registrationRoleRef.current;
      
      if (role === "creator") {
        navigate("/kyc", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
      
      // Reset states
      setWaitingForProfile(false);
      setIsSubmitting(false);
      registrationRoleRef.current = null;
    }
  }, [waitingForProfile, loading, profile, navigate]);

  const handleBackToRole = () => {
    setStep('role');
    setSelectedRole('');
  };

  // Role selection step
  if (step === 'role') {
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
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <h2 style={{ 
            marginBottom: '20px', 
            color: '#333',
            fontSize: '2rem'
          }}>
            🚀 Join FundChain
          </h2>
          
          <p style={{ 
            marginBottom: '40px', 
            color: '#666',
            fontSize: '1.1rem'
          }}>
            How do you want to use FundChain?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <button
              onClick={() => handleRoleSelection('investor')}
              style={{
                padding: '20px',
                backgroundColor: '#f8fffe',
                border: '2px solid #29C7AC',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontSize: '1.1rem'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#29C7AC';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#f8fffe';
                e.target.style.color = 'inherit';
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                💰 I am an Investor
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                I want to discover and invest in exciting projects
              </div>
            </button>

            <button
              onClick={() => handleRoleSelection('creator')}
              style={{
                padding: '20px',
                backgroundColor: '#f8fffe',
                border: '2px solid #29C7AC',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontSize: '1.1rem'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#29C7AC';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#f8fffe';
                e.target.style.color = 'inherit';
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                🏗️ I am a Creator
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                I want to raise funds for my project or business
              </div>
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '30px' }}>
            <p style={{ margin: '0' }}>
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#29C7AC',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: 'inherit'
                }}
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Registration form step
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
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <button
            onClick={handleBackToRole}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            ←
          </button>
          <h2 style={{ 
            margin: '0',
            color: '#333',
            fontSize: '1.8rem'
          }}>
            {selectedRole === 'creator' ? '🏗️ Creator' : '💰 Investor'} Account
          </h2>
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
            {isSubmitting ? 'Creating Account...' : `Create ${selectedRole === 'creator' ? 'Creator' : 'Investor'} Account`}
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