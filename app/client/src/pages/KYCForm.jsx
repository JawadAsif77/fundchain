import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { Country, State, City } from 'country-state-city';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import Select from 'react-select';
import '../styles/kyc-form.css';

const KYCForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [hasSubmittedSuccessfully, setHasSubmittedSuccessfully] = useState(false);
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  // Phone verification states
  const [phoneVerificationStep, setPhoneVerificationStep] = useState('input'); // 'input', 'otp', 'verified'
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);

  // Location states
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  const [formData, setFormData] = useState({
    // Personal Information
    legal_name: '',
    date_of_birth: '',
    nationality: '',
    gender: '',
    
    // Contact Information
    phone: '',
    phone_country_code: '',
    legal_email: user?.email || '',
    business_email: '',
    
    // Address Information
    address_line1: '',
    address_line2: '',
    city: '',
    province_state: '',
    postal_code: '',
    country: '',
    country_code: '',
    
    // Professional Information
    occupation: '',
    source_of_funds: '',
    purpose_of_platform: '',
    
    // ID Document Information
    id_type: '',
    id_number: '',
    id_issue_date: '',
    id_expiry_date: '',
    id_issuing_country: '',
    
    // Document uploads
    id_document_url: '',
    selfie_image_url: '',
    proof_of_address_url: '',
    
    // Emergency Contact
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    
    // Compliance
    pep_status: false,
    
    // Type
    verification_type: 'individual'
  });

  // Load countries on mount
  useEffect(() => {
    const allCountries = Country.getAllCountries().map(country => ({
      value: country.isoCode,
      label: country.name,
      code: country.isoCode
    }));
    setCountries(allCountries);
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (selectedCountry) {
      const countryStates = State.getStatesOfCountry(selectedCountry.value).map(state => ({
        value: state.isoCode,
        label: state.name,
        countryCode: state.countryCode
      }));
      setStates(countryStates);
      setCities([]);
      setSelectedState(null);
      setSelectedCity(null);
    }
  }, [selectedCountry]);

  // Load cities when state changes
  useEffect(() => {
    if (selectedCountry && selectedState) {
      const stateCities = City.getCitiesOfState(
        selectedCountry.value,
        selectedState.value
      ).map(city => ({
        value: city.name,
        label: city.name
      }));
      setCities(stateCities);
      setSelectedCity(null);
    }
  }, [selectedState, selectedCountry]);

  // OTP timer
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpTimer]);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (user?.role === 'investor') {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (!isRedirecting && !hasSubmittedSuccessfully) {
      const checkStatus = async () => {
        try {
          if (user.is_verified === 'yes') {
            setStatusMessage('Your verification is approved. Redirecting to dashboard...');
            setIsRedirecting(true);
            navigate('/dashboard', { replace: true });
            return;
          }

          const { data, error } = await supabase
            .from('user_verifications')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          console.log('KYC Form - Existing data loaded:', data);

          if (!error && data) {
            if (data.verification_status === 'approved') {
              setStatusMessage('Your verification is approved. Redirecting to dashboard...');
              setIsRedirecting(true);
              navigate('/dashboard', { replace: true });
              return;
            }
            if (data.verification_status === 'pending') {
              console.log('Loading existing data for update...');
              // Load existing data for updates
              loadExistingKYCData(data);
              setIsUpdating(true);
              setStatusMessage('You can update your verification details below.');
              return;
            }
          }
        } catch (err) {
          console.error('Error checking KYC status:', err);
          // Ignore and allow form to render
        }
      };
      checkStatus();
    }
  }, [user, navigate, isRedirecting, hasSubmittedSuccessfully]);

  const loadExistingKYCData = (data) => {
    console.log('loadExistingKYCData called with:', data);
    
    const formDataToSet = {
      legal_name: data.legal_name || '',
      date_of_birth: data.date_of_birth || '',
      nationality: data.nationality || '',
      gender: data.gender || '',
      phone: data.phone || '',
      phone_country_code: data.phone_country_code || '',
      legal_email: data.legal_email || user?.email || '',
      business_email: data.business_email || '',
      address_line1: data.legal_address?.line1 || '',
      address_line2: data.address_line2 || data.legal_address?.line2 || '',
      city: data.legal_address?.city || '',
      province_state: data.province_state || data.legal_address?.state || '',
      postal_code: data.legal_address?.postal_code || '',
      country: data.legal_address?.country || '',
      country_code: data.country_code || '',
      occupation: data.occupation || '',
      source_of_funds: data.source_of_funds || '',
      purpose_of_platform: data.purpose_of_platform || '',
      id_type: data.id_type || '',
      id_number: data.id_number || '',
      id_issue_date: data.id_issue_date || '',
      id_expiry_date: data.id_expiry_date || '',
      id_issuing_country: data.id_issuing_country || '',
      id_document_url: data.id_document_url || '',
      selfie_image_url: data.selfie_image_url || '',
      proof_of_address_url: data.proof_of_address_url || '',
      emergency_contact_name: data.emergency_contact_name || '',
      emergency_contact_phone: data.emergency_contact_phone || '',
      emergency_contact_relationship: data.emergency_contact_relationship || '',
      pep_status: data.pep_status || false,
      verification_type: data.verification_type || 'individual'
    };
    
    console.log('Setting form data to:', formDataToSet);
    setFormData(formDataToSet);

    // Set phone verification status
    if (data.phone_verified) {
      setPhoneVerificationStep('verified');
    }

    // Load country/state/city after countries are loaded
    setTimeout(() => {
      console.log('Attempting to load country/state/city...');
      if (data.country_code) {
        const allCountries = Country.getAllCountries();
        const country = allCountries.find(c => c.isoCode === data.country_code);
        console.log('Found country:', country);
        if (country) {
          const countryOption = {
            value: country.isoCode,
            label: country.name,
            code: country.isoCode
          };
          setSelectedCountry(countryOption);
          
          // Load state if exists
          if (data.province_state || data.legal_address?.state) {
            setTimeout(() => {
              const stateCode = data.province_state || data.legal_address?.state;
              const allStates = State.getStatesOfCountry(country.isoCode);
              const state = allStates.find(s => s.isoCode === stateCode || s.name === stateCode);
              console.log('Found state:', state);
              if (state) {
                const stateOption = {
                  value: state.isoCode,
                  label: state.name,
                  countryCode: state.countryCode
                };
                setSelectedState(stateOption);
                
                // Load city if exists
                if (data.legal_address?.city) {
                  setTimeout(() => {
                    const cityName = data.legal_address.city;
                    const cityOption = { value: cityName, label: cityName };
                    console.log('Setting city:', cityOption);
                    setSelectedCity(cityOption);
                  }, 100);
                }
              }
            }, 100);
          }
        }
      }
    }, 100);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCountryChange = (option) => {
    setSelectedCountry(option);
    setFormData(prev => ({
      ...prev,
      country: option.label,
      country_code: option.value
    }));
  };

  const handleStateChange = (option) => {
    setSelectedState(option);
    setFormData(prev => ({
      ...prev,
      province_state: option.label
    }));
  };

  const handleCityChange = (option) => {
    setSelectedCity(option);
    setFormData(prev => ({
      ...prev,
      city: option.value
    }));
  };

  const handlePhoneChange = (phone, country) => {
    setFormData(prev => ({
      ...prev,
      phone: phone,
      phone_country_code: country.dialCode
    }));
    // Reset verification when phone changes
    if (phoneVerificationStep === 'verified') {
      setPhoneVerificationStep('input');
    }
  };

  const sendOTP = async (isResend = false) => {
    if (!formData.phone || formData.phone.length < 10) {
      setOtpError('Please enter a valid phone number');
      return;
    }

    setSendingOtp(true);
    setOtpError('');
    
    // Clear previous OTP when requesting new one
    if (isResend) {
      setOtpCode('');
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-phone-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            phone: formData.phone,
            countryCode: formData.phone_country_code
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        setPhoneVerificationStep('otp');
        setOtpSent(true);
        setOtpTimer(600); // 10 minutes
        setStatusMessage(`${isResend ? 'New OTP' : 'OTP'} sent to ${formData.phone}. For development, OTP is: ${result.otp}`);
      } else {
        setOtpError(result.error || 'Failed to send OTP');
      }
    } catch (err) {
      console.error('Error sending OTP:', err);
      setOtpError('Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-phone-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ otp: otpCode })
        }
      );

      const result = await response.json();

      if (result.success) {
        setPhoneVerificationStep('verified');
        setStatusMessage('Phone verified successfully!');
        setOtpError('');
        setTimeout(() => setStatusMessage(''), 3000);
      } else {
        setOtpError(result.message || 'Invalid OTP');
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setOtpError('Failed to verify OTP. Please try again.');
    }
  };

  const handleFileChange = async (field, file) => {
    if (!file) return;

    // Upload file to Supabase Storage
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${field}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(fileName);
      
      setFormData(prev => ({
        ...prev,
        [`${field}_url`]: publicUrl
      }));
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(`Failed to upload ${field}. Please try again.`);
    }
  };

  const validateCurrentStep = () => {
    const errors = {};
    
    switch (currentStep) {
      case 1: // Personal Information
        if (!formData.legal_name || formData.legal_name.trim().length < 2) {
          errors.legal_name = 'Full name is required (minimum 2 characters)';
        } else if (!/^[a-zA-Z\s'-]+$/.test(formData.legal_name)) {
          errors.legal_name = 'Name should only contain letters, spaces, hyphens, and apostrophes';
        }
        
        if (!formData.date_of_birth) {
          errors.date_of_birth = 'Date of birth is required';
        } else {
          const dob = new Date(formData.date_of_birth);
          const today = new Date();
          const age = today.getFullYear() - dob.getFullYear();
          if (age < 18) {
            errors.date_of_birth = 'You must be at least 18 years old';
          } else if (age > 120) {
            errors.date_of_birth = 'Please enter a valid date of birth';
          }
        }
        
        if (!formData.nationality || formData.nationality.trim().length < 2) {
          errors.nationality = 'Nationality is required';
        }
        
        if (!formData.gender) {
          errors.gender = 'Gender is required';
        }
        break;
        
      case 2: // Contact & Verification
        if (!formData.phone || formData.phone.length < 10) {
          errors.phone = 'Valid phone number is required (minimum 10 digits)';
        } else if (!/^\+?[\d\s()-]+$/.test(formData.phone)) {
          errors.phone = 'Phone number contains invalid characters';
        }
        
        if (phoneVerificationStep !== 'verified') {
          errors.phone_verification = 'Please verify your phone number';
        }
        
        if (!formData.legal_email) {
          errors.legal_email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.legal_email)) {
          errors.legal_email = 'Please enter a valid email address';
        }
        
        if (formData.business_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.business_email)) {
          errors.business_email = 'Please enter a valid business email address';
        }
        break;
        
      case 3: // Address
        if (!formData.address_line1 || formData.address_line1.trim().length < 5) {
          errors.address_line1 = 'Address is required (minimum 5 characters)';
        }
        
        if (!formData.city || formData.city.trim().length < 2) {
          errors.city = 'City is required';
        } else if (!/^[a-zA-Z\s'-]+$/.test(formData.city)) {
          errors.city = 'City name should only contain letters and spaces';
        }
        
        if (!formData.province_state || formData.province_state.trim().length < 2) {
          errors.province_state = 'State/Province is required';
        }
        
        if (!formData.postal_code || formData.postal_code.trim().length < 3) {
          errors.postal_code = 'Postal code is required';
        } else if (!/^[A-Za-z0-9\s-]+$/.test(formData.postal_code)) {
          errors.postal_code = 'Postal code contains invalid characters';
        }
        
        if (!formData.country || formData.country.trim().length < 2) {
          errors.country = 'Country is required';
        }
        
        if (!formData.country_code) {
          errors.country_code = 'Please select a country from the dropdown';
        }
        break;
        
      case 4: // Professional
        if (!formData.occupation || formData.occupation.trim().length < 2) {
          errors.occupation = 'Occupation is required';
        }
        
        if (!formData.source_of_funds || formData.source_of_funds.trim().length < 3) {
          errors.source_of_funds = 'Source of funds is required';
        }
        
        if (!formData.purpose_of_platform || formData.purpose_of_platform.trim().length < 10) {
          errors.purpose_of_platform = 'Purpose is required (minimum 10 characters)';
        } else if (formData.purpose_of_platform.length > 500) {
          errors.purpose_of_platform = 'Purpose must be less than 500 characters';
        }
        break;
        
      case 5: // ID Document
        if (!formData.id_type) {
          errors.id_type = 'ID type is required';
        }
        
        if (!formData.id_number || formData.id_number.trim().length < 5) {
          errors.id_number = 'ID number is required (minimum 5 characters)';
        } else if (!/^[A-Za-z0-9-]+$/.test(formData.id_number)) {
          errors.id_number = 'ID number should only contain letters, numbers, and hyphens';
        }
        
        if (!formData.id_issuing_country || formData.id_issuing_country.trim().length < 2) {
          errors.id_issuing_country = 'Issuing country is required';
        }
        
        if (!formData.id_issue_date) {
          errors.id_issue_date = 'Issue date is required';
        } else {
          const issueDate = new Date(formData.id_issue_date);
          const today = new Date();
          if (issueDate > today) {
            errors.id_issue_date = 'Issue date cannot be in the future';
          }
        }
        
        if (!formData.id_expiry_date) {
          errors.id_expiry_date = 'Expiry date is required';
        } else {
          const expiryDate = new Date(formData.id_expiry_date);
          const today = new Date();
          const issueDate = new Date(formData.id_issue_date);
          
          if (expiryDate < today) {
            errors.id_expiry_date = 'ID document has expired';
          } else if (issueDate && expiryDate < issueDate) {
            errors.id_expiry_date = 'Expiry date must be after issue date';
          }
        }
        break;
        
      case 6: // Document Upload
        if (!formData.id_document_url) {
          errors.id_document = 'Please upload your ID document';
        }
        if (!formData.selfie_image_url) {
          errors.selfie = 'Please upload a selfie image';
        }
        if (!formData.proof_of_address_url) {
          errors.proof_of_address = 'Please upload proof of address';
        }
        break;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 6));
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

    setIsSubmitting(true);
    setError('');

    try {
      console.log('Submitting KYC with form data:', formData);
      
      // Build KYC data object - include ALL fields, not just conditionally
      const kycData = {
        user_id: user.id,
        legal_name: formData.legal_name,
        phone: formData.phone,
        phone_country_code: formData.phone_country_code || null,
        legal_email: formData.legal_email,
        business_email: formData.business_email || null,
        date_of_birth: formData.date_of_birth || null,
        nationality: formData.nationality || null,
        gender: formData.gender || null,
        legal_address: {
          line1: formData.address_line1,
          line2: formData.address_line2 || null,
          city: formData.city,
          state: formData.province_state,
          postal_code: formData.postal_code,
          country: formData.country
        },
        address_line2: formData.address_line2 || null,
        province_state: formData.province_state || null,
        country_code: formData.country_code || null,
        occupation: formData.occupation || null,
        source_of_funds: formData.source_of_funds || null,
        purpose_of_platform: formData.purpose_of_platform || null,
        id_type: formData.id_type || null,
        id_number: formData.id_number || null,
        id_issue_date: formData.id_issue_date || null,
        id_expiry_date: formData.id_expiry_date || null,
        id_issuing_country: formData.id_issuing_country || null,
        id_document_url: formData.id_document_url || null,
        selfie_image_url: formData.selfie_image_url || null,
        proof_of_address_url: formData.proof_of_address_url || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        emergency_contact_relationship: formData.emergency_contact_relationship || null,
        pep_status: formData.pep_status || false,
        verification_type: formData.verification_type,
        verification_status: 'pending',
        phone_verified: phoneVerificationStep === 'verified',
        phone_verified_at: phoneVerificationStep === 'verified' ? new Date().toISOString() : null
      };

      console.log('KYC data to submit:', kycData);

      // Check if record already exists
      const { data: existingRecord } = await supabase
        .from('user_verifications')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('Existing record:', existingRecord);

      let result;
      if (existingRecord) {
        // Update existing KYC
        console.log('Updating existing record with ID:', existingRecord.id);
        result = await supabase
          .from('user_verifications')
          .update(kycData)
          .eq('user_id', user.id)
          .select();
      } else {
        // Insert new KYC
        console.log('Inserting new record...');
        result = await supabase
          .from('user_verifications')
          .insert([kycData])
          .select();
      }

      console.log('Submit result:', result);

      if (result.error) {
        console.error('KYC submission error:', result.error);
        throw new Error(result.error.message || 'Failed to submit KYC');
      }

      // Verify the update worked by fetching the data
      const { data: verifyData, error: verifyError } = await supabase
        .from('user_verifications')
        .select('legal_name, date_of_birth, nationality, gender, occupation')
        .eq('user_id', user.id)
        .single();
      
      console.log('Verification after update:', verifyData);
      
      if (verifyError) {
        console.error('Error verifying update:', verifyError);
      }

      // Update user profile is_verified status
      await supabase
        .from('users')
        .update({ is_verified: 'pending' })
        .eq('id', user.id);

      // Set flag to prevent reload of old data
      setHasSubmittedSuccessfully(true);

      await refreshProfile();

      setStatusMessage(
        isUpdating 
          ? 'KYC details updated successfully! Our team will review your submission.'
          : 'KYC submitted successfully! Our team will review your submission.'
      );
      
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 2000);

    } catch (err) {
      console.error('Error submitting KYC:', err);
      setError(err.message || 'Failed to submit KYC. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="step-indicator">
      {[
        'Personal',
        'Contact',
        'Address',
        'Professional',
        'ID Document',
        'Upload'
      ].map((label, index) => (
        <div
          key={index}
          className={`step ${currentStep >= index + 1 ? 'active' : ''} ${
            currentStep > index + 1 ? 'completed' : ''
          }`}
        >
          <div className="step-number">
            {currentStep > index + 1 ? '✓' : index + 1}
          </div>
          <div className="step-label">{label}</div>
        </div>
      ))}
    </div>
  );

  const renderPersonalInfo = () => (
    <div className="form-section">
      <h3>Personal Information</h3>
      
      <div className="form-group">
        <label>Full Legal Name *</label>
        <input
          type="text"
          value={formData.legal_name}
          onChange={(e) => handleInputChange('legal_name', e.target.value)}
          placeholder="Enter your full name as per ID"
        />
        {validationErrors.legal_name && (
          <span className="error">{validationErrors.legal_name}</span>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Date of Birth *</label>
          <input
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
          {validationErrors.date_of_birth && (
            <span className="error">{validationErrors.date_of_birth}</span>
          )}
        </div>

        <div className="form-group">
          <label>Gender *</label>
          <select
            value={formData.gender}
            onChange={(e) => handleInputChange('gender', e.target.value)}
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
          {validationErrors.gender && (
            <span className="error">{validationErrors.gender}</span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label>Nationality *</label>
        <Select
          options={countries}
          value={countries.find(c => c.label === formData.nationality)}
          onChange={(option) => handleInputChange('nationality', option.label)}
          placeholder="Select your nationality"
          isSearchable
        />
        {validationErrors.nationality && (
          <span className="error">{validationErrors.nationality}</span>
        )}
      </div>
    </div>
  );

  const renderContactInfo = () => (
    <div className="form-section">
      <h3>Contact Information & Verification</h3>
      
      <div className="form-group">
        <label>Phone Number * {phoneVerificationStep === 'verified' && '✓ Verified'}</label>
        <PhoneInput
          country={'us'}
          value={formData.phone}
          onChange={handlePhoneChange}
          disabled={phoneVerificationStep === 'verified'}
          inputStyle={{ width: '100%' }}
        />
        {validationErrors.phone && (
          <span className="error">{validationErrors.phone}</span>
        )}
        
        {phoneVerificationStep === 'input' && (
          <button
            type="button"
            onClick={sendOTP}
            disabled={sendingOtp || !formData.phone}
            className="btn-secondary mt-2"
          >
            {sendingOtp ? 'Sending...' : 'Verify Phone Number'}
          </button>
        )}
        
        {phoneVerificationStep === 'otp' && (
          <div className="otp-verification">
            <input
              type="text"
              maxLength="6"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit OTP"
              className="otp-input"
            />
            <div className="otp-actions">
              <button
                type="button"
                onClick={verifyOTP}
                className="btn-primary"
                disabled={otpCode.length !== 6}
              >
                Verify OTP
              </button>
              <button
                type="button"
                onClick={() => sendOTP(true)}
                className="btn-secondary"
                disabled={sendingOtp}
              >
                {sendingOtp ? 'Sending...' : 'Request New OTP'}
              </button>
            </div>
            {otpTimer > 0 && (
              <p className="text-muted">
                OTP expires in {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}
              </p>
            )}
            {otpTimer === 0 && (
              <p className="text-error">
                OTP expired. Please request a new one.
              </p>
            )}
          </div>
        )}
        
        {otpError && <span className="error">{otpError}</span>}
        {validationErrors.phone_verification && (
          <span className="error">{validationErrors.phone_verification}</span>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Email Address *</label>
          <input
            type="email"
            value={formData.legal_email}
            onChange={(e) => handleInputChange('legal_email', e.target.value)}
            placeholder="your@email.com"
          />
          {validationErrors.legal_email && (
            <span className="error">{validationErrors.legal_email}</span>
          )}
        </div>

        <div className="form-group">
          <label>Business Email (Optional)</label>
          <input
            type="email"
            value={formData.business_email}
            onChange={(e) => handleInputChange('business_email', e.target.value)}
            placeholder="business@email.com"
          />
        </div>
      </div>
    </div>
  );

  const renderAddressInfo = () => (
    <div className="form-section">
      <h3>Address Information</h3>
      
      <div className="form-group">
        <label>Country *</label>
        <Select
          options={countries}
          value={selectedCountry}
          onChange={handleCountryChange}
          placeholder="Select your country"
          isSearchable
        />
        {validationErrors.country && (
          <span className="error">{validationErrors.country}</span>
        )}
      </div>

      <div className="form-group">
        <label>Address Line 1 *</label>
        <input
          type="text"
          value={formData.address_line1}
          onChange={(e) => handleInputChange('address_line1', e.target.value)}
          placeholder="Street address, P.O. box"
        />
        {validationErrors.address_line1 && (
          <span className="error">{validationErrors.address_line1}</span>
        )}
      </div>

      <div className="form-group">
        <label>Address Line 2 (Optional)</label>
        <input
          type="text"
          value={formData.address_line2}
          onChange={(e) => handleInputChange('address_line2', e.target.value)}
          placeholder="Apartment, suite, unit, building, floor, etc."
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>State/Province *</label>
          <Select
            options={states}
            value={selectedState}
            onChange={handleStateChange}
            placeholder="Select state/province"
            isSearchable
            isDisabled={!selectedCountry}
          />
          {validationErrors.province_state && (
            <span className="error">{validationErrors.province_state}</span>
          )}
        </div>

        <div className="form-group">
          <label>City *</label>
          <Select
            options={cities}
            value={selectedCity}
            onChange={handleCityChange}
            placeholder="Select city"
            isSearchable
            isDisabled={!selectedState}
          />
          {validationErrors.city && (
            <span className="error">{validationErrors.city}</span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label>Postal/ZIP Code *</label>
        <input
          type="text"
          value={formData.postal_code}
          onChange={(e) => handleInputChange('postal_code', e.target.value)}
          placeholder="Enter postal code"
        />
        {validationErrors.postal_code && (
          <span className="error">{validationErrors.postal_code}</span>
        )}
      </div>
    </div>
  );

  const renderProfessionalInfo = () => (
    <div className="form-section">
      <h3>Professional Information</h3>
      
      <div className="form-group">
        <label>Occupation *</label>
        <input
          type="text"
          value={formData.occupation}
          onChange={(e) => handleInputChange('occupation', e.target.value)}
          placeholder="Your current occupation"
        />
        {validationErrors.occupation && (
          <span className="error">{validationErrors.occupation}</span>
        )}
      </div>

      <div className="form-group">
        <label>Source of Funds *</label>
        <select
          value={formData.source_of_funds}
          onChange={(e) => handleInputChange('source_of_funds', e.target.value)}
        >
          <option value="">Select source of funds</option>
          <option value="employment_income">Employment Income</option>
          <option value="business_income">Business Income</option>
          <option value="investments">Investments</option>
          <option value="savings">Savings</option>
          <option value="inheritance">Inheritance</option>
          <option value="gift">Gift</option>
          <option value="other">Other</option>
        </select>
        {validationErrors.source_of_funds && (
          <span className="error">{validationErrors.source_of_funds}</span>
        )}
      </div>

      <div className="form-group">
        <label>Purpose of Using Platform *</label>
        <textarea
          value={formData.purpose_of_platform}
          onChange={(e) => handleInputChange('purpose_of_platform', e.target.value)}
          placeholder="Briefly describe why you want to use FundChain"
          rows="4"
        />
        {validationErrors.purpose_of_platform && (
          <span className="error">{validationErrors.purpose_of_platform}</span>
        )}
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.pep_status}
            onChange={(e) => handleInputChange('pep_status', e.target.checked)}
          />
          <span>I am a Politically Exposed Person (PEP)</span>
        </label>
        <p className="help-text">
          A PEP is an individual who holds or has held a prominent public position
        </p>
      </div>

      <div className="info-box">
        <h4>Emergency Contact (Optional)</h4>
        <div className="form-row">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={formData.emergency_contact_name}
              onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
              placeholder="Emergency contact name"
            />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input
              type="text"
              value={formData.emergency_contact_phone}
              onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
              placeholder="Emergency contact phone"
            />
          </div>
        </div>
        <div className="form-group">
          <label>Relationship</label>
          <input
            type="text"
            value={formData.emergency_contact_relationship}
            onChange={(e) => handleInputChange('emergency_contact_relationship', e.target.value)}
            placeholder="e.g., Spouse, Parent, Sibling"
          />
        </div>
      </div>
    </div>
  );

  const renderIDDocument = () => (
    <div className="form-section">
      <h3>ID Document Information</h3>
      
      <div className="form-row">
        <div className="form-group">
          <label>ID Type *</label>
          <select
            value={formData.id_type}
            onChange={(e) => handleInputChange('id_type', e.target.value)}
          >
            <option value="">Select ID type</option>
            <option value="passport">Passport</option>
            <option value="national_id">National ID Card</option>
            <option value="drivers_license">Driver's License</option>
            <option value="residence_permit">Residence Permit</option>
          </select>
          {validationErrors.id_type && (
            <span className="error">{validationErrors.id_type}</span>
          )}
        </div>

        <div className="form-group">
          <label>ID Number *</label>
          <input
            type="text"
            value={formData.id_number}
            onChange={(e) => handleInputChange('id_number', e.target.value)}
            placeholder="ID number"
          />
          {validationErrors.id_number && (
            <span className="error">{validationErrors.id_number}</span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label>Issuing Country *</label>
        <Select
          options={countries}
          value={countries.find(c => c.label === formData.id_issuing_country)}
          onChange={(option) => handleInputChange('id_issuing_country', option.label)}
          placeholder="Select issuing country"
          isSearchable
        />
        {validationErrors.id_issuing_country && (
          <span className="error">{validationErrors.id_issuing_country}</span>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Issue Date (Optional)</label>
          <input
            type="date"
            value={formData.id_issue_date}
            onChange={(e) => handleInputChange('id_issue_date', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="form-group">
          <label>Expiry Date *</label>
          <input
            type="date"
            value={formData.id_expiry_date}
            onChange={(e) => handleInputChange('id_expiry_date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
          {validationErrors.id_expiry_date && (
            <span className="error">{validationErrors.id_expiry_date}</span>
          )}
        </div>
      </div>
    </div>
  );

  const renderDocumentUpload = () => (
    <div className="form-section">
      <h3>Document Upload</h3>
      
      <div className="alert alert-info">
        <p><strong>Required Documents:</strong></p>
        <ul>
          <li>Government-issued ID (Passport, National ID, or Driver's License)</li>
          <li>Selfie photo holding your ID</li>
          <li>Proof of address (Utility bill, Bank statement - not older than 3 months)</li>
        </ul>
      </div>

      <div className="form-group">
        <label>Government ID Document *</label>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => handleFileChange('id_document', e.target.files[0])}
        />
        {formData.id_document_url && (
          <span className="file-uploaded">✓ Document uploaded</span>
        )}
      </div>

      <div className="form-group">
        <label>Selfie with ID *</label>
        <p className="help-text">
          Please take a clear selfie while holding your ID next to your face
        </p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange('selfie_image', e.target.files[0])}
        />
        {formData.selfie_image_url && (
          <span className="file-uploaded">✓ Selfie uploaded</span>
        )}
      </div>

      <div className="form-group">
        <label>Proof of Address *</label>
        <p className="help-text">
          Upload a recent utility bill, bank statement, or government document showing your address
        </p>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => handleFileChange('proof_of_address', e.target.files[0])}
        />
        {formData.proof_of_address_url && (
          <span className="file-uploaded">✓ Proof of address uploaded</span>
        )}
      </div>

      <div className="alert alert-warning">
        <p><strong>Document Requirements:</strong></p>
        <ul>
          <li>Images must be clear and readable</li>
          <li>All information must be visible</li>
          <li>Documents must be valid and not expired</li>
          <li>File size: Maximum 5MB per document</li>
          <li>Accepted formats: JPG, PNG, PDF</li>
        </ul>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderPersonalInfo();
      case 2: return renderContactInfo();
      case 3: return renderAddressInfo();
      case 4: return renderProfessionalInfo();
      case 5: return renderIDDocument();
      case 6: return renderDocumentUpload();
      default: return null;
    }
  };

  if (isRedirecting) {
    return (
      <div className="kyc-container">
        <div className="kyc-card">
          <div className="status-message success">
            {statusMessage}
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kyc-container">
      <div className="kyc-card">
        <div className="kyc-header">
          <h1>{isUpdating ? 'Update KYC Verification' : 'KYC Verification'}</h1>
          <p>
            {isUpdating
              ? 'Update your verification details while under review'
              : 'Complete your identity verification to access all creator features'}
          </p>
        </div>

        {isUpdating && (
          <div className="alert alert-warning">
            <span>ℹ️</span>
            <p>
              Your verification is currently under review. You can update your details,
              and the changes will be reviewed by our team.
            </p>
          </div>
        )}

        {renderStepIndicator()}

        {statusMessage && (
          <div className="alert alert-success">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <div className="form-content">
          {renderStepContent()}
        </div>

        <div className="form-navigation">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="btn-secondary"
          >
            Previous
          </button>

          <div className="step-info">
            Step {currentStep} of 6
          </div>

          {currentStep < 6 ? (
            <button
              onClick={nextStep}
              className="btn-primary"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary"
            >
              {isSubmitting
                ? (isUpdating ? 'Updating...' : 'Submitting...')
                : (isUpdating ? 'Update Verification' : 'Submit Verification')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KYCForm;
