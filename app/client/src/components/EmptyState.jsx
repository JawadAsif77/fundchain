import React from 'react';

const EmptyState = ({ 
  title = 'No results found', 
  message = 'Try adjusting your search or filter criteria.',
  action = null 
}) => {
  return (
    <div className="empty-state">
      <div className="text-6xl text-gray-300 mb-md">📭</div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action && (
        <div className="mt-lg">
          {action}
        </div>
      )}
    </div>
  );
};

export default EmptyState;