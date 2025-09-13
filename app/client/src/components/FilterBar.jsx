import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const FilterBar = ({ onFiltersChange }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    status: searchParams.get('status') || '',
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
    { value: 'live', label: 'Live' },
    { value: 'draft', label: 'Draft' },
    { value: 'completed', label: 'Completed' }
  ];

  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'trending', label: 'Trending' },
    { value: 'goal', label: 'Goal Amount' },
    { value: 'deadline', label: 'Deadline' }
  ];

  // Update URL when filters change
  useEffect(() => {
    const newSearchParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        newSearchParams.set(key, value);
      }
    });
    
    setSearchParams(newSearchParams);
    onFiltersChange(filters);
  }, [filters, setSearchParams, onFiltersChange]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleReset = () => {
    setFilters({
      search: '',
      category: '',
      status: '',
      sort: 'newest'
    });
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