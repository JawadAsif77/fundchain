import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const location = useLocation();

  const isActiveLink = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // Handle smooth scroll for anchor links on home page
  const handleAnchorClick = (e, anchor) => {
    if (location.pathname === '/') {
      e.preventDefault();
      const element = document.getElementById(anchor);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 'var(--z-sticky)',
      backgroundColor: 'var(--color-bg)',
      borderBottom: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-sm)',
      backdropFilter: 'blur(20px)'
    }}>
      <div className="container">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '72px'
        }}>
          <Link 
            to="/" 
            onClick={closeMobileMenu}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              textDecoration: 'none'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              background: 'var(--gradient-primary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-card)'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
                <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--color-primary)'
            }} className="gradient-text">
              FundChain
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav style={{
            display: 'none',
            alignItems: 'center',
            gap: 'var(--space-6)'
          }} className="md:flex">
            <Link 
              to="/" 
              style={{
                color: isActiveLink('/') ? 'var(--color-primary)' : 'var(--color-text)',
                fontWeight: 'var(--font-semibold)',
                padding: 'var(--space-2) 0',
                textDecoration: 'none',
                transition: 'var(--transition-default)',
                position: 'relative'
              }}
            >
              Home
            </Link>
            <Link 
              to="/explore" 
              style={{
                color: isActiveLink('/explore') ? 'var(--color-primary)' : 'var(--color-text)',
                fontWeight: 'var(--font-semibold)',
                padding: 'var(--space-2) 0',
                textDecoration: 'none',
                transition: 'var(--transition-default)'
              }}
            >
              Explore
            </Link>
            
            {/* Anchor Links for Home Page */}
            {location.pathname === '/' && (
              <>
                <a 
                  href="#features"
                  onClick={(e) => handleAnchorClick(e, 'features')}
                  style={{
                    color: 'var(--color-text)',
                    fontWeight: 'var(--font-semibold)',
                    padding: 'var(--space-2) 0',
                    textDecoration: 'none',
                    transition: 'var(--transition-default)'
                  }}
                >
                  Features
                </a>
                <a 
                  href="#how-it-works"
                  onClick={(e) => handleAnchorClick(e, 'how-it-works')}
                  style={{
                    color: 'var(--color-text)',
                    fontWeight: 'var(--font-semibold)',
                    padding: 'var(--space-2) 0',
                    textDecoration: 'none',
                    transition: 'var(--transition-default)'
                  }}
                >
                  How It Works
                </a>
                <a 
                  href="#opportunities"
                  onClick={(e) => handleAnchorClick(e, 'opportunities')}
                  style={{
                    color: 'var(--color-text)',
                    fontWeight: 'var(--font-semibold)',
                    padding: 'var(--space-2) 0',
                    textDecoration: 'none',
                    transition: 'var(--transition-default)'
                  }}
                >
                  Opportunities
                </a>
              </>
            )}
            
            {user && (
              <Link 
                to="/dashboard" 
                style={{
                  color: isActiveLink('/dashboard') ? 'var(--color-primary)' : 'var(--color-text)',
                  fontWeight: 'var(--font-semibold)',
                  padding: 'var(--space-2) 0',
                  textDecoration: 'none',
                  transition: 'var(--transition-default)'
                }}
              >
                Dashboard
              </Link>
            )}
          </nav>

          {/* Auth Actions & Theme Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)'
          }}>
            {/* Dark Mode Toggle */}
            <button 
              className={`md:block theme-toggle ${isDark ? 'dark' : ''}`}
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                display: 'none'
              }}
            />

            {user ? (
              <>
                <span style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-muted)',
                  display: 'none'
                }} className="md:block">
                  Welcome, {user.displayName}
                </span>
                <button 
                  onClick={handleLogout}
                  className="btn btn--ghost btn--sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn--ghost btn--sm">
                  Login
                </Link>
                <Link to="/register" className="btn btn--gradient btn--sm">
                  Sign Up
                </Link>
              </>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'block',
                background: 'none',
                border: 'none',
                padding: 'var(--space-2)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-default)'
              }}
              className="md:hidden"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'var(--color-bg)',
            borderBottom: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-xl)',
            padding: 'var(--space-4)',
            zIndex: 'var(--z-dropdown)',
            backdropFilter: 'blur(20px)'
          }}>
            <nav style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)'
            }}>
              <Link 
                to="/" 
                onClick={closeMobileMenu}
                style={{
                  padding: 'var(--space-3) 0',
                  borderBottom: '1px solid var(--color-border-light)',
                  color: 'var(--color-text)',
                  textDecoration: 'none',
                  fontSize: 'var(--text-md)',
                  fontWeight: 'var(--font-semibold)',
                  transition: 'var(--transition-default)'
                }}
              >
                Home
              </Link>
              <Link 
                to="/explore" 
                onClick={closeMobileMenu}
                style={{
                  padding: 'var(--space-3) 0',
                  borderBottom: '1px solid var(--color-border-light)',
                  color: 'var(--color-text)',
                  textDecoration: 'none',
                  fontSize: 'var(--text-md)',
                  fontWeight: 'var(--font-semibold)',
                  transition: 'var(--transition-default)'
                }}
              >
                Explore
              </Link>
              {user && (
                <Link 
                  to="/dashboard" 
                  onClick={closeMobileMenu}
                  style={{
                    padding: 'var(--space-3) 0',
                    borderBottom: '1px solid var(--color-border-light)',
                    color: 'var(--color-text)',
                    textDecoration: 'none',
                    fontSize: 'var(--text-md)',
                    fontWeight: 'var(--font-semibold)',
                    transition: 'var(--transition-default)'
                  }}
                >
                  Dashboard
                </Link>
              )}
              
              {/* Mobile Theme Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3) 0',
                borderBottom: '1px solid var(--color-border-light)'
              }}>
                <span style={{
                  fontSize: 'var(--text-md)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--color-text)'
                }}>
                  Dark Mode
                </span>
                <button 
                  className={`theme-toggle ${isDark ? 'dark' : ''}`}
                  onClick={toggleTheme}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                />
              </div>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                paddingTop: 'var(--space-2)'
              }}>
                {user ? (
                  <button 
                    onClick={handleLogout}
                    className="btn btn--ghost"
                  >
                    Logout
                  </button>
                ) : (
                  <>
                    <Link to="/login" onClick={closeMobileMenu} className="btn btn--ghost">
                      Login
                    </Link>
                    <Link to="/register" onClick={closeMobileMenu} className="btn btn--gradient">
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;