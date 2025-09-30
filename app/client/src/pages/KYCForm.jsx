import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

const KYCForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const navigate = useNavigate();
  const { user, refreshUserData } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Check if user already has pending or approved verification
    if (user.is_verified === 'yes') {
      setStatusMessage('Your verification is already approved. Redirecting to dashboard...');
      navigate('/dashboard', { replace: true });
    } else if (user.is_verified === 'pending') {
      setStatusMessage('Your verification is pending review. Redirecting to dashboard...');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Form data state - matching user_verifications table
  const [formData, setFormData] = useState({
    // Personal Information
    legal_name: '',
    phone: '',
    legal_email: user?.email || '',
    business_email: '',
    
    // Address Information
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    
    // Document uploads
    id_document: null,
    selfie_image: null,
    
    // Verification type
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

    setLoading(true);
    setError('');
    setStatusMessage('Submitting verification...');

    try {
      // Upload documents to Supabase Storage (optional)
      let id_document_url = null;
      let selfie_image_url = null;
      
      // Only attempt upload if files are provided
      try {
        if (formData.id_document) {
          setStatusMessage('Uploading ID document...');
          id_document_url = await uploadFile(formData.id_document, 'id-documents');
        }
        if (formData.selfie_image) {
          setStatusMessage('Uploading selfie...');
          selfie_image_url = await uploadFile(formData.selfie_image, 'selfies');
        }
      } catch (uploadError) {
        console.warn('File upload failed (storage bucket not configured):', uploadError);
        // Continue without uploaded files since storage bucket may not be configured
        setStatusMessage('Proceeding without file uploads (storage not configured)...');
      }

      // Prepare data for user_verifications table
      const kycData = {
        user_id: user.id,
        legal_name: formData.legal_name,
        legal_address: {
          line1: formData.address_line1,
          line2: formData.address_line2,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postal_code,
          country: formData.country
        },
        phone: formData.phone,
        legal_email: formData.legal_email,
        business_email: formData.business_email || null,
        id_document_url,
        selfie_image_url,
        verification_type: formData.verification_type
      };

      const result = await submitKYC(kycData);

      if (result.success) {
        console.log('KYC submitted successfully');
        
        // Refresh user data to get updated verification status
        await refreshUserData();
        
        setStatusMessage('Verification submitted successfully! Your status is now pending review. Redirecting to dashboard...');
        
        setTimeout(() => {
          navigate('/dashboard', { replace: true, state: { onboarding: 'kyc-submitted' } });
        }, 2000);
      } else {
        setError(result.error || 'Failed to submit KYC form');
        setStatusMessage('');
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
            KYC Verification
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Complete your identity verification to access creator features
          </p>
        </div>

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
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: loading ? '#9ca3af' : '#29C7AC',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Submitting...' : 'Submit Verification'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KYCForm;