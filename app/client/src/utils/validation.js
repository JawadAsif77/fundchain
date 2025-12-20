/**
 * Comprehensive validation utilities for form inputs
 */

// Validation patterns
const patterns = {
  email: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  username: /^[a-zA-Z0-9_-]{3,20}$/,
  name: /^[a-zA-Z\s'-]{2,50}$/,
  phone: /^[+]?[\d\s-]{10,15}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  alphaNumeric: /^[a-zA-Z0-9]+$/,
  alphabetic: /^[a-zA-Z\s]+$/,
  numeric: /^\d+$/,
  decimal: /^\d*\.?\d+$/,
  url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
};

// Error messages
const errorMessages = {
  email: 'Please enter a valid email address',
  username: 'Username must be 3-20 characters and contain only letters, numbers, dash, or underscore',
  name: 'Name must be 2-50 characters and contain only letters, spaces, hyphens, or apostrophes',
  phone: 'Please enter a valid phone number',
  password: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
  required: 'This field is required',
  minLength: (min) => `Must be at least ${min} characters`,
  maxLength: (max) => `Must not exceed ${max} characters`,
  numeric: 'Please enter numbers only',
  alphabetic: 'Please enter letters only',
  alphaNumeric: 'Please enter letters and numbers only',
  decimal: 'Please enter a valid number',
  url: 'Please enter a valid URL',
  match: 'Fields do not match',
  unique: 'This value is already taken',
};

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  if (!email) return { valid: false, error: errorMessages.required };
  if (!patterns.email.test(email.trim())) {
    return { valid: false, error: errorMessages.email };
  }
  return { valid: true, error: null };
};

/**
 * Validate username format
 */
export const validateUsername = (username) => {
  if (!username) return { valid: false, error: errorMessages.required };
  if (!patterns.username.test(username.trim())) {
    return { valid: false, error: errorMessages.username };
  }
  return { valid: true, error: null };
};

/**
 * Validate name (first name, last name, full name)
 */
export const validateName = (name) => {
  if (!name) return { valid: false, error: errorMessages.required };
  if (!patterns.name.test(name.trim())) {
    return { valid: false, error: errorMessages.name };
  }
  return { valid: true, error: null };
};

/**
 * Validate phone number
 */
export const validatePhone = (phone) => {
  if (!phone) return { valid: false, error: errorMessages.required };
  if (!patterns.phone.test(phone.trim())) {
    return { valid: false, error: errorMessages.phone };
  }
  return { valid: true, error: null };
};

/**
 * Validate password strength
 */
export const validatePassword = (password) => {
  if (!password) return { valid: false, error: errorMessages.required };
  if (password.length < 8) {
    return { valid: false, error: errorMessages.minLength(8) };
  }
  if (!patterns.password.test(password)) {
    return { valid: false, error: errorMessages.password };
  }
  return { valid: true, error: null };
};

/**
 * Validate password confirmation
 */
export const validatePasswordMatch = (password, confirmPassword) => {
  if (!confirmPassword) return { valid: false, error: errorMessages.required };
  if (password !== confirmPassword) {
    return { valid: false, error: errorMessages.match };
  }
  return { valid: true, error: null };
};

/**
 * Validate numeric input
 */
export const validateNumeric = (value, required = true) => {
  if (!value && !required) return { valid: true, error: null };
  if (!value && required) return { valid: false, error: errorMessages.required };
  if (!patterns.numeric.test(value.toString().trim())) {
    return { valid: false, error: errorMessages.numeric };
  }
  return { valid: true, error: null };
};

/**
 * Validate decimal number input
 */
export const validateDecimal = (value, required = true) => {
  if (!value && !required) return { valid: true, error: null };
  if (!value && required) return { valid: false, error: errorMessages.required };
  if (!patterns.decimal.test(value.toString().trim())) {
    return { valid: false, error: errorMessages.decimal };
  }
  return { valid: true, error: null };
};

/**
 * Validate alphabetic input
 */
export const validateAlphabetic = (value, required = true) => {
  if (!value && !required) return { valid: true, error: null };
  if (!value && required) return { valid: false, error: errorMessages.required };
  if (!patterns.alphabetic.test(value.trim())) {
    return { valid: false, error: errorMessages.alphabetic };
  }
  return { valid: true, error: null };
};

/**
 * Validate URL format
 */
