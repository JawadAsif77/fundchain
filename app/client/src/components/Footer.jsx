import React from 'react';
import { Link } from 'react-router-dom';

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
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--space-8)',
          marginBottom: 'var(--space-8)'
        }}>
          {/* Brand Section */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-4)'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'var(--gradient-primary)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
                  <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-bold)',
                color: 'var(--color-primary)'
              }}>
                FundChain
              </span>
            </div>
            <p style={{
              color: 'var(--color-muted)',
              fontSize: 'var(--text-sm)',
              lineHeight: '1.6',
              margin: 0
            }}>
              Empowering smart, transparent, and secure investments through blockchain technology and AI-powered trust scoring.
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h4 style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--color-text)',
              marginBottom: 'var(--space-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Platform
            </h4>
            <nav style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}>
              <Link to="/explore" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                Explore Opportunities
              </Link>
              <Link to="/how-it-works" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                How It Works
              </Link>
              <Link to="/governance" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                Governance
              </Link>
              <Link to="/analytics" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                Analytics
              </Link>
              <Link to="/dashboard" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                Dashboard
              </Link>
              <Link to="/register" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                Get Started
              </Link>
            </nav>
          </div>

          {/* Resources */}
          <div>
            <h4 style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--color-text)',
              marginBottom: 'var(--space-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Resources
            </h4>
            <nav style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}>
              <a href="#documentation" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                Documentation
              </a>
              <a href="#api" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                API Reference
              </a>
              <a href="#support" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                Support Center
              </a>
              <a href="#security" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                Security
              </a>
            </nav>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--color-text)',
              marginBottom: 'var(--space-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Legal
            </h4>
            <nav style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)'
            }}>
              <a href="#privacy" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                Privacy Policy
              </a>
              <a href="#terms" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                Terms of Service
              </a>
              <a href="#compliance" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                Compliance
              </a>
              <a href="#cookies" style={{
                color: 'var(--color-muted)',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                transition: 'var(--transition-default)'
              }}>
                Cookie Policy
              </a>
            </nav>
          </div>
        </div>

        {/* Bottom Section */}
        <div style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: 'var(--space-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          {/* Social Links */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-4)',
            alignItems: 'center'
          }}>
            <a href="#twitter" style={{
              color: 'var(--color-muted)',
              transition: 'var(--transition-default)',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)'
            }}>
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="#linkedin" style={{
              color: 'var(--color-muted)',
              transition: 'var(--transition-default)',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)'
            }}>
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
            <a href="#discord" style={{
              color: 'var(--color-muted)',
              transition: 'var(--transition-default)',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)'
            }}>
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.120.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
            <a href="#github" style={{
              color: 'var(--color-muted)',
              transition: 'var(--transition-default)',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)'
            }}>
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </div>

          {/* Copyright */}
          <div style={{
            color: 'var(--color-muted)',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
            alignItems: 'center'
          }}>
            <p style={{ margin: 0 }}>
              &copy; {new Date().getFullYear()} FundChain. All rights reserved.
            </p>
            <p style={{
              margin: 0,
              fontSize: 'var(--text-xs)',
              opacity: 0.8
            }}>
              Powered by Solana blockchain • Built with React + Supabase • Phase 3: Full platform with AI integration
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;