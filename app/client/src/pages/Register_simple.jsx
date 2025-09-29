import React, { useState } from 'react';
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
  const navigate = useNavigate();

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
      console.log('Starting registration process...', { 
        email: formData.email, 
        username: formData.username, 
        role: selectedRole 
      });
      
      // Step 1: Create auth user
      console.log('Step 1: Creating auth user...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            username: formData.username,
            role: selectedRole
          }
        }
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        throw authError;
      }

      console.log('Step 1 Complete: Auth user created:', authData.user?.id);

      if (!authData.user) {
        throw new Error('No user returned from signup');
      }

      // Step 2: Create profile immediately using RPC function
      console.log('Step 2: Creating profile via RPC function...');
      
      try {
        const { data: profileData, error: profileError } = await supabase
          .rpc('create_user_profile', {
            user_id: authData.user.id,
            user_email: formData.email,
            user_username: formData.username,
            user_full_name: formData.fullName,
            user_role: selectedRole,
            user_verified: 'no'
          });

        console.log('RPC Response Details:', { 
          profileData, 
          profileError,
          userId: authData.user.id,
          email: formData.email,
          username: formData.username,
          role: selectedRole
        });

        if (profileError) {
          console.error('RPC Profile creation failed:', profileError);
          
          // Try fallback method - direct insert
          console.log('Trying fallback: direct insert...');
          const { data: insertData, error: insertError } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              email: formData.email,
              username: formData.username,
              full_name: formData.fullName,
              role: selectedRole,
              is_verified: 'no'
            })
            .select();

          if (insertError) {
            console.error('Direct insert also failed:', insertError);
            console.log('Profile creation failed, but continuing with registration...');
            setStatusMessage('Account created! Profile will be completed on first login.');
          } else {
            console.log('Profile created via direct insert:', insertData);
            setStatusMessage('Account created successfully!');
          }
        } else if (profileData?.error) {
          console.error('RPC returned error:', profileData);
          console.log('RPC error occurred, but continuing with registration...');
          setStatusMessage('Account created! Profile will be completed on first login.');
        } else {
          console.log('Step 2 Complete: Profile created successfully via RPC!', profileData);
          setStatusMessage('Account created successfully!');
        }
      } catch (profileErr) {
        console.error('Profile creation attempt failed:', profileErr);
        console.log('Continuing with registration despite profile creation failure...');
        setStatusMessage('Account created! Profile will be completed on first login.');
      }

      // Step 3: Handle navigation - ALWAYS navigate regardless of profile creation success
      console.log('Step 3: Handling navigation...');
      
      if (authData.session) {
        // Route to profile page for profile completion
        console.log('Session available, redirecting to profile page in 2 seconds...');
        setStatusMessage(prev => prev + ' Redirecting to profile setup...');
        setTimeout(() => {
          console.log('Executing navigation to profile...');
          navigate('/profile', { replace: true });
        }, 2000);
      } else {
        console.log('No session - email confirmation required, redirecting to login...');
        setStatusMessage('Please check your email to confirm your account.');
        setTimeout(() => {
          console.log('Executing navigation to login...');
          navigate('/login', {
            replace: true,
            state: {
              message: 'Please check your email and click the confirmation link to complete your registration.'
            }
          });
        }, 2000);
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'An error occurred during registration');
      setStatusMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToRole = () => {
    setStep('role');
    setSelectedRole('');
  };

  // Role selection step
  if (step === 'role') {
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