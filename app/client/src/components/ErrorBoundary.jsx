import React from 'react';
import { clearAllAuthArtifacts } from '../utils/authStorage.js';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Enhanced error logging with more context
    console.error('🚨 ErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    
    // Check for specific loading-related errors
    if (error.message?.includes('Maximum update depth') || 
        error.message?.includes('infinite loop') ||
        error.message?.includes('Cannot update a component while rendering')) {
      console.error('🔄 Detected potential infinite rendering loop');
    }

    this.setState({
      error,
      errorInfo,
      hasError: true
    });
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReset = async () => {
    try {
      await clearAllAuthArtifacts();
      console.log('✅ Cleared authentication storage data');
    } catch (error) {
      console.warn('Failed to clear authentication storage:', error);
    }

    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isInfiniteLoop = this.state.error?.message?.includes('Maximum update depth') || 
                            this.state.error?.message?.includes('infinite loop');
      
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backgroundColor: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '600px',
            width: '100%',
            backgroundColor: 'white',
            padding: '32px',
            borderRadius: '12px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {isInfiniteLoop ? '🔄' : '💥'}
            </div>
            
            <h1 style={{ 
              fontSize: '24px', 
              fontWeight: '600', 
              color: '#dc2626', 
              marginBottom: '16px' 
            }}>
              {isInfiniteLoop ? 'Loading Loop Detected' : 'Something went wrong'}
            </h1>
            
            <p style={{ 
              fontSize: '16px', 
              color: '#6b7280', 
              marginBottom: '24px' 
            }}>
              {isInfiniteLoop 
                ? 'The app detected an infinite loading loop and stopped it to prevent freezing.'
                : 'An unexpected error occurred. Please try refreshing the page.'
              }
            </p>

            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button 
                onClick={this.handleRetry}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>
              
              <button 
                onClick={this.handleReset}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Reset App
              </button>
            </div>

            {this.state.retryCount > 2 && (
              <div style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#fef3c7',
                borderRadius: '8px',
                border: '1px solid #f59e0b'
              }}>
                <p style={{ 
                  fontSize: '14px', 
                  color: '#92400e', 
                  margin: 0 
                }}>
                  Multiple retry attempts detected. Consider refreshing the page or clearing your browser data.
                </p>
              </div>
            )}

            {process.env.NODE_ENV === 'development' && (
              <details style={{ 
                marginTop: '24px', 
                textAlign: 'left',
                backgroundColor: '#f3f4f6',
                padding: '16px',
                borderRadius: '8px'
              }}>
                <summary style={{ 
                  cursor: 'pointer', 
                  fontWeight: '600',
                  marginBottom: '8px'
                }}>
                  🔍 Developer Information
                </summary>
                <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                  <strong>Error:</strong> {this.state.error && this.state.error.toString()}
                  <br />
                  <strong>Retry Count:</strong> {this.state.retryCount}
                </div>
                {this.state.errorInfo && (
                  <>
                    <br /><br />
                    <strong>Component Stack:</strong>
                    <pre style={{ 
                      fontSize: '11px', 
                      overflow: 'auto',
                      backgroundColor: 'white',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db'
                    }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;