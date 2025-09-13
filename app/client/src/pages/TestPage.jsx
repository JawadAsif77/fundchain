import React from 'react';

const TestPage = () => {
  console.log('TestPage component is rendering');
  
  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #29C7AC, #0B132B)', 
      color: 'white', 
      minHeight: '100vh', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '2rem' }}>
        🚀 React App is Working!
      </h1>
      
      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto', 
        background: 'rgba(255,255,255,0.1)', 
        padding: '2rem', 
        borderRadius: '10px'
      }}>
        <h2>✅ Basic Tests:</h2>
        <ul style={{ fontSize: '1.2rem', lineHeight: '2' }}>
          <li>React Components: Working</li>
          <li>CSS Styling: Working</li>
          <li>JavaScript: Working</li>
          <li>Port: {window.location.port}</li>
        </ul>
        
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button 
            onClick={() => alert('Button clicked! JavaScript is working.')}
            style={{ 
              padding: '15px 30px', 
              fontSize: '1.1rem', 
              background: '#29C7AC', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer'
            }}
          >
            Test JavaScript
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestPage;