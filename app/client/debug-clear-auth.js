// Debug helper to completely clear all authentication state
// Run this in browser console if you get stuck in auth state issues

(function clearAllAuthState() {
  console.log('🧹 Clearing all authentication state...');
  
  // Clear localStorage
  localStorage.removeItem('pendingUserProfile');
  localStorage.removeItem('supabase.auth.token');
  localStorage.removeItem('fundchain-theme');
  
  // Clear sessionStorage
  sessionStorage.clear();
  
  // Clear all cookies for localhost
  document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
  
  console.log('✅ All authentication state cleared. Reloading page...');
  
  // Force reload
  window.location.href = '/';
})();

// Usage: Copy and paste this entire block into browser console when stuck