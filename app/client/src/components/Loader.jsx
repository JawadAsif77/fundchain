import React from 'react';

const Loader = ({ size = 'md', message = 'Loading...' }) => {
  const loaderClass = size === 'lg' ? 'loader loader-lg' : 'loader';

  return (
    <div className="loading-container">
      <div className="text-center">
        <div className={loaderClass}></div>
        {message && (
          <div className="mt-md text-muted">
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Loader;