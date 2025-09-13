import React, { useEffect, useState } from 'react';

const SupabaseTest = () => {
  const [envTest, setEnvTest] = useState('Checking...');
  const [connection, setConnection] = useState('Testing...');

  useEffect(() => {
    // Test environment variables first
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      setEnvTest(`❌ Missing env vars - URL: ${!!url}, Key: ${!!key}`);
      setConnection('❌ Cannot test - missing credentials');
      return;
    } else {
      setEnvTest('✅ Environment variables loaded');
    }

    // Test basic connection without importing supabase (in case that's the issue)
    const testConnection = async () => {
      try {
        const response = await fetch(`${url}/rest/v1/`, {
          headers: {
            'Authorization': `Bearer ${key}`,
            'apikey': key
          }
        });
        
        if (response.ok) {
          setConnection('✅ Basic Supabase connection successful');
        } else {
          setConnection(`❌ Connection failed: ${response.status}`);
        }
      } catch (error) {
        setConnection(`❌ Connection error: ${error.message}`);
      }
    };

    testConnection();
  }, []);

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      padding: '15px', 
      border: '2px solid #29C7AC', 
      borderRadius: '8px',
      fontSize: '12px',
      maxWidth: '350px',
      zIndex: 9999,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      fontFamily: 'monospace'
    }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#0B132B' }}>🧪 Debug Panel</h4>
      <div style={{ marginBottom: '8px' }}><strong>Env:</strong> {envTest}</div>
      <div style={{ marginBottom: '8px' }}><strong>API:</strong> {connection}</div>
      <div style={{ fontSize: '10px', color: '#666', marginTop: '10px' }}>
        URL: {import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing'}<br/>
        Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing'}
      </div>
    </div>
  );
};

export default SupabaseTest;