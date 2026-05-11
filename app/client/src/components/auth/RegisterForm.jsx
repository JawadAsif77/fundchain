import React, { useCallback, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { 
  validateEmail, 
  validateName, 
  validatePassword, 
  validatePasswordMatch,
  validateUsername
} from '../../utils/validation';
import { calculatePasswordStrength } from '../../utils/passwordStrength';
import { userApi } from '../../lib/api';
import './AuthForms.css';

const RegisterForm = ({ onSwitchToLogin, onClose }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [fieldTouched, setFieldTouched] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({ strength: 'weak', score: 0, feedback: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null });
  
  const { register, error, clearError } = useAuth();

  // Check if form is valid for submit button
  const isFormValid = () => {
    return (
      formData.fullName.trim() !== '' &&
      formData.username.trim() !== '' &&
      formData.email.trim() !== '' &&
      formData.password.trim() !== '' &&
      formData.confirmPassword.trim() !== '' &&
      passwordStrength.strength !== 'weak' &&
      usernameStatus.available !== false &&
      Object.values(validationErrors).every(error => !error)
    );
  };

  const checkUsernameAvailability = useCallback(async (rawUsername) => {
    const normalized = (rawUsername || '').trim().toLowerCase();
    if (!normalized) {
      setUsernameStatus({ checking: false, available: null });
      return false;
    }

    setUsernameStatus({ checking: true, available: null });
    try {
      const availabilityResult = await userApi.checkUsernameAvailability(normalized);
      const available = !!availabilityResult?.available;
      setUsernameStatus({ checking: false, available });

      if (!available) {
        setValidationErrors(prev => ({
          ...prev,
          username: 'Username is already taken'
        }));
      }

      return available;
    } catch {
      setUsernameStatus({ checking: false, available: null });
      return false;
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Apply input filtering
    let filteredValue = value;
    if (name === 'fullName') {
      // Allow letters, spaces, hyphens, and apostrophes only
      filteredValue = value.replace(/[^a-zA-Z\s'-]/g, '');
    } else if (name === 'username') {
      // Allow letters/numbers/dash/underscore only; normalize to lowercase
      filteredValue = value.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
      setUsernameStatus({ checking: false, available: null });
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
      case 'username':
        result = validateUsername(value);
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

    const usernameResult = validateUsername(formData.username);
    if (!usernameResult.valid) errors.username = usernameResult.error;
    
    const emailResult = validateEmail(formData.email);
    if (!emailResult.valid) errors.email = emailResult.error;
    
    const passwordResult = validatePassword(formData.password);
    if (!passwordResult.valid) errors.password = passwordResult.error;
    
    const confirmResult = validatePasswordMatch(formData.password, formData.confirmPassword);
    if (!confirmResult.valid) errors.confirmPassword = confirmResult.error;
    
    setValidationErrors(errors);
    setFieldTouched({
      fullName: true,
      username: true,
      email: true,
      password: true,
      confirmPassword: true
    });
    
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent empty submissions
    if (!formData.fullName.trim() || !formData.username.trim() || !formData.email.trim() || 
        !formData.password.trim() || !formData.confirmPassword.trim()) {
      setValidationErrors(prev => ({
        ...prev,
        fullName: !formData.fullName.trim() ? 'Full name is required' : prev.fullName,
        username: !formData.username.trim() ? 'Username is required' : prev.username,
        email: !formData.email.trim() ? 'Email is required' : prev.email,
        password: !formData.password.trim() ? 'Password is required' : prev.password,
        confirmPassword: !formData.confirmPassword.trim() ? 'Please confirm password' : prev.confirmPassword
      }));
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    // Final availability check (handles race conditions / missed blur)
    const usernameIsValid = validateUsername(formData.username).valid;
    if (usernameIsValid) {
      const available = await checkUsernameAvailability(formData.username);
      if (!available) {
        setFieldTouched(prev => ({ ...prev, username: true }));
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      // Register user with role=null - they'll select role after email confirmation
      await register(formData.email, formData.password, {
        fullName: formData.fullName,
        displayName: formData.fullName,
        username: formData.username.trim().toLowerCase()
        // No role specified - will be NULL in database
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
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
            After confirming your email, you'll choose your role (Investor or Creator) to get started.
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
          <label htmlFor="username">Username *</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            onBlur={(e) => {
              handleBlur(e);
              const isValid = validateUsername(e.target.value).valid;
              if (isValid) checkUsernameAvailability(e.target.value);
            }}
            className={validationErrors.username ? 'error' : ''}
            placeholder="Choose a unique username"
            autoComplete="username"
            disabled={isSubmitting}
            maxLength={20}
          />
          {validationErrors.username && (
            <span className="field-error">{validationErrors.username}</span>
          )}
          {!validationErrors.username && formData.username.trim() && (
            <small className="field-hint">
              {usernameStatus.checking
                ? 'Checking availability...'
                : usernameStatus.available === true
                  ? 'Username is available'
                  : usernameStatus.available === false
                    ? 'Username is already taken'
                    : '3-20 chars, letters/numbers/dash/underscore'}
            </small>
          )}
          {!formData.username.trim() && (
            <small className="field-hint">3-20 chars, letters/numbers/dash/underscore</small>
          )}
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
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              onBlur={handleBlur}
              className={validationErrors.password ? 'error' : ''}
              placeholder="Create a strong password"
              autoComplete="new-password"
              disabled={isSubmitting}
              style={{ paddingRight: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                color: '#718096',
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
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
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              onBlur={handleBlur}
              className={validationErrors.confirmPassword ? 'error' : ''}
              placeholder="Confirm your password"
              autoComplete="new-password"
              disabled={isSubmitting}
              style={{ paddingRight: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                color: '#718096',
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
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