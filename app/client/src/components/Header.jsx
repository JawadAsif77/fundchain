import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { supabase } from '../lib/supabase';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile, logout, validateSession } = useAuth();
  const location = useLocation();

  // Session health monitor - optimized to prevent interference
  useEffect(() => {
    if (!user) return;

    // Check session health every 10 minutes (reduced frequency)
    const sessionCheck = setInterval(async () => {
      try {
        // Only check if tab is visible to prevent unnecessary API calls
        if (document.hidden) return;
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          console.warn('Header: Session invalid, logging out user');
          logout();
          return;
        }
        
        // Refresh only when expired; avoid proactive refresh races
        const expiresAt = session.expires_at * 1000;
        if (expiresAt <= Date.now()) {
          console.log('Header: Token expired, attempting refresh...');
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('Header: Token refresh failed:', refreshError);
          }
        }
      } catch (error) {
        console.error('Header: Session check failed:', error);
      }
    }, 10 * 60 * 1000); // Check every 10 minutes (reduced frequency)

    return () => clearInterval(sessionCheck);
  }, [user, logout]);

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
          <nav className="desktop-nav">
            <Link 
              to="/explore" 
              style={{
                color: isActiveLink('/explore') ? 'var(--color-primary)' : 'var(--color-text)',
                fontWeight: 'var(--font-semibold)',
                padding: 'var(--space-2) 0',
                textDecoration: 'none',
                transition: 'var(--transition-default)',
                position: 'relative'
              }}
            >
              Opportunities
            </Link>
            
            {/* Navigation Links - always visible */}
            <a 
              href={location.pathname === '/' ? "#how-it-works" : "/#how-it-works"}
              onClick={location.pathname === '/' ? (e) => handleAnchorClick(e, 'how-it-works') : undefined}
              style={{
                color: 'var(--color-text)',
                fontWeight: 'var(--font-semibold)',
                padding: 'var(--space-2) 0',
                textDecoration: 'none',
                transition: 'var(--transition-default)'
              }}
            >
              How it Works
            </a>
            <a 
              href="#governance"
              style={{
                color: 'var(--color-text)',
                fontWeight: 'var(--font-semibold)',
                padding: 'var(--space-2) 0',
                textDecoration: 'none',
                transition: 'var(--transition-default)',
                cursor: 'pointer'
              }}
            >
              Governance
            </a>
            <a 
              href="#analytics"
              style={{
                color: 'var(--color-text)',
                fontWeight: 'var(--font-semibold)',
                padding: 'var(--space-2) 0',
                textDecoration: 'none',
                transition: 'var(--transition-default)',
                cursor: 'pointer'
              }}
            >
              Analytics
            </a>
            
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
            {user && (
              <Link
                to="/wallet"
                style={{
                  color: isActiveLink('/wallet') ? 'var(--color-primary)' : 'var(--color-text)',
                  fontWeight: 'var(--font-semibold)',
                  padding: 'var(--space-2) 0',
                  textDecoration: 'none',
                  transition: 'var(--transition-default)'
                }}
              >
                Wallet
              </Link>
            )}
            {user && profile?.role === 'admin' && (
              <Link
                to="/admin"
                style={{
                  color: isActiveLink('/admin') ? 'var(--color-primary)' : 'var(--color-text)',
                  fontWeight: 'var(--font-semibold)',
                  padding: 'var(--space-2) 0',
                  textDecoration: 'none',
                  transition: 'var(--transition-default)'
                }}
              >
                Admin
              </Link>
            )}
            {user && (
              <Link
                to="/profile"
                style={{
                  color: isActiveLink('/profile') ? 'var(--color-primary)' : 'var(--color-text)',
                  fontWeight: 'var(--font-semibold)',
                  padding: 'var(--space-2) 0',
                  textDecoration: 'none',
                  transition: 'var(--transition-default)'
                }}
              >
                👤 Profile
              </Link>
            )}
          </nav>

          {/* Auth Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)'
          }}>
            {user ? (
              <>
                <span style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-muted)',
                  display: 'none'
                }} className="md:block">
                  Welcome, {user.displayName}
                </span>
                <Link
                  to="/profile"
                  className="btn btn--ghost btn--sm"
                  onClick={closeMobileMenu}
                >
                  👤 Profile
                </Link>
                <Link
                  to="/wallet"
                  className="btn btn--ghost btn--sm"
                  onClick={closeMobileMenu}
                >
                  💼 Wallet
                </Link>
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
              className="mobile-menu-btn"
              style={{
                background: 'none',
                border: 'none',
                padding: 'var(--space-2)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-default)'
              }}
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
                Opportunities
              </Link>
              <a 
                href={location.pathname === '/' ? "#how-it-works" : "/#how-it-works"}
                onClick={(e) => {
                  closeMobileMenu();
                  if (location.pathname === '/') {
                    handleAnchorClick(e, 'how-it-works');
                  }
                }}
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
                How it Works
              </a>
              <a 
                href="#governance"
                onClick={closeMobileMenu}
                style={{
                  padding: 'var(--space-3) 0',
                  borderBottom: '1px solid var(--color-border-light)',
                  color: 'var(--color-text)',
                  textDecoration: 'none',
                  fontSize: 'var(--text-md)',
                  fontWeight: 'var(--font-semibold)',
                  transition: 'var(--transition-default)',
                  cursor: 'pointer'
                }}
              >
                Governance
              </a>
              <a 
                href="#analytics"
                onClick={closeMobileMenu}
                style={{
                  padding: 'var(--space-3) 0',
                  borderBottom: '1px solid var(--color-border-light)',
                  color: 'var(--color-text)',
                  textDecoration: 'none',
                  fontSize: 'var(--text-md)',
                  fontWeight: 'var(--font-semibold)',
                  transition: 'var(--transition-default)',
                  cursor: 'pointer'
                }}
              >
                Analytics
              </a>
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
              {user && (
                <Link
                  to="/wallet"
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
                  💼 Wallet
                </Link>
              )}
              {user && profile?.role === 'admin' && (
                <Link
                  to="/admin"
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
                  Admin
                </Link>
              )}
              {user && (
                <Link
                  to="/profile"
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
                  👤 Profile
                </Link>
              )}
              
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