import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="main">
      <div className="page-content">
        <div className="container">
          <div className="text-center">
            <div className="text-9xl font-bold text-gray-300 mb-md">404</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-md">Page Not Found</h1>
            <p className="text-lg text-gray-600 mb-xl">
              Sorry, we couldn't find the page you're looking for. 
              It might have been moved, deleted, or the URL might be incorrect.
            </p>
            
            <div className="flex items-center justify-center gap-md">
              <Link to="/" className="btn-primary">
                Go Home
              </Link>
              <Link to="/explore" className="btn-secondary">
                Browse Projects
              </Link>
            </div>

            <div className="mt-xl">
              <div className="card max-w-md mx-auto">
                <h3 className="card-title">What can you do?</h3>
                <ul className="text-left space-y-sm text-sm text-gray-600">
                  <li>• Check the URL for any typos</li>
                  <li>• Go back to the <Link to="/" className="text-primary">homepage</Link></li>
                  <li>• Explore our <Link to="/explore" className="text-primary">investment opportunities</Link></li>
                  <li>• Contact support if you think this is an error</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;