import { db } from '../lib/supabase.js';

/**
 * API Service Layer
 * Centralized service for all data operations using Supabase
 * This replaces the mock data system with real database queries
 */

// =============================================================================
// CAMPAIGNS API
// =============================================================================

export const campaignsAPI = {
  /**
   * Get all campaigns with optional filtering and pagination
   */
  async getAll(options = {}) {
    const {
      page = 1,
      limit = 12,
      status,
      category,
      featured,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options;

    try {
      const filters = {};
      if (status) filters.status = status;
      if (category) filters.category = category;
      if (featured) filters.featured = featured;
      if (search) filters.search = search;

      const { data, error, count } = await db.campaigns.getAll(page, limit, filters);
      
      if (error) throw error;

      return {
        campaigns: data || [],
        totalCount: count || 0,
        currentPage: page,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: page * limit < (count || 0)
      };
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      throw new Error(`Failed to fetch campaigns: ${error.message}`);
    }
  },

  /**
   * Get a single campaign by ID
   */
  async getById(campaignId) {
    try {
      const { data, error } = await db.campaigns.getById(campaignId);
      
      if (error) throw error;
      if (!data) throw new Error('Campaign not found');

      return data;
    } catch (error) {
      console.error('Error fetching campaign:', error);
      throw new Error(`Failed to fetch campaign: ${error.message}`);
    }
  },

  /**
   * Get campaigns by user (creator)
   */
  async getByUser(userId) {
    try {
      const { data, error } = await db.campaigns.getByUser(userId);
      
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching user campaigns:', error);
      throw new Error(`Failed to fetch user campaigns: ${error.message}`);
    }
  },

  /**
   * Create a new campaign
   */
  async create(campaignData) {
    try {
      // Validate required fields
      const required = ['title', 'description', 'funding_goal', 'creator_id'];
      const missing = required.filter(field => !campaignData[field]);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      // Generate slug from title
      const slug = campaignData.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      const dataToInsert = {
        ...campaignData,
        slug: `${slug}-${Date.now()}`, // Ensure uniqueness
        status: 'draft', // Default status
        current_funding: 0,
        investor_count: 0,
        created_at: new Date().toISOString()
      };

      const { data, error } = await db.campaigns.create(dataToInsert);
      
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating campaign:', error);
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
  },

  /**
   * Update an existing campaign
   */
  async update(campaignId, updates) {
    try {
      // Don't allow updating certain fields directly
      const restrictedFields = ['id', 'creator_id', 'current_funding', 'investor_count', 'created_at'];
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => !restrictedFields.includes(key))
      );

      cleanUpdates.updated_at = new Date().toISOString();

      const { data, error } = await db.campaigns.update(campaignId, cleanUpdates);
      
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating campaign:', error);
      throw new Error(`Failed to update campaign: ${error.message}`);
    }
  },

  /**
   * Get featured campaigns
   */
  async getFeatured(limit = 6) {
    try {
      return await this.getAll({
        featured: true,
        limit,
        status: 'active'
      });
    } catch (error) {
      console.error('Error fetching featured campaigns:', error);
      throw new Error(`Failed to fetch featured campaigns: ${error.message}`);
    }
  }
};

// =============================================================================
// INVESTMENTS API
// =============================================================================

export const investmentsAPI = {
  /**
   * Get user's investments
   */
  async getByUser(userId) {
    try {
      const { data, error } = await db.investments.getByUser(userId);
      
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching user investments:', error);
      throw new Error(`Failed to fetch investments: ${error.message}`);
    }
  },

  /**
   * Get investments for a specific campaign
   */
  async getByCampaign(campaignId) {
    try {
      const { data, error } = await db.investments.getByCampaign(campaignId);
      
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching campaign investments:', error);
      throw new Error(`Failed to fetch campaign investments: ${error.message}`);
    }
  },

  /**
   * Create a new investment
   */
  async create(investmentData) {
    try {
      const required = ['investor_id', 'campaign_id', 'amount'];
      const missing = required.filter(field => !investmentData[field]);
      
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      if (investmentData.amount <= 0) {
        throw new Error('Investment amount must be greater than 0');
      }

      const dataToInsert = {
        ...investmentData,
        status: 'pending', // Default status
        investment_date: new Date().toISOString()
      };

      const { data, error } = await db.investments.create(dataToInsert);
      
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating investment:', error);
      throw new Error(`Failed to create investment: ${error.message}`);
    }
  },

  /**
   * Update investment status
   */
  async updateStatus(investmentId, status, additionalData = {}) {
    try {
      const validStatuses = ['pending', 'confirmed', 'cancelled', 'refunded'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      const updates = {
        ...additionalData,
        updated_at: new Date().toISOString()
      };

      if (status === 'confirmed') {
        updates.confirmed_at = new Date().toISOString();
      } else if (status === 'refunded') {
        updates.refunded_at = new Date().toISOString();
      }

      const { data, error } = await db.investments.updateStatus(investmentId, status, updates);
      
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating investment status:', error);
      throw new Error(`Failed to update investment: ${error.message}`);
    }
  }
};

// =============================================================================
// USERS API
// =============================================================================

export const usersAPI = {
  /**
   * Get user profile
   */
  async getProfile(userId) {
    try {
      const { data, error } = await db.users.getProfile(userId);
      
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }
  },

  /**
   * Update user profile
   */
  async updateProfile(userId, updates) {
    try {
      // Don't allow updating certain fields
      const restrictedFields = ['id', 'email', 'created_at'];
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => !restrictedFields.includes(key))
      );

      cleanUpdates.updated_at = new Date().toISOString();

      const { data, error } = await db.users.updateProfile(userId, cleanUpdates);
      
      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  },

  /**
   * Get user's investment statistics
   */
  async getInvestmentStats(userId) {
    try {
      const investments = await investmentsAPI.getByUser(userId);
      
      const stats = {
        totalInvested: 0,
        totalCampaigns: 0,
        activeInvestments: 0,
        completedInvestments: 0,
        averageInvestment: 0
      };

      const confirmedInvestments = investments.filter(inv => inv.status === 'confirmed');
      
      if (confirmedInvestments.length > 0) {
        stats.totalInvested = confirmedInvestments.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
        stats.totalCampaigns = confirmedInvestments.length;
        stats.activeInvestments = confirmedInvestments.filter(inv => 
          inv.campaigns?.status === 'active'
        ).length;
        stats.completedInvestments = confirmedInvestments.filter(inv => 
          ['successful', 'failed'].includes(inv.campaigns?.status)
        ).length;
        stats.averageInvestment = stats.totalInvested / stats.totalCampaigns;
      }

      return stats;
    } catch (error) {
      console.error('Error fetching investment stats:', error);
      throw new Error(`Failed to fetch investment statistics: ${error.message}`);
    }
  }
};

// =============================================================================
// CATEGORIES API
// =============================================================================

export const categoriesAPI = {
  /**
   * Get all categories
   */
  async getAll() {
    try {
      const { data, error } = await db.categories.getAll();
      
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }
  }
};

// =============================================================================
// MILESTONES API
// =============================================================================

export const milestonesAPI = {
  /**
   * Get milestones for a campaign
   */
  async getByCampaign(campaignId) {
    try {
      const { data, error } = await db.milestones.getByCampaign(campaignId);
      
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching milestones:', error);
      throw new Error(`Failed to fetch milestones: ${error.message}`);
    }
  }
};

// =============================================================================
// FAVORITES API
// =============================================================================

export const favoritesAPI = {
  /**
   * Get user's favorite campaigns
   */
  async getByUser(userId) {
    try {
      const { data, error } = await db.favorites.getByUser(userId);
      
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching favorites:', error);
      throw new Error(`Failed to fetch favorites: ${error.message}`);
    }
  },

  /**
   * Add campaign to favorites
   */
  async add(userId, campaignId) {
    try {
      const { data, error } = await db.favorites.add(userId, campaignId);
      
      if (error) {
        // Handle duplicate key error
        if (error.code === '23505') {
          throw new Error('Campaign is already in favorites');
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error adding to favorites:', error);
      throw new Error(`Failed to add to favorites: ${error.message}`);
    }
  },

  /**
   * Remove campaign from favorites
   */
  async remove(userId, campaignId) {
    try {
      const { error } = await db.favorites.remove(userId, campaignId);
      
      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error removing from favorites:', error);
      throw new Error(`Failed to remove from favorites: ${error.message}`);
    }
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency values
 */
export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Calculate funding percentage
 */
export const calculateFundingPercentage = (currentFunding, fundingGoal) => {
  if (!fundingGoal || fundingGoal <= 0) return 0;
  return Math.round((currentFunding / fundingGoal) * 100);
};

/**
 * Calculate days remaining
 */
export const calculateDaysRemaining = (endDate) => {
  if (!endDate) return null;
  
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : 0;
};

/**
 * Validate investment amount
 */
export const validateInvestmentAmount = (amount, minInvestment, maxInvestment, availableAmount) => {
  const errors = [];
  
  if (!amount || amount <= 0) {
    errors.push('Investment amount must be greater than 0');
  }
  
  if (amount < minInvestment) {
    errors.push(`Minimum investment is ${formatCurrency(minInvestment)}`);
  }
  
  if (maxInvestment && amount > maxInvestment) {
    errors.push(`Maximum investment is ${formatCurrency(maxInvestment)}`);
  }
  
  if (amount > availableAmount) {
    errors.push(`Investment amount exceeds available funding (${formatCurrency(availableAmount)})`);
  }
  
  return errors;
};

// Export all APIs as a single object for convenience
export const api = {
  campaigns: campaignsAPI,
  investments: investmentsAPI,
  users: usersAPI,
  categories: categoriesAPI,
  milestones: milestonesAPI,
  favorites: favoritesAPI
};

export default api;