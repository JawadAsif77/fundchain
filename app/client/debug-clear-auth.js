// Debug helper to completely clear all authentication state
// Run this in browser console if you get stuck in auth state issues

(async function clearAllAuthState() {
  console.log('🧹 Starting complete authentication state cleanup...');
  
  // Clear ALL localStorage keys
  try {
    const localStorageKeys = Object.keys(localStorage);
    console.log('📦 Found localStorage keys:', localStorageKeys);
    
    localStorageKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🗑️ Removed localStorage: ${key}`);
    });
  } catch (error) {
    console.warn('Error clearing localStorage:', error);
  }
  
  // Clear ALL sessionStorage
  try {
    sessionStorage.clear();
    console.log('🗑️ Cleared all sessionStorage');
  } catch (error) {
    console.warn('Error clearing sessionStorage:', error);
  }
  
  // Clear ALL cookies
  try {
    document.cookie.split(";").forEach(function(c) { 
      const cookieName = c.split("=")[0].trim();
      // Clear for multiple domains/paths
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.localhost;`;
      console.log(`🍪 Cleared cookie: ${cookieName}`);
    });
  } catch (error) {
    console.warn('Error clearing cookies:', error);
  }
  
  // Clear caches
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log('💾 Found caches:', cacheNames);
      
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log(`🗑️ Deleting cache: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
    }
  } catch (error) {
    console.warn('Error clearing caches:', error);
  }
  
  // Clear IndexedDB
  try {
    if ('indexedDB' in window) {
      const databases = await indexedDB.databases();
      console.log('🗄️ Found IndexedDB databases:', databases);
      
      databases.forEach(db => {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
          console.log(`🗑️ Deleting IndexedDB: ${db.name}`);
        }
      });
    }
  } catch (error) {
    console.warn('Error clearing IndexedDB:', error);
  }
  
  console.log('✅ Complete authentication cleanup finished!');
  console.log('🔄 Reloading page in 2 seconds...');
  
  setTimeout(() => {
    window.location.replace('/');
  }, 2000);
})();
  
  // Force reload
  window.location.href = '/';
})();

// Usage: Copy and paste this entire block into browser console when stuck