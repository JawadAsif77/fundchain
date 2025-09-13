import React, { useState, useMemo } from 'react';
import FilterBar from '../components/FilterBar';
import CampaignCard from '../components/CampaignCard';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { campaigns } from '../mock/campaigns';

const Explore = () => {
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
    sort: 'newest'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Filter and sort campaigns based on current filters
  const filteredAndSortedCampaigns = useMemo(() => {
    let filtered = [...campaigns];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(campaign => 
        campaign.title.toLowerCase().includes(searchLower) ||
        campaign.summary.toLowerCase().includes(searchLower)
      );
    }

    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(campaign => 
        campaign.category === filters.category
      );
    }

    // Apply status filter
    if (filters.status) {
      filtered = filtered.filter(campaign => 
        campaign.status === filters.status
      );
    }

    // Apply sorting
    switch (filters.sort) {
      case 'newest':
        filtered.sort((a, b) => b.id - a.id); // Assuming higher ID = newer
        break;
      case 'trending':
        // Sort by progress percentage (raised/goal ratio)
        filtered.sort((a, b) => {
          const progressA = (a.raisedAmount / a.goalAmount) * 100;
          const progressB = (b.raisedAmount / b.goalAmount) * 100;
          return progressB - progressA;
        });
        break;
      case 'goal':
        filtered.sort((a, b) => b.goalAmount - a.goalAmount);
        break;
      case 'deadline':
        filtered.sort((a, b) => new Date(a.deadlineISO) - new Date(b.deadlineISO));
        break;
      default:
        break;
    }

    return filtered;
  }, [filters]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedCampaigns.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCampaigns = filteredAndSortedCampaigns.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when filters change
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="main">
      <div className="page-content">
        <div className="container">
          <div className="mb-xl">
            <h1 className="text-3xl font-bold mb-md">Explore Investment Opportunities</h1>
            <p className="text-lg text-gray-600">
              Discover innovative projects seeking funding. Use the filters below to find 
              investments that match your interests and risk tolerance.
            </p>
          </div>

          <FilterBar onFiltersChange={handleFiltersChange} />

          {/* Results Summary */}
          <div className="flex items-center justify-between mb-lg">
            <div className="text-sm text-gray-600">
              {filteredAndSortedCampaigns.length === 0 ? (
                'No campaigns found'
              ) : (
                <>
                  Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredAndSortedCampaigns.length)} of{' '}
                  {filteredAndSortedCampaigns.length} campaign{filteredAndSortedCampaigns.length !== 1 ? 's' : ''}
                </>
              )}
            </div>
            
            {filteredAndSortedCampaigns.length > 0 && (
              <div className="text-sm text-gray-600">
                Sorted by: {filters.sort === 'newest' ? 'Newest' : 
                          filters.sort === 'trending' ? 'Trending' :
                          filters.sort === 'goal' ? 'Goal Amount' : 'Deadline'}
              </div>
            )}
          </div>

          {/* Campaign Grid */}
          {paginatedCampaigns.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg mb-xl">
                {paginatedCampaigns.map(campaign => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredAndSortedCampaigns.length}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
              />
            </>
          ) : (
            <EmptyState
              title="No campaigns found"
              message="Try adjusting your search terms or filters to find more results."
              action={
                <button 
                  onClick={() => handleFiltersChange({ search: '', category: '', status: '', sort: 'newest' })}
                  className="btn-primary"
                >
                  Clear All Filters
                </button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Explore;