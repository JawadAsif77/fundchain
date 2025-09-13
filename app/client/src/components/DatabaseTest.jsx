import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DatabaseTest = () => {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch auth users (this might not work due to RLS policies)
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      // Fetch user profiles from your custom users table
      const { data: profilesData, error: profilesError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Profiles error:', profilesError);
        setError(`Profiles error: ${profilesError.message}`);
      } else {
        setProfiles(profilesData || []);
      }

      if (authError) {
        console.log('Auth users not accessible (normal for security)');
      } else {
        setUsers(authUsers?.users || []);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('count', { count: 'exact' });
      
      if (error) {
        alert(`Connection Error: ${error.message}`);
      } else {
        alert(`✅ Database Connected! Found ${data.length} records in users table`);
      }
    } catch (err) {
      alert(`❌ Connection Failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h3>🔄 Loading database data...</h3>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f8f9fa', 
      borderRadius: '8px', 
      margin: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>
        🗄️ Database Test Results
      </h2>

      <button 
        onClick={testConnection}
        style={{
          backgroundColor: '#29C7AC',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        Test Database Connection
      </button>

      {error && (
        <div style={{ 
          backgroundColor: '#fee', 
          color: '#c33', 
          padding: '10px', 
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          Error: {error}
        </div>
      )}

      {/* User Profiles from custom users table */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#555' }}>👥 User Profiles ({profiles.length} found)</h3>
        {profiles.length > 0 ? (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '15px', 
            borderRadius: '5px',
            border: '1px solid #ddd'
          }}>
            {profiles.map((profile, index) => (
              <div key={profile.id || index} style={{ 
                marginBottom: '10px', 
                padding: '10px',
                backgroundColor: '#f9f9f9',
                borderRadius: '3px'
              }}>
                <strong>ID:</strong> {profile.id}<br/>
                <strong>Name:</strong> {profile.full_name || 'Not provided'}<br/>
                <strong>Email:</strong> {profile.email || 'Not provided'}<br/>
                <strong>Created:</strong> {new Date(profile.created_at).toLocaleString()}<br/>
                <strong>Role:</strong> {profile.role || 'investor'}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#666' }}>No user profiles found in the users table.</p>
        )}
      </div>

      {/* Auth Users (might not be accessible) */}
      <div>
        <h3 style={{ color: '#555' }}>🔐 Auth Users ({users.length} found)</h3>
        {users.length > 0 ? (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '15px', 
            borderRadius: '5px',
            border: '1px solid #ddd'
          }}>
            {users.map((user, index) => (
              <div key={user.id || index} style={{ 
                marginBottom: '10px', 
                padding: '10px',
                backgroundColor: '#f9f9f9',
                borderRadius: '3px'
              }}>
                <strong>ID:</strong> {user.id}<br/>
                <strong>Email:</strong> {user.email}<br/>
                <strong>Created:</strong> {new Date(user.created_at).toLocaleString()}<br/>
                <strong>Confirmed:</strong> {user.email_confirmed_at ? '✅ Yes' : '❌ No'}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#666' }}>Auth users not accessible (normal for security reasons)</p>
        )}
      </div>

      <div style={{ marginTop: '20px', fontSize: '0.9rem', color: '#666' }}>
        <strong>Note:</strong> After creating a new account, refresh this page to see updated data.
      </div>
    </div>
  );
};

export default DatabaseTest;