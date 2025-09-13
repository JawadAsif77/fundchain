import React from 'react';
import SupabaseTest from '../components/SupabaseTest';

const Home = () => {
  return (
    <div>
      <SupabaseTest />
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Investment Platform</h1>
        <p>Testing basic page load...</p>
        <div style={{ marginTop: '20px' }}>
          <button>Test Button</button>
        </div>
      </div>
    </div>
  );
};

export default Home;