export const validateUrl = (url, required = true) => {
  if (!url && !required) return { valid: true, error: null };
  if (!url && required) return { valid: false, error: errorMessages.required };
  if (!patterns.url.test(url.trim())) {
    return { valid: false, error: errorMessages.url };
  }
  return { valid: true, error: null };
};

/**
 * Validate required field
 */
export const validateRequired = (value) => {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return { valid: false, error: errorMessages.required };
  }
  return { valid: true, error: null };
};

/**
 * Validate minimum length
 */
export const validateMinLength = (value, min) => {
  if (!value) return { valid: false, error: errorMessages.required };
  if (value.trim().length < min) {
    return { valid: false, error: errorMessages.minLength(min) };
  }
  return { valid: true, error: null };
};

/**
 * Validate maximum length
 */
export const validateMaxLength = (value, max) => {
  if (value && value.trim().length > max) {
    return { valid: false, error: errorMessages.maxLength(max) };
  }
  return { valid: true, error: null };
};

/**
 * Sanitize input - remove invalid characters based on type
 */
export const sanitizeInput = {
  numeric: (value) => value.replace(/[^\d]/g, ''),
  decimal: (value) => value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'),
  alphabetic: (value) => value.replace(/[^a-zA-Z\s]/g, ''),
  alphaNumeric: (value) => value.replace(/[^a-zA-Z0-9]/g, ''),
  username: (value) => value.replace(/[^a-zA-Z0-9_-]/g, ''),
  name: (value) => value.replace(/[^a-zA-Z\s'-]/g, ''),
  phone: (value) => value.replace(/[^\d+\s-]/g, ''),
  email: (value) => value.replace(/[^a-zA-Z0-9@._-]/g, ''),
};

/**
 * Real-time input filter for preventing invalid characters
 */
export const createInputFilter = (type) => {
  return (e) => {
    const value = e.target.value;
    let filtered = value;

    switch (type) {
      case 'numeric':
        filtered = sanitizeInput.numeric(value);
        break;
      case 'decimal':
        filtered = sanitizeInput.decimal(value);
        break;
      case 'alphabetic':
        filtered = sanitizeInput.alphabetic(value);
        break;
      case 'alphaNumeric':
        filtered = sanitizeInput.alphaNumeric(value);
        break;
      case 'username':
        filtered = sanitizeInput.username(value);
        break;
      case 'name':
        filtered = sanitizeInput.name(value);
        break;
      case 'phone':
        filtered = sanitizeInput.phone(value);
        break;
      case 'email':
        filtered = sanitizeInput.email(value);
        break;
      default:
        break;
    }

    if (filtered !== value) {
      e.target.value = filtered;
    }
  };
};

/**
 * Validate entire form
 */
export const validateForm = (fields, values) => {
  const errors = {};
  let isValid = true;

  Object.keys(fields).forEach((fieldName) => {
    const field = fields[fieldName];
    const value = values[fieldName];

    if (field.required) {
      const result = validateRequired(value);
      if (!result.valid) {
        errors[fieldName] = result.error;
        isValid = false;
        return;
      }
    }

    if (field.type) {
      let result;
      switch (field.type) {
        case 'email':
          result = validateEmail(value);
          break;
        case 'username':
          result = validateUsername(value);
          break;
        case 'name':
          result = validateName(value);
          break;
        case 'phone':
          result = validatePhone(value);
          break;
        case 'password':
          result = validatePassword(value);
          break;
        case 'numeric':
          result = validateNumeric(value, field.required);
          break;
        case 'decimal':
          result = validateDecimal(value, field.required);
          break;
        case 'alphabetic':
          result = validateAlphabetic(value, field.required);
          break;
        case 'url':
          result = validateUrl(value, field.required);
          break;
        default:
          result = { valid: true, error: null };
      }

      if (!result.valid) {
        errors[fieldName] = result.error;
        isValid = false;
      }
    }

    if (field.minLength && value) {
      const result = validateMinLength(value, field.minLength);
      if (!result.valid) {
        errors[fieldName] = result.error;
        isValid = false;
      }
    }

    if (field.maxLength && value) {
      const result = validateMaxLength(value, field.maxLength);
      if (!result.valid) {
        errors[fieldName] = result.error;
        isValid = false;
      }
    }
  });

  return { isValid, errors };
};
