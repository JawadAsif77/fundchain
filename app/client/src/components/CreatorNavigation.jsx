import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const CreatorNavigation = () => {
  const location = useLocation();

  const isActiveLink = (path) => {
    return location.pathname.startsWith(path);
  };

  const navItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: '📊',
      available: true
    },
    {
      label: 'My Projects',
      path: '/my-projects',
      icon: '🚀',
      available: false // We'll implement this later
    },
    {
      label: 'Create Project',
      path: '/create-project',
      icon: '➕',
      available: true
    },
    {
      label: 'Analytics',
      path: '/analytics',
      icon: '📈',
      available: false
    },
    {
      label: 'Wallet',
      path: '/wallet',
      icon: '💳',
      available: false
    },
    {
      label: 'Team',
      path: '/team',
      icon: '👥',
      available: false
    },
    {
      label: 'Profile',
      path: '/profile',
      icon: '👤',
      available: true
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: '⚙️',
      available: false
    }
  ];

  return (
    <div style={{
      backgroundColor: 'var(--color-bg)',
      borderBottom: '1px solid var(--color-border)',
      padding: '0.75rem 0'
    }}>
      <div className="container">
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          overflowX: 'auto',
          paddingBottom: '0.25rem'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'var(--color-text-secondary)',
            whiteSpace: 'nowrap',
            marginRight: '0.5rem'
          }}>
            Creator Tools:
          </div>
          
          {navItems.map((item) => (
            item.available ? (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  backgroundColor: isActiveLink(item.path) ? 'var(--color-primary)' : 'transparent',
                  color: isActiveLink(item.path) ? 'white' : 'var(--color-text)',
                  border: isActiveLink(item.path) ? 'none' : '1px solid var(--color-border)'
                }}
                onMouseEnter={(e) => {
                  if (!isActiveLink(item.path)) {
                    e.target.style.backgroundColor = 'var(--color-bg-secondary)';
                    e.target.style.borderColor = 'var(--color-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActiveLink(item.path)) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.borderColor = 'var(--color-border)';
                  }
                }}
              >
                <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.path}
                disabled
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  cursor: 'not-allowed',
                  opacity: '0.6'
                }}
                title="Coming soon"
              >
                <span style={{ fontSize: '1rem', opacity: '0.5' }}>{item.icon}</span>
                {item.label}
                <span style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}>🔒</span>
              </button>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

export default CreatorNavigation;