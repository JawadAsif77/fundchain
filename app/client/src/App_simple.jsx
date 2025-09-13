import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Simple Supabase test component
const SupabaseTest = () => {
  const [status, setStatus] = useState('Testing Supabase...');
  const [authTest, setAuthTest] = useState('Testing Auth...');
  
  useEffect(() => {
    const testSupabase = async () => {
      try {
        // Test environment variables
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!url || !key) {
          setStatus('❌ Environment variables missing');
          return;
        }
        
        // Test API connection
        const response = await fetch(`${url}/rest/v1/`, {
          headers: {
            'Authorization': `Bearer ${key}`,
            'apikey': key
          }
        });
        
        if (response.ok) {
          setStatus('✅ Supabase connected successfully!');
        } else {
          setStatus(`❌ API Error: ${response.status}`);
        }
        
        // Test auth endpoint
        const authResponse = await fetch(`${url}/auth/v1/user`, {
          headers: {
            'Authorization': `Bearer ${key}`,
            'apikey': key
          }
        });
        
        if (authResponse.status === 401) {
          setAuthTest('✅ Auth endpoint working (no user logged in)');
        } else if (authResponse.ok) {
          setAuthTest('✅ Auth endpoint working');
        } else {
          setAuthTest(`❌ Auth Error: ${authResponse.status}`);
        }
        
      } catch (error) {
        setStatus(`❌ Connection failed: ${error.message}`);
      }
    };
    
    testSupabase();
  }, []);
  
  return (
    <div style={{
      background: 'rgba(255,255,255,0.2)',
      padding: '1rem',
      borderRadius: '8px',
      margin: '2rem 0',
      border: '2px solid rgba(255,255,255,0.3)',
      textAlign: 'left'
    }}>
      <h3>🧪 Supabase Status</h3>
      <p><strong>API:</strong> {status}</p>
      <p><strong>Auth:</strong> {authTest}</p>
    </div>
  );
};

// Simple Auth Form Test
const SimpleAuthTest = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const testSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage('Please enter email and password');
      return;
    }
    
    setLoading(true);
    setMessage('Testing registration...');
    
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'apikey': key
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage('✅ Registration successful! Check your email for confirmation.');
      } else {
        setMessage(`❌ Registration failed: ${data.msg || data.error_description || 'Unknown error'}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{
      background: 'rgba(255,255,255,0.2)',
      padding: '2rem',
      borderRadius: '8px',
      margin: '2rem 0',
      border: '2px solid rgba(255,255,255,0.3)',
      maxWidth: '400px',
      margin: '2rem auto'
    }}>
      <h3>🔐 Test Registration</h3>
      <form onSubmit={testSignUp} style={{ textAlign: 'left' }}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="email"
            placeholder="test@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px', 
              borderRadius: '4px', 
              border: 'none',
              fontSize: '16px'
            }}
            disabled={loading}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="password"
            placeholder="password123"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px', 
              borderRadius: '4px', 
              border: 'none',
              fontSize: '16px'
            }}
            disabled={loading}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: '#0B132B', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test Sign Up'}
        </button>
      </form>
      {message && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '10px', 
          background: 'rgba(255,255,255,0.1)', 
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

// Simple pages without complex imports
const SimplePage = ({ title, color = '#29C7AC', showSupabase = false, showAuth = false }) => (
  <div style={{ 
    background: color, 
    color: 'white', 
    padding: '50px', 
    textAlign: 'center',
    minHeight: '100vh'
  }}>
    <h1 style={{ fontSize: '3rem', marginBottom: '2rem' }}>{title}</h1>
    <p style={{ fontSize: '1.2rem' }}>Page is working! ✅</p>
    {showSupabase && <SupabaseTest />}
    {showAuth && <SimpleAuthTest />}
  </div>
);

const Home = () => <SimplePage title="🏠 Investment Platform" color="#29C7AC" showSupabase={true} />;
const Login = () => <SimplePage title="🔐 Login & Auth Test" color="#0B132B" showAuth={true} />;
const Dashboard = () => <SimplePage title="📊 Dashboard" color="#8B5CF6" />;

function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<SimplePage title="404 - Page Not Found" color="#EF4444" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;