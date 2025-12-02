import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { supabase } from './lib/supabase.js'

console.log('main.jsx loading full App...');

// Add global error handler
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Fix 7: Add global fetch interceptor for connection errors
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  try {
    return await originalFetch(...args);
  } catch (error) {
    if (error.message?.includes('NetworkError') || 
        error.message?.includes('Failed to fetch')) {
      console.warn('[Fetch] Network error, will retry:', error);
      
      // Try to refresh Supabase session
      try {
        await supabase.auth.refreshSession();
      } catch (refreshError) {
        console.error('[Fetch] Session refresh failed:', refreshError);
      }
    }
    throw error;
  }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)