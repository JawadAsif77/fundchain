import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { selectRole } from '../lib/api.js';
import { useAuth } from '../store/AuthContext.jsx';

const SelectRole = () => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { roleStatus, refreshRoleStatus, updateRoleStatus } = useAuth();

  useEffect(() => {
    if (!roleStatus) return;

    if (roleStatus.hasRole) {
      setMessage('Redirecting you to the right place...');
      if (roleStatus.role === 'investor') {
        navigate('/dashboard', { replace: true, state: { onboarding: 'role-confirmed' } });
      } else if (roleStatus.role === 'creator') {
        if (roleStatus.companyData) {
          navigate('/dashboard', { replace: true, state: { onboarding: 'kyc-complete' } });
        } else {
          navigate('/kyc', { replace: true });
        }
      }
    }
  }, [roleStatus, navigate]);

  const handleRoleSelect = async (role) => {
    if (loading) return;

    console.log('Starting role selection for:', role);
    setLoading(true);
    setError('');
    setSelectedRole(role);
    setMessage(`Setting up your ${role} account...`);
    
    try {
      console.log('Calling selectRole API...');
      const result = await selectRole(role);
      console.log('selectRole result:', result);

      if (result.success) {
        console.log('Role selection successful');
        setMessage('Role selected! Setting up your dashboard...');

        // Refresh role status
        console.log('Refreshing role status...');
        const status = await refreshRoleStatus();
        console.log('Status refreshed successfully');

        if (status?.hasRole) {
          updateRoleStatus(status);
        } else {
          updateRoleStatus({
            hasRole: true,
            role,
            isKYCVerified: role === 'investor',
            companyData: null,
            success: true,
            kycStatus: role === 'investor' ? 'not_required' : 'not_started'
          });
        }
      } else {
        console.error('Role selection failed:', result.error);
        setError(result.error || 'Failed to select role');
        setSelectedRole(null);
      }
    } catch (err) {
      console.error('Role selection error:', err);
      setError('An unexpected error occurred: ' + err.message);
      setSelectedRole(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '48px 40px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        textAlign: 'center'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '8px'
          }}>
            Welcome to FundChain!
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#6b7280',
            lineHeight: '1.5'
          }}>
            Choose your role to get started with the platform
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '24px',
            color: '#dc2626',
            fontSize: '14px'
          }}>
            <div>{error}</div>
            <button 
              onClick={() => setError('')}
              style={{
                marginTop: '8px',
                padding: '4px 12px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {message && !error && (
          <div style={{
            marginBottom: '24px',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: '#eff6ff',
            color: '#1d4ed8',
            fontSize: '14px'
          }}>
            {message}
          </div>
        )}

        {/* Role Selection Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {/* Investor Card */}
          <div
            onClick={() => !loading && handleRoleSelect('investor')}
            style={{
              border: selectedRole === 'investor' ? '2px solid #3b82f6' : '2px solid #e5e7eb',
              borderRadius: '12px',
              padding: '24px 16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: selectedRole === 'investor' ? '#eff6ff' : '#ffffff',
              opacity: loading ? 0.7 : 1,
              ':hover': {
                borderColor: '#3b82f6',
                backgroundColor: '#f8fafc'
              }
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.backgroundColor = '#f8fafc';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.borderColor = selectedRole === 'investor' ? '#3b82f6' : '#e5e7eb';
                e.target.style.backgroundColor = selectedRole === 'investor' ? '#eff6ff' : '#ffffff';
              }
            }}
          >
            <div style={{
              fontSize: '48px',
              marginBottom: '12px'
            }}>
              💰
            </div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '8px'
            }}>
              Investor
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              Discover and invest in exciting projects and startups
            </p>
            <div style={{
              marginTop: '12px',
              fontSize: '12px',
              color: '#3b82f6',
              fontWeight: '500'
            }}>
              ✓ Browse projects
              <br />
              ✓ Build portfolio
              <br />
              ✓ Track investments
            </div>
          </div>

          {/* Creator Card */}
          <div
            onClick={() => !loading && handleRoleSelect('creator')}
            style={{
              border: selectedRole === 'creator' ? '2px solid #10b981' : '2px solid #e5e7eb',
              borderRadius: '12px',
              padding: '24px 16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: selectedRole === 'creator' ? '#ecfdf5' : '#ffffff',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.borderColor = '#10b981';
                e.target.style.backgroundColor = '#f0fdf4';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.borderColor = selectedRole === 'creator' ? '#10b981' : '#e5e7eb';
                e.target.style.backgroundColor = selectedRole === 'creator' ? '#ecfdf5' : '#ffffff';
              }
            }}
          >
            <div style={{
              fontSize: '48px',
              marginBottom: '12px'
            }}>
              🚀
            </div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '8px'
            }}>
              Creator (Business)
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              Launch your project and raise funds from investors
            </p>
            <div style={{
              marginTop: '12px',
              fontSize: '12px',
              color: '#10b981',
              fontWeight: '500'
            }}>
              ✓ Create projects
              <br />
              ✓ Manage campaigns
              <br />
              ✓ Connect with investors
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#6b7280',
            fontSize: '14px'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #e5e7eb',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            {selectedRole ? `Setting up ${selectedRole} account...` : 'Processing...'}
          </div>
        )}

        {/* Info Text */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#64748b',
          lineHeight: '1.4'
        }}>
          <strong>Note:</strong> Creators will need to complete business verification (KYC) before creating projects. 
          You can change your role later in account settings.
        </div>

        {/* CSS for spinner animation */}
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    </div>
  );
};

export default SelectRole;