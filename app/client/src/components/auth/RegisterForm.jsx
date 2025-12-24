import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { 
  validateEmail, 
  validateName, 
  validatePassword, 
  validatePasswordMatch
} from '../../utils/validation';
import { calculatePasswordStrength } from '../../utils/passwordStrength';
import './AuthForms.css';

const RegisterForm = ({ onSwitchToLogin, onClose }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [fieldTouched, setFieldTouched] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({ strength: 'weak', score: 0, feedback: '' });
  
  const { register, error, clearError } = useAuth();

  // Check if form is valid for submit button
  const isFormValid = () => {
    return (
      formData.fullName.trim() !== '' &&
      formData.email.trim() !== '' &&
      formData.password.trim() !== '' &&
      formData.confirmPassword.trim() !== '' &&
      passwordStrength.strength !== 'weak' &&
      Object.values(validationErrors).every(error => !error)
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Apply input filtering
    let filteredValue = value;
    if (name === 'fullName') {
      // Allow letters, spaces, hyphens, and apostrophes only
      filteredValue = value.replace(/[^a-zA-Z\s'-]/g, '');
    } else if (name === 'email') {
      // Allow valid email characters
      filteredValue = value.replace(/[^a-zA-Z0-9@._-]/g, '');
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: filteredValue
    }));
    
    // Calculate password strength for password field
    if (name === 'password') {
      const strength = calculatePasswordStrength(filteredValue);
      setPasswordStrength(strength);
    }
    
    // Validate on change if field was touched
    if (fieldTouched[name]) {
      validateField(name, filteredValue);
    }
    
    // Clear auth error when user starts typing
    if (error) {
      clearError();
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setFieldTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const validateField = (fieldName, value) => {
    let result = { valid: true, error: null };

    switch (fieldName) {
      case 'fullName':
        result = validateName(value);
        break;
      case 'email':
        result = validateEmail(value);
        break;
      case 'password':
        result = validatePassword(value);
        // Also validate confirm password if it exists
        if (formData.confirmPassword) {
          const confirmResult = validatePasswordMatch(value, formData.confirmPassword);
          setValidationErrors(prev => ({
            ...prev,
            confirmPassword: confirmResult.error || ''
          }));
        }
        break;
      case 'confirmPassword':
        result = validatePasswordMatch(formData.password, value);
        break;
      default:
        break;
    }

    setValidationErrors(prev => ({
      ...prev,
      [fieldName]: result.error || ''
    }));

    return result.valid;
  };

  const validateForm = () => {
    const errors = {};
    
    const nameResult = validateName(formData.fullName);
    if (!nameResult.valid) errors.fullName = nameResult.error;
    
    const emailResult = validateEmail(formData.email);
    if (!emailResult.valid) errors.email = emailResult.error;
    
    const passwordResult = validatePassword(formData.password);
    if (!passwordResult.valid) errors.password = passwordResult.error;
    
    const confirmResult = validatePasswordMatch(formData.password, formData.confirmPassword);
    if (!confirmResult.valid) errors.confirmPassword = confirmResult.error;
    
    setValidationErrors(errors);
    setFieldTouched({
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true
    });
    
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent empty submissions
    if (!formData.fullName.trim() || !formData.email.trim() || 
        !formData.password.trim() || !formData.confirmPassword.trim()) {
      setValidationErrors(prev => ({
        ...prev,
        fullName: !formData.fullName.trim() ? 'Full name is required' : prev.fullName,
        email: !formData.email.trim() ? 'Email is required' : prev.email,
        password: !formData.password.trim() ? 'Password is required' : prev.password,
        confirmPassword: !formData.confirmPassword.trim() ? 'Please confirm password' : prev.confirmPassword
      }));
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await register(formData.email, formData.password, {
        fullName: formData.fullName,
        displayName: formData.fullName
      });
      
      // Show success message
      setShowSuccess(true);
      
      // Auto switch to login after 3 seconds
      setTimeout(() => {
        onSwitchToLogin?.();
      }, 3000);
      
    } catch (error) {
      console.error('Registration failed:', error);
      // Error will be displayed via the error from AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="auth-form-container">
        <div className="auth-form success-message">
          <div className="success-icon">✓</div>
          <h2>Check Your Email</h2>
          <p>
            We've sent a confirmation link to <strong>{formData.email}</strong>
          </p>
          <p>
            Please check your email and click the confirmation link to activate your account.
          </p>
          <button 
            type="button"
            className="auth-submit-btn"
            onClick={onSwitchToLogin}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-form-container">
      <form onSubmit={handleSubmit} className="auth-form">
        <h2>Create Account</h2>
        <p className="auth-subtitle">Join our investment platform</p>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="fullName">Full Name *</label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className={validationErrors.fullName ? 'error' : ''}
            placeholder="Enter your full name"
            autoComplete="name"
            disabled={isSubmitting}
            maxLength={50}
          />
          {validationErrors.fullName && (
            <span className="field-error">{validationErrors.fullName}</span>
          )}
          <small className="field-hint">Letters, spaces, hyphens, and apostrophes only</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email Address *</label>
          <input
            type="text"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className={validationErrors.email ? 'error' : ''}
            placeholder="Enter your email"
            autoComplete="email"
            disabled={isSubmitting}
          />
          {validationErrors.email && (
            <span className="field-error">{validationErrors.email}</span>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password *</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className={validationErrors.password ? 'error' : ''}
            placeholder="Create a strong password"
            autoComplete="new-password"
            disabled={isSubmitting}
          />
          {validationErrors.password && (
            <span className="field-error">{validationErrors.password}</span>
          )}
          {formData.password && (
            <div className={`password-strength password-strength-${passwordStrength.strength}`}>
              <div className="strength-bar">
                <div className="strength-fill" data-strength={passwordStrength.strength}></div>
              </div>
              <span className="strength-text">{passwordStrength.feedback}</span>
            </div>
          )}
          <small className="field-hint">Min. 8 characters with uppercase, lowercase, number & special character</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password *</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className={validationErrors.confirmPassword ? 'error' : ''}
            placeholder="Confirm your password"
            autoComplete="new-password"
            disabled={isSubmitting}
          />
          {validationErrors.confirmPassword && (
            <span className="field-error">{validationErrors.confirmPassword}</span>
          )}
        </div>
        
        <button 
          type="submit" 
          className="auth-submit-btn"
          disabled={isSubmitting || !isFormValid()}
        >
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
        
        <div className="auth-footer">
          <span>Already have an account? </span>
          <button 
            type="button"
            className="auth-switch-link"
            onClick={onSwitchToLogin}
            disabled={isSubmitting}
          >
            Sign In
          </button>
        </div>
        
        <div className="terms-notice">
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </div>
      </form>
    </div>
  );
};

export default RegisterForm;