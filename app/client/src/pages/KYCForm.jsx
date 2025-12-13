import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.jsx';
import { kycApi } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';

const KYCForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false); // Track if updating existing KYC
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  // Store timeout ref to clear it if needed
  const redirectTimeoutRef = React.useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Investors should never be on KYC page; redirect them to explore/dashboard
    if (user?.role === 'investor') {
      navigate('/dashboard', { replace: true });
      return;
    }

    // Only check verification status if not already redirecting
    if (!isRedirecting) {
      const checkStatus = async () => {
        try {
          // users.is_verified uses enum: 'no' | 'pending' | 'yes'
          if (user.is_verified === 'yes') {
            setStatusMessage('Your verification is approved. Redirecting to dashboard...');
            setIsRedirecting(true);
            navigate('/dashboard', { replace: true });
            return;
          }

          // Check user_verifications table for latest status
          const { data, error } = await supabase
            .from('user_verifications')
            .select('*')
            .eq('user_id', user.id)
            .single();
          if (!error && data?.verification_status) {
            if (data.verification_status === 'approved') {
              setStatusMessage('Your verification is approved. Redirecting to dashboard...');
              setIsRedirecting(true);
              navigate('/dashboard', { replace: true });
              return;
            }
            if (data.verification_status === 'pending') {
              // Load existing KYC data for updates instead of redirecting
              setFormData({
                legal_name: data.legal_name || '',
                phone: data.phone || '',
                legal_email: data.legal_email || user?.email || '',
                business_email: data.business_email || '',
                address_line1: data.legal_address?.line1 || '',
                address_line2: data.legal_address?.line2 || '',
                city: data.legal_address?.city || '',
                state: data.legal_address?.state || '',
                postal_code: data.legal_address?.postal_code || '',
                country: data.legal_address?.country || '',
                id_document_url: data.id_document_url || '',
                selfie_image_url: data.selfie_image_url || '',
                verification_type: data.verification_type || 'individual'
              });
              setIsUpdating(true); // Mark as updating
              setStatusMessage('You can update your verification details below.');
              // Don't redirect - let them update
              return;
            }
          }
        } catch (_) {
          // Ignore and allow form to render
        }
      };
      checkStatus();
    }

    // Cleanup timeout on unmount
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [user, navigate, isRedirecting]);

  // Form data state - matching your user_verifications table exactly
  const [formData, setFormData] = useState({
    // Personal Information (required fields in your schema)
    legal_name: '',
    phone: '',
    legal_email: user?.email || '',
    business_email: '',
    
    // Address Information (stored as JSONB in legal_address)
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    
    // Document uploads (URLs stored in your schema)
    id_document_url: '',
    selfie_image_url: '',
    
    // Verification type (your enum: individual/business)
    verification_type: 'individual'
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (field, file) => {
    setFormData(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1: // Personal Information
        return formData.legal_name && formData.phone && formData.legal_email;
      case 2: // Address Information
        return formData.address_line1 && formData.city && formData.state && 
               formData.postal_code && formData.country;
      case 3: // Document Upload - now optional
        return true; // Documents are optional for now
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
      setError('');
    } else {
      setError('Please fill in all required fields');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError('');
  };

  const uploadFile = async (file, folder) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${folder}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file);
    
    if (error) {
      console.error('Upload error:', error);
      throw new Error(`Failed to upload ${folder}: ${error.message}`);
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('kyc-documents')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const submitKYC = async (kycData) => {
    try {
      console.log('Submitting KYC data:', kycData);
      
      const { data, error } = await supabase
        .from('user_verifications')
        .insert([kycData])
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error details:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new Error(`Database error: ${error.message}${error.hint ? ` (${error.hint})` : ''}`);
      }
      
      console.log('KYC data inserted successfully:', data);
      return { success: true, data };
    } catch (err) {
      console.error('KYC submission error:', err);
      return { success: false, error: err.message };
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      setError('Please complete all required fields');
      return;
    }

    if (!user?.id) {
      setError('You must be logged in to submit KYC verification');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setStatusMessage(isUpdating ? 'Updating verification...' : 'Submitting verification...');

    try {
      console.log(isUpdating ? '🔄 Updating KYC for user:' : '🚀 Starting KYC submission for user:', user.id);

      // Prepare KYC data according to your exact schema
      const kycData = {
        user_id: user.id,
        legal_name: formData.legal_name,
        legal_address: {
          line1: formData.address_line1,
          line2: formData.address_line2 || '',
          city: formData.city,
          state: formData.state,
          postal_code: formData.postal_code,
          country: formData.country
        },
        phone: formData.phone,
        legal_email: formData.legal_email,
        business_email: formData.business_email || null,
        id_document_url: formData.id_document_url || null,
        selfie_image_url: formData.selfie_image_url || null,
        verification_type: formData.verification_type || 'individual'
      };

      console.log('📝 Submitting KYC data:', kycData);

      // Submit using the new API (upsert will handle both insert and update)
      const result = await kycApi.submitKyc(kycData);
      
      console.log('✅ KYC submitted successfully:', result);

      // Set success message
      setStatusMessage(isUpdating ? 'Verification updated successfully! Refreshing your profile...' : 'Verification submitted successfully! Updating your profile...');
      
      // Refresh profile BEFORE redirecting to ensure Dashboard sees updated data
      try {
        await refreshProfile();
        console.log('✅ Profile refreshed successfully');
      } catch (error) {
        console.warn('Failed to refresh user profile:', error);
      }
      
      setStatusMessage(isUpdating ? 'Verification updated successfully! Redirecting...' : 'Verification submitted successfully! Redirecting...');
      setIsRedirecting(true);
      
      // Redirect after profile refresh
      if (user.role === 'creator') {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/explore', { replace: true });
      }

    } catch (error) {
      console.error('❌ KYC submission failed:', error);
      setError(error.message || 'Failed to submit verification. Please try again.');
      setStatusMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      marginBottom: '40px',
      gap: '16px'
    }}>
      {[1, 2, 3].map(step => (
        <div
          key={step}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: step <= currentStep ? '#29C7AC' : '#e5e7eb',
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

  const renderPersonalInfo = () => (
    <div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>
        Personal Information
      </h3>
      
      <div style={{ display: 'grid', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Legal Full Name *
          </label>
          <input
            type="text"
            value={formData.legal_name}
            onChange={(e) => handleInputChange('legal_name', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
            placeholder="Your full legal name as on government ID"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Phone Number *
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
            placeholder="+1 (555) 123-4567"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Legal Email Address *
          </label>
          <input
            type="email"
            value={formData.legal_email}
            onChange={(e) => handleInputChange('legal_email', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Business Email (Optional)
          </label>
          <input
            type="email"
            value={formData.business_email}
            onChange={(e) => handleInputChange('business_email', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
            placeholder="business@company.com"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Verification Type
          </label>
          <select
            value={formData.verification_type}
            onChange={(e) => handleInputChange('verification_type', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            <option value="individual">Individual</option>
            <option value="business">Business</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderAddressInfo = () => (
    <div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>
        Address Information
      </h3>
      
      <div style={{ display: 'grid', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Address Line 1 *
          </label>
          <input
            type="text"
            value={formData.address_line1}
            onChange={(e) => handleInputChange('address_line1', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
            placeholder="Street address"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
            Address Line 2 (Optional)
          </label>
          <input
            type="text"
            value={formData.address_line2}
            onChange={(e) => handleInputChange('address_line2', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
            placeholder="Apartment, suite, etc."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              City *
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              placeholder="City"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              State/Province *
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              placeholder="State/Province"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              Postal Code *
            </label>
            <input
              type="text"
              value={formData.postal_code}
              onChange={(e) => handleInputChange('postal_code', e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              placeholder="Postal/ZIP code"
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
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
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
        </div>
      </div>
    </div>
  );

  const renderDocumentUpload = () => (
    <div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
        Document Upload (Optional)
      </h3>
      
      <div style={{
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '24px'
      }}>
        <p style={{ fontSize: '14px', color: '#92400e', margin: 0 }}>
          📋 <strong>Note:</strong> Document uploads are optional for now. You can submit your verification and upload documents later when the storage system is configured.
        </p>
      </div>
      
      <div style={{ display: 'grid', gap: '24px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
            Government ID Document (Optional)
          </label>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
            Upload a clear photo of your government-issued ID (passport, driver's license, or national ID)
          </p>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => handleFileChange('id_document', e.target.files[0])}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
          {formData.id_document && (
            <p style={{ fontSize: '12px', color: '#059669', marginTop: '4px' }}>
              ✓ {formData.id_document.name}
            </p>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
            Selfie Photo (Optional)
          </label>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
            Upload a clear selfie photo for identity verification
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange('selfie_image', e.target.files[0])}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
          {formData.selfie_image && (
            <p style={{ fontSize: '12px', color: '#059669', marginTop: '4px' }}>
              ✓ {formData.selfie_image.name}
            </p>
          )}
        </div>

        <div style={{
          backgroundColor: '#f3f4f6',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#4b5563'
        }}>
          <h4 style={{ fontWeight: '600', marginBottom: '8px' }}>📋 Document Requirements:</h4>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            <li>Images must be clear and readable</li>
            <li>Maximum file size: 5MB per document</li>
            <li>Accepted formats: JPG, PNG, PDF</li>
            <li>Documents must be valid and not expired</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderPersonalInfo();
      case 2:
        return renderAddressInfo();
      case 3:
        return renderDocumentUpload();
      default:
        return null;
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
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
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
            {isUpdating ? 'Update KYC Verification' : 'KYC Verification'}
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            {isUpdating 
              ? 'Update your verification details while your application is under review'
              : 'Complete your identity verification to access creator features'}
          </p>
        </div>

        {isUpdating && (
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '18px' }}>ℹ️</span>
            <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>
              Your verification is currently under review. You can update your details, and the changes will be reviewed by our team.
            </p>
          </div>
        )}

        {renderStepIndicator()}

        {statusMessage && (
          <div style={{
            backgroundColor: '#dbeafe',
            border: '1px solid #3b82f6',
            color: '#1e40af',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {statusMessage}
            {isRedirecting && (
              <div style={{ marginTop: '8px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid #3b82f6',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto'
                }}></div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #ef4444',
            color: '#dc2626',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {!isRedirecting && (
          <>
            <div style={{ marginBottom: '32px' }}>
              {renderStepContent()}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '24px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                style={{
                  padding: '12px 24px',
                  backgroundColor: currentStep === 1 ? '#f3f4f6' : '#6b7280',
                  color: currentStep === 1 ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: currentStep === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Previous
              </button>

              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                Step {currentStep} of 3
              </div>

              {currentStep < 3 ? (
                <button
                  onClick={nextStep}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#29C7AC',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: isSubmitting ? '#9ca3af' : '#29C7AC',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmitting 
                    ? (isUpdating ? 'Updating...' : 'Submitting...') 
                    : (isUpdating ? 'Update Verification' : 'Submit Verification')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
};

export default KYCForm;