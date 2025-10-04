import React, { useEffect, useMemo, useState } from 'react';
import FilterBar from '../components/FilterBar';
import CampaignCard from '../components/CampaignCard';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { campaignApi } from '../lib/api.js';

const Explore = () => {
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
    sort: 'newest'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const [allCampaigns, setAllCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await campaignApi.getCampaigns({ category: filters.category, search: filters.search });
        if (cancelled) return;
        // Map DB campaigns to CampaignCard shape
        const mapped = (data || []).map((c) => ({
          id: c.id,
          slug: c.slug,
          title: c.title,
          summary: c.short_description || '',
          category: c.categories?.name || 'General',
          goalAmount: Number(c.funding_goal || 0),
          raisedAmount: Number(c.current_funding || 0),
          deadlineISO: c.end_date,
          status: c.status,
          riskScore: c.risk_level ? Math.min(100, Math.max(0, Number(c.risk_level) * 20)) : 50,
          region: c.location || '—',
          image_url: c.image_url,
          created_at: c.created_at,
        }));
        setAllCampaigns(mapped);
        setError('');
      } catch (e) {
        if (cancelled) return;
        setError(e.message || 'Failed to load campaigns');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [filters.category, filters.search]);

  // Filter and sort campaigns based on current filters (status and sort client-side)
  const filteredAndSortedCampaigns = useMemo(() => {
    let filtered = [...allCampaigns];

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
      filtered = filtered.filter(campaign => campaign.category === filters.category);
    }

    // Apply status filter
    if (filters.status) {
      filtered = filtered.filter(campaign => campaign.status === filters.status);
    }

    // Apply sorting
    switch (filters.sort) {
      case 'newest':
  filtered.sort((a, b) => (a.created_at && b.created_at ? new Date(b.created_at) - new Date(a.created_at) : 0));
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
          {loading ? (
            <div className="text-center text-gray-600">Loading campaigns…</div>
          ) : error ? (
            <EmptyState title="Failed to load" message={error} />
          ) : paginatedCampaigns.length > 0 ? (
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