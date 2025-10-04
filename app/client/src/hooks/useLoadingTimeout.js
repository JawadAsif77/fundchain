import { useEffect, useRef } from 'react';

/**
 * Custom hook to prevent infinite loading states
 * Automatically sets loading to false after a timeout
 * @param {boolean} loading - Current loading state
 * @param {function} setLoading - Function to set loading state
 * @param {number} timeout - Timeout in milliseconds (default: 3000)
 * @param {string} debugName - Name for debugging purposes
 */
export const useLoadingTimeout = (loading, setLoading, timeout = 3000, debugName = 'Component') => {
  const timeoutRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (loading) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          console.warn(`${debugName}: Loading timeout reached (${timeout}ms), forcing loading to false`);
          setLoading(false);
        }
      }, timeout);
    } else {
      // Clear timeout when loading becomes false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loading, setLoading, timeout, debugName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
};

/**
 * Custom hook for managed async operations with automatic timeout
 * @param {function} asyncOperation - The async function to execute
 * @param {array} dependencies - useEffect dependencies
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @param {string} debugName - Name for debugging purposes
 */
export const useManagedAsync = (asyncOperation, dependencies = [], timeout = 5000, debugName = 'AsyncOperation') => {
  const mountedRef = useRef(true);
  const timeoutRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    
    const executeOperation = async () => {
      // Set timeout for the operation
      timeoutRef.current = setTimeout(() => {
        if (mounted) {
          console.warn(`${debugName}: Async operation timeout reached (${timeout}ms)`);
        }
      }, timeout);

      try {
        await asyncOperation(mounted);
      } catch (error) {
        if (mounted) {
          console.error(`${debugName}: Async operation failed:`, error);
        }
      } finally {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    executeOperation();

    return () => {
      mounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, dependencies);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
};

export default useLoadingTimeout;