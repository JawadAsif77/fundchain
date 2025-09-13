import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

/**
 * Custom hook for fetching campaigns with loading states and error handling
 */
export const useCampaigns = (options = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0,
    hasMore: false
  });

  const fetchCampaigns = useCallback(async (fetchOptions = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const mergedOptions = { ...options, ...fetchOptions };
      const result = await api.campaigns.getAll(mergedOptions);
      
      setData(result.campaigns);
      setPagination({
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        hasMore: result.hasMore
      });
    } catch (err) {
      setError(err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [options]);

  const loadMore = useCallback(async () => {
    if (!pagination.hasMore || loading) return;
    
    try {
      setLoading(true);
      const result = await api.campaigns.getAll({
        ...options,
        page: pagination.currentPage + 1
      });
      
      setData(prev => [...prev, ...result.campaigns]);
      setPagination({
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        hasMore: result.hasMore
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options, pagination, loading]);

  const refresh = useCallback(() => {
    fetchCampaigns({ page: 1 });
  }, [fetchCampaigns]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return {
    campaigns: data,
    loading,
    error,
    pagination,
    loadMore,
    refresh,
    refetch: fetchCampaigns
  };
};

/**
 * Custom hook for fetching a single campaign
 */
export const useCampaign = (campaignId) => {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCampaign = useCallback(async () => {
    if (!campaignId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await api.campaigns.getById(campaignId);
      setCampaign(data);
    } catch (err) {
      setError(err.message);
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const refresh = useCallback(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  return {
    campaign,
    loading,
    error,
    refresh,
    refetch: fetchCampaign
  };
};

/**
 * Custom hook for fetching user's investments
 */
export const useUserInvestments = (userId) => {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvestments = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await api.investments.getByUser(userId);
      setInvestments(data);
    } catch (err) {
      setError(err.message);
      setInvestments([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refresh = useCallback(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  return {
    investments,
    loading,
    error,
    refresh,
    refetch: fetchInvestments
  };
};

/**
 * Custom hook for fetching campaign investments
 */
export const useCampaignInvestments = (campaignId) => {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvestments = useCallback(async () => {
    if (!campaignId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await api.investments.getByCampaign(campaignId);
      setInvestments(data);
    } catch (err) {
      setError(err.message);
      setInvestments([]);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const refresh = useCallback(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  return {
    investments,
    loading,
    error,
    refresh,
    refetch: fetchInvestments
  };
};

/**
 * Custom hook for fetching user's favorite campaigns
 */
export const useFavorites = (userId) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFavorites = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await api.favorites.getByUser(userId);
      setFavorites(data);
    } catch (err) {
      setError(err.message);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addToFavorites = useCallback(async (campaignId) => {
    try {
      await api.favorites.add(userId, campaignId);
      fetchFavorites(); // Refresh the list
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [userId, fetchFavorites]);

  const removeFromFavorites = useCallback(async (campaignId) => {
    try {
      await api.favorites.remove(userId, campaignId);
      fetchFavorites(); // Refresh the list
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [userId, fetchFavorites]);

  const isFavorite = useCallback((campaignId) => {
    return favorites.some(fav => fav.campaign_id === campaignId);
  }, [favorites]);

  const refresh = useCallback(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return {
    favorites,
    loading,
    error,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    refresh,
    refetch: fetchFavorites
  };
};

/**
 * Custom hook for fetching categories
 */
export const useCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await api.categories.getAll();
        setCategories(data);
      } catch (err) {
        setError(err.message);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error
  };
};

/**
 * Custom hook for fetching campaign milestones
 */
export const useMilestones = (campaignId) => {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMilestones = useCallback(async () => {
    if (!campaignId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await api.milestones.getByCampaign(campaignId);
      setMilestones(data);
    } catch (err) {
      setError(err.message);
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  const refresh = useCallback(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  return {
    milestones,
    loading,
    error,
    refresh,
    refetch: fetchMilestones
  };
};

/**
 * Custom hook for fetching user statistics
 */
export const useUserStats = (userId) => {
  const [stats, setStats] = useState({
    totalInvested: 0,
    totalCampaigns: 0,
    activeInvestments: 0,
    completedInvestments: 0,
    averageInvestment: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await api.users.getInvestmentStats(userId);
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refresh = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh,
    refetch: fetchStats
  };
};

/**
 * Custom hook for creating investments with loading state
 */
export const useCreateInvestment = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createInvestment = useCallback(async (investmentData) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await api.investments.create(investmentData);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    createInvestment,
    loading,
    error,
    clearError
  };
};

/**
 * Generic hook for data mutations (create, update, delete)
 */
export const useMutation = (mutationFn) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const mutate = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await mutationFn(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutationFn]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    mutate,
    loading,
    error,
    data,
    reset
  };
};