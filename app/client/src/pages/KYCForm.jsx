import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitKYC } from '../lib/api.js';
import { useAuth } from '../store/AuthContext.jsx';

const KYCForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const navigate = useNavigate();
  const { roleStatus, refreshRoleStatus, updateRoleStatus } = useAuth();

  useEffect(() => {
    if (!roleStatus) return;

    if (roleStatus.role !== 'creator') {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (roleStatus.companyData) {
      const onboardingState = roleStatus.companyData.verified ? 'kyc-approved' : 'kyc-pending';
      setStatusMessage(
        roleStatus.companyData.verified
          ? 'Your business profile is verified. Redirecting to your dashboard...'
          : 'We already have your verification on file. Redirecting to your dashboard...'
      );
      navigate('/dashboard', { replace: true, state: { onboarding: onboardingState } });
    }
  }, [roleStatus, navigate]);

  // Form data state
  const [formData, setFormData] = useState({
    // Business Information
    companyName: '',
    registrationNumber: '',
    country: '',
    website: '',
    businessDescription: '',
    
    // Owner Information
    ownerName: '',
    ownerPosition: '',
    ownerEmail: '',
    ownerPhone: '',
    ownerExperience: '',
    
    // Team Information
    teamSize: '',
    keyMembers: [
      { name: '', role: '', experience: '' }
    ],
    
    // Documents (will be handled later)
    documents: {
      businessRegistration: null,
      idDocument: null,
      businessPlan: null,
      financialProjections: null
    }
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTeamMemberChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      keyMembers: prev.keyMembers.map((member, i) => 
        i === index ? { ...member, [field]: value } : member
      )
    }));
  };

  const addTeamMember = () => {
    if (formData.keyMembers.length < 5) {
      setFormData(prev => ({
        ...prev,
        keyMembers: [...prev.keyMembers, { name: '', role: '', experience: '' }]
      }));
    }
  };

  const removeTeamMember = (index) => {
    if (formData.keyMembers.length > 1) {
      setFormData(prev => ({
        ...prev,
        keyMembers: prev.keyMembers.filter((_, i) => i !== index)
      }));
    }
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1: // Business Information
        return formData.companyName && formData.country && formData.businessDescription;
      case 2: // Owner Information
        return formData.ownerName && formData.ownerPosition && formData.ownerEmail;
      case 3: // Team Information
        return formData.teamSize && formData.keyMembers.every(m => m.name && m.role);
      case 4: // Documents (optional for now)
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
      setError('');
    } else {
      setError('Please fill in all required fields');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError('');
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      setError('Please complete all required fields');
      return;
    }

    setLoading(true);
    setError('');
    setStatusMessage('Submitting your verification...');

    try {
      console.log('Submitting KYC form:', formData);

      const result = await submitKYC({
        companyName: formData.companyName,
        registrationNumber: formData.registrationNumber,
        country: formData.country,
        website: formData.website,
        businessDescription: formData.businessDescription,
        ownerInfo: {
          name: formData.ownerName,
          position: formData.ownerPosition,
          email: formData.ownerEmail,
          phone: formData.ownerPhone,
          experience: formData.ownerExperience
        },
        teamInfo: {
          size: formData.teamSize,
          keyMembers: formData.keyMembers
        }
      });

      if (result.success) {
        console.log('KYC submitted successfully');
        const status = await refreshRoleStatus();
        if (status?.role === 'creator') {
          updateRoleStatus(status);
        } else {
          updateRoleStatus({
            hasRole: true,
            role: 'creator',
            companyData: result.data,
            isKYCVerified: !!result.data?.verified,
            success: true,
            kycStatus: result.data?.verified ? 'approved' : 'pending'
          });
        }

        setStatusMessage('Verification submitted! Redirecting to your dashboard...');
        navigate('/dashboard', { replace: true, state: { onboarding: 'kyc-submitted' } });
      } else {
        setError(result.error || 'Failed to submit KYC form');
      }
    } catch (err) {
      console.error('KYC submission error:', err);
      setError('An unexpected error occurred');
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      marginBottom: '40px',
      gap: '16px'
    }}>
      {[1, 2, 3, 4].map(step => (
        <div
          key={step}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: step <= currentStep ? '#3b82f6' : '#e5e7eb',
            color: step <= currentStep ? 'white' : '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          {step}
        </div>
      ))}
    </div>
  );

  const renderBusinessInfo = () => (
    <div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>
        Business Information
      </h3>
      
      <div style={{ display: 'grid', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Company Name *
          </label>
          <input
            type="text"
            value={formData.companyName}
            onChange={(e) => handleInputChange('companyName', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="Your company name"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Registration Number
          </label>
          <input
            type="text"
            value={formData.registrationNumber}
            onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="Company registration number (optional)"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Country *
          </label>
          <select
            value={formData.country}
            onChange={(e) => handleInputChange('country', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="">Select country</option>
            <option value="US">United States</option>
            <option value="UK">United Kingdom</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="PK">Pakistan</option>
            <option value="IN">India</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Website
          </label>
          <input
            type="url"
            value={formData.website}
            onChange={(e) => handleInputChange('website', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="https://yourcompany.com"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Business Description *
          </label>
          <textarea
            value={formData.businessDescription}
            onChange={(e) => handleInputChange('businessDescription', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              minHeight: '100px',
              resize: 'vertical'
            }}
            placeholder="Describe your business and what you do..."
          />
        </div>
      </div>
    </div>
  );

  const renderOwnerInfo = () => (
    <div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>
        Owner Information
      </h3>
      
      <div style={{ display: 'grid', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Full Name *
          </label>
          <input
            type="text"
            value={formData.ownerName}
            onChange={(e) => handleInputChange('ownerName', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="Your full name"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Position/Title *
          </label>
          <input
            type="text"
            value={formData.ownerPosition}
            onChange={(e) => handleInputChange('ownerPosition', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="CEO, Founder, etc."
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Email Address *
          </label>
          <input
            type="email"
            value={formData.ownerEmail}
            onChange={(e) => handleInputChange('ownerEmail', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Phone Number
          </label>
          <input
            type="tel"
            value={formData.ownerPhone}
            onChange={(e) => handleInputChange('ownerPhone', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="+1 (555) 123-4567"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Experience & Background
          </label>
          <textarea
            value={formData.ownerExperience}
            onChange={(e) => handleInputChange('ownerExperience', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              minHeight: '80px',
              resize: 'vertical'
            }}
            placeholder="Describe your relevant experience and background..."
          />
        </div>
      </div>
    </div>
  );

  const renderTeamInfo = () => (
    <div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>
        Team Information
      </h3>
      
      <div style={{ display: 'grid', gap: '24px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Team Size *
          </label>
          <select
            value={formData.teamSize}
            onChange={(e) => handleInputChange('teamSize', e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="">Select team size</option>
            <option value="1">Just me (1 person)</option>
            <option value="2-5">Small team (2-5 people)</option>
            <option value="6-10">Medium team (6-10 people)</option>
            <option value="11-25">Large team (11-25 people)</option>
            <option value="25+">Enterprise (25+ people)</option>
          </select>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '500' }}>Key Team Members</h4>
            {formData.keyMembers.length < 5 && (
              <button
                type="button"
                onClick={addTeamMember}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Add Member
              </button>
            )}
          </div>

          {formData.keyMembers.map((member, index) => (
            <div key={index} style={{ 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px', 
              padding: '16px',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Member {index + 1}</span>
                {formData.keyMembers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTeamMember(index)}
                    style={{
                      padding: '2px 6px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              
              <div style={{ display: 'grid', gap: '12px' }}>
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) => handleTeamMemberChange(index, 'name', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                  placeholder="Full name *"
                />
                
                <input
                  type="text"
                  value={member.role}
                  onChange={(e) => handleTeamMemberChange(index, 'role', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                  placeholder="Role/Position *"
                />
                
                <input
                  type="text"
                  value={member.experience}
                  onChange={(e) => handleTeamMemberChange(index, 'experience', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}
                  placeholder="Experience/Background"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>
        Documents (Optional)
      </h3>
      
      <div style={{ 
        padding: '32px', 
        textAlign: 'center', 
        border: '2px dashed #d1d5db', 
        borderRadius: '8px',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
        <h4 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
          Document Upload Coming Soon
        </h4>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
          Document upload functionality will be available in the next update.
        </p>
        <p style={{ fontSize: '12px', color: '#9ca3af' }}>
          For now, you can proceed to submit your KYC application without documents.
        </p>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderBusinessInfo();
      case 2:
        return renderOwnerInfo();
      case 3:
        return renderTeamInfo();
      case 4:
        return renderDocuments();
      default:
        return null;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
            Creator Verification (KYC)
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Complete your business verification to start creating projects
          </p>
        </div>

        {renderStepIndicator()}

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
            {error}
          </div>
        )}

        {statusMessage && !error && (
          <div style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '24px',
            color: '#047857',
            fontSize: '14px'
          }}>
            {statusMessage}
          </div>
        )}

        {/* Step Content */}
        <div style={{ marginBottom: '32px' }}>
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            style={{
              padding: '12px 24px',
              backgroundColor: currentStep === 1 ? '#f3f4f6' : '#e5e7eb',
              color: currentStep === 1 ? '#9ca3af' : '#374151',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: currentStep === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              Next Step
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading && (
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #ffffff',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
              )}
              {loading ? 'Submitting...' : 'Submit KYC Application'}
            </button>
          )}
        </div>

        {/* Progress Text */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '16px',
          fontSize: '12px',
          color: '#9ca3af'
        }}>
          Step {currentStep} of 4
        </div>
      </div>

      {/* Add CSS for spinner animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default KYCForm;