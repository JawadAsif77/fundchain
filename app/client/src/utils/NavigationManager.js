import { useRef, useCallback } from 'react';

/**
 * Navigation manager to prevent conflicts and loops
 */
class NavigationManager {
  constructor() {
    this.isNavigating = false;
    this.lastNavigation = null;
    this.navigationTimeout = null;
  }

  // Prevent rapid successive navigations
  canNavigate(path) {
    const now = Date.now();
    
    // Allow navigation if enough time has passed or different path
    if (this.lastNavigation && 
        this.lastNavigation.path === path && 
        (now - this.lastNavigation.timestamp) < 1000) {
      console.warn(`NavigationManager: Preventing rapid navigation to ${path}`);
      return false;
    }
    
    return true;
  }

  // Safe navigation with conflict prevention
  navigate(navigate, path, options = {}) {
    if (!this.canNavigate(path)) {
      return false;
    }

    // Clear any existing timeout
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }

    // Set navigation flag
    this.isNavigating = true;
    this.lastNavigation = {
      path,
      timestamp: Date.now()
    };

    console.log(`NavigationManager: Navigating to ${path}`, options);

    try {
      navigate(path, { replace: true, ...options });
      
      // Reset flag after a delay
      this.navigationTimeout = setTimeout(() => {
        this.isNavigating = false;
      }, 500);
      
      return true;
    } catch (error) {
      console.error('NavigationManager: Navigation failed', error);
      this.isNavigating = false;
      return false;
    }
  }

  // Check if currently navigating
  isCurrentlyNavigating() {
    return this.isNavigating;
  }

  // Reset navigation state
  reset() {
    this.isNavigating = false;
    this.lastNavigation = null;
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
      this.navigationTimeout = null;
    }
  }
}

// Global instance
const globalNavigationManager = new NavigationManager();

/**
 * Custom hook for safe navigation
 */
export const useSafeNavigation = () => {
  const managerRef = useRef(globalNavigationManager);

  const safeNavigate = useCallback((navigate, path, options = {}) => {
    return managerRef.current.navigate(navigate, path, options);
  }, []);

  const canNavigate = useCallback((path) => {
    return managerRef.current.canNavigate(path);
  }, []);

  const isNavigating = useCallback(() => {
    return managerRef.current.isCurrentlyNavigating();
  }, []);

  const resetNavigation = useCallback(() => {
    managerRef.current.reset();
  }, []);

  return {
    safeNavigate,
    canNavigate,
    isNavigating,
    resetNavigation
  };
};

export default NavigationManager;