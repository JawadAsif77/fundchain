/**
 * Calculate password strength based on various criteria
 * @param {string} password - The password to evaluate
 * @returns {Object} - { strength: 'weak'|'medium'|'strong', score: number, feedback: string }
 */
export const calculatePasswordStrength = (password) => {
  if (!password) {
    return { strength: 'weak', score: 0, feedback: 'Enter a password' };
  }

  let score = 0;
  const feedback = [];

  // Length checks
  if (password.length >= 8) score += 1;
  if (password.length >= 10) score += 1;
  if (password.length >= 12) score += 1;

  // Character variety checks
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Add lowercase letters');
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Add uppercase letters');
  }

  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('Add numbers');
  }

  if (/[@$!%*?&#^()_+\-=\[\]{}|;:'",.<>?/\\]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Add special characters');
  }

  // Penalty for common patterns
  if (/^(123|abc|qwe|password|admin)/i.test(password)) {
    score -= 2;
    feedback.push('Avoid common patterns');
  }

  // Determine strength level
  let strength = 'weak';
  let feedbackMessage = '';

  if (score <= 3) {
    strength = 'weak';
    feedbackMessage = feedback.length > 0 
      ? feedback.slice(0, 2).join(', ') 
      : 'Password is too weak';
  } else if (score <= 5) {
    strength = 'medium';
    feedbackMessage = feedback.length > 0 
      ? 'Add more variety for stronger security' 
      : 'Good, but could be stronger';
  } else {
    strength = 'strong';
    feedbackMessage = 'Strong password!';
  }

  return { strength, score, feedback: feedbackMessage };
};
