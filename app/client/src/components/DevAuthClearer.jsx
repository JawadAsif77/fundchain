import React from 'react';
import { useAuth } from '../store/AuthContext';

// Development component to help with authentication testing
// Only shows in development mode
const DevAuthClearer = () => {
  const { logout } = useAuth();

  // Only show in development
  if (import.meta.env.PROD) return null;

  const handleClearAllAuth = async () => {
    console.log('🧹 Developer: Clearing all authentication data...');
    
    try {
      // Use the enhanced logout function
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
      
      // Emergency manual clear if logout fails
      try {
        // Clear all localStorage
        const localStorageKeys = Object.keys(localStorage);
        localStorageKeys.forEach(key => {
          localStorage.removeItem(key);
        });
        
        // Clear sessionStorage
        sessionStorage.clear();
        
        // Clear cookies
        document.cookie.split(";").forEach(function(c) { 
          const cookieName = c.split("=")[0].trim();
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        });
        
        console.log('✅ Manual clear completed');
        window.location.replace('/');
      } catch (manualError) {
        console.error('Manual clear also failed:', manualError);
      }
    }
  };

  const handleHardRefresh = () => {
    console.log('🔄 Developer: Performing hard refresh...');
    window.location.reload(true);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
      backgroundColor: '#ff4444',
      color: 'white',
      padding: '10px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      border: '2px solid #cc0000',
      boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
    }}>
      <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
        🚨 DEV TOOLS
      </div>
      <button
        onClick={handleClearAllAuth}
        style={{
          backgroundColor: '#cc0000',
          color: 'white',
          border: 'none',
          padding: '6px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px',
          marginRight: '5px',
          marginBottom: '5px'
        }}
        title="Clear all authentication data and logout"
      >
        🧹 Clear Auth
      </button>
      <button
        onClick={handleHardRefresh}
        style={{
          backgroundColor: '#006600',
          color: 'white',
          border: 'none',
          padding: '6px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px',
          marginBottom: '5px'
        }}
        title="Hard refresh the page"
      >
        🔄 Hard Refresh
      </button>
    </div>
  );
};

export default DevAuthClearer;