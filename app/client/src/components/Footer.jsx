import React from 'react';

const Footer = () => {
  return (
    <footer style={{
      backgroundColor: 'var(--color-bg-elev)',
      borderTop: '1px solid var(--color-border)',
      padding: 'var(--space-8) 0 var(--space-5) 0',
      marginTop: 'auto'
    }}>
      <div className="container">
        <div style={{
          textAlign: 'center',
          color: 'var(--color-muted)'
        }}>
          <p style={{
            margin: '0 0 var(--space-2) 0',
            fontSize: 'var(--text-sm)'
          }}>
            &copy; {new Date().getFullYear()} FundChain. All rights reserved.
          </p>
          <p style={{
            fontSize: 'var(--text-xs)',
            margin: 0,
            opacity: 0.8
          }}>
            Built with React + Vite. Phase 1: Frontend-only with mock data.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;