import React from 'react';

const EmptyState = ({ 
  title = 'No results found', 
  message = 'Try adjusting your search or filter criteria.',
  action = null 
}) => {
  // Helper to render action properly
  const renderAction = () => {
    if (!action) return null;
    
    // If action is a React element, render it directly
    if (React.isValidElement(action)) {
      return action;
    }
    
    // If action is an object with onClick function
    if (action.onClick && action.label) {
      return (
        <button 
          onClick={action.onClick}
          style={{
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          {action.label}
        </button>
      );
    }
    
    // If action is an object with href (Link)
    if (action.href && action.label) {
      return (
        <a 
          href={action.href}
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {action.label}
        </a>
      );
    }
    
    // Fallback: try to render as string
    return String(action);
  };

  return (
    <div className="empty-state">
      <div className="text-6xl text-gray-300 mb-md">📭</div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action && (
        <div className="mt-lg">
          {renderAction()}
        </div>
      )}
    </div>
  );
};

export default EmptyState;