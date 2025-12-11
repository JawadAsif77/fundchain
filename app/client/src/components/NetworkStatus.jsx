import React, { useState, useEffect } from 'react';

const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showOffline && isOnline) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: isOnline ? '#10b981' : '#ef4444',
      color: 'white',
      padding: '8px 16px',
      textAlign: 'center',
      zIndex: 9999,
      fontSize: '14px',
      fontWeight: 500
    }}>
      {isOnline ? '✓ Back online' : '⚠ No internet connection'}
    </div>
  );
};

export default NetworkStatus;
