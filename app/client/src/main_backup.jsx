import React from 'react'
import ReactDOM from 'react-dom/client'

const SimpleTest = () => {
  return (
    <div style={{ 
      background: 'red', 
      color: 'white', 
      padding: '50px', 
      fontSize: '30px',
      textAlign: 'center'
    }}>
      SIMPLE TEST - IF YOU SEE THIS, REACT IS WORKING!
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <SimpleTest />
)