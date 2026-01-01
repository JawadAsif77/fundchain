import React from 'react';

const RecommendationReasons = ({ reasons = [], tags = [] }) => {
  // Don't render anything if no reasons or tags
  if (reasons.length === 0 && tags.length === 0) {
    return null;
  }

  return (
    <div className="recommendation-reasons" style={{ marginTop: '0.75rem' }}>
      {/* Render reasons as list */}
      {reasons.length > 0 && (
        <ul style={{ 
          fontSize: '0.875rem', 
          color: '#4A5568',
          margin: '0',
          paddingLeft: '1.25rem',
          listStyle: 'disc'
        }}>
          {reasons.map((reason, index) => (
            <li key={index} style={{ marginBottom: '0.25rem' }}>
              {reason}
            </li>
          ))}
        </ul>
      )}

      {/* Render tags as badges (max 3) */}
      {tags.length > 0 && (
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '0.5rem',
          marginTop: reasons.length > 0 ? '0.5rem' : '0'
        }}>
          {tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#F7FAFC',
                color: '#4A5568',
                borderRadius: '0.25rem',
                fontWeight: '500'
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecommendationReasons;
