import React from 'react';

const TestApp = () => {
  console.log('TestApp rendering...');
  
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1 style={{ color: '#333' }}>FundChain Test App</h1>
      <p style={{ color: '#666' }}>If you can see this, React is working!</p>
      <p style={{ fontSize: '12px', color: '#999' }}>
        Current time: {new Date().toLocaleString()}
      </p>
    </div>
  );
};

export default TestApp;