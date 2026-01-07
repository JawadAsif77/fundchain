import React from 'react';
import UserSearch from '../components/UserSearch';

const SearchUsers = () => {
  return (
    <div style={{ 
      minHeight: '80vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '40px 20px',
      background: 'linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)'
    }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '32px' 
        }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: '700', 
            color: '#1f2937',
            marginBottom: '8px' 
          }}>
            Find Users
          </h1>
          <p style={{ 
            fontSize: '16px', 
            color: '#6b7280' 
          }}>
            Discover creators and investors on FundChain
          </p>
        </div>
        <UserSearch />
      </div>
    </div>
  );
};

export default SearchUsers;
