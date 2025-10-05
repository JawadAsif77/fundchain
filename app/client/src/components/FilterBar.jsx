import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const FilterBar = ({ onFiltersChange }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    status: searchParams.get('status') || 'active',
    sort: searchParams.get('sort') || 'newest'
  });

  // Categories available in mock data
  const categories = [
    'Agriculture',
    'Energy', 
    'Healthcare',
    'Environment',
    'Technology',
    'Aerospace'
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'successful', label: 'Successful' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'trending', label: 'Trending' },
    { value: 'goal', label: 'Goal Amount' },
    { value: 'deadline', label: 'Deadline' }
  ];

  // Sync URL with filters - only update parent, don't manipulate URL on every change
  useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  // Listen to URL changes and update filters (for back/forward navigation)
  useEffect(() => {
    const urlFilters = {
      search: searchParams.get('search') || '',
      category: searchParams.get('category') || '',
      status: searchParams.get('status') || 'active',
      sort: searchParams.get('sort') || 'newest'
    };

    // Only update if different to avoid infinite loops
    if (JSON.stringify(urlFilters) !== JSON.stringify(filters)) {
      setFilters(urlFilters);
    }
  }, [searchParams]);

  const handleFilterChange = (key, value) => {
    const newFilters = {
      ...filters,
      [key]: value
    };
    
    setFilters(newFilters);
    
    // Update URL immediately but with replace: true to not break back button
    const newSearchParams = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) {
        newSearchParams.set(k, v);
      }
    });
    
    setSearchParams(newSearchParams, { replace: true });
  };

  const handleReset = () => {
    const resetFilters = {
      search: '',
      category: '',
      status: '',
      sort: 'newest'
    };
    
    setFilters(resetFilters);
    
    // Clear URL parameters
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className="filter-form">
      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="search" className="form-label">Search</label>
          <input
            type="text"
            id="search"
            className="form-input search-input"
            placeholder="Search campaigns..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="category" className="form-label">Category</label>
          <select
            id="category"
            className="form-select"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="status" className="form-label">Status</label>
          <select
            id="status"
            className="form-select"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="sort" className="form-label">Sort By</label>
          <select
            id="sort"
            className="form-select"
            value={filters.sort}
            onChange={(e) => handleFilterChange('sort', e.target.value)}
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-actions">
          <button 
            type="button" 
            className="btn-secondary btn-sm"
            onClick={handleReset}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;