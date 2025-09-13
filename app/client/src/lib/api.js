// API abstraction layer for Phase 1 (mock data)
// PHASE 2: Replace these functions with actual Supabase API calls

import { campaigns } from '../mock/campaigns.js';
import { milestones } from '../mock/milestones.js';
import { users } from '../mock/users.js';
import { investments } from '../mock/investments.js';

// Simulate network delay for more realistic behavior
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// Campaign API
export const campaignApi = {
  // Get all campaigns with optional filters
  async getCampaigns(filters = {}) {
    await delay();
    
    let filtered = [...campaigns];
    
    // Apply filters (same logic as Explore page)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(campaign => 
        campaign.title.toLowerCase().includes(searchLower) ||
        campaign.summary.toLowerCase().includes(searchLower)
      );
    }
    
    if (filters.category) {
      filtered = filtered.filter(campaign => campaign.category === filters.category);
    }
    
    if (filters.status) {
      filtered = filtered.filter(campaign => campaign.status === filters.status);
    }
    
    return {
      data: filtered,
      count: filtered.length
    };
  },

  // Get campaign by slug
  async getCampaignBySlug(slug) {
    await delay();
    
    const campaign = campaigns.find(c => c.slug === slug);
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    return { data: campaign };
  },

  // Get campaigns by creator ID
  async getCampaignsByCreator(creatorId) {
    await delay();
    
    const creatorCampaigns = campaigns.filter(c => c.creatorId === creatorId);
    return {
      data: creatorCampaigns,
      count: creatorCampaigns.length
    };
  },

  // Create new campaign (placeholder for Phase 2)
  async createCampaign(campaignData) {
    await delay(1000);
    
    // PHASE 2: Implement actual campaign creation with Supabase
    throw new Error('Campaign creation will be available in Phase 2 with database integration');
  }
};

// Milestone API
export const milestoneApi = {
  // Get milestones for a campaign
  async getMilestonesByProject(projectId) {
    await delay();
    
    const projectMilestones = milestones.filter(m => m.projectId === projectId);
    return {
      data: projectMilestones,
      count: projectMilestones.length
    };
  }
};

// Investment API
export const investmentApi = {
  // Get investments by investor ID
  async getInvestmentsByInvestor(investorId) {
    await delay();
    
    const investorInvestments = investments.filter(i => i.investorId === investorId);
    
    // Enrich with campaign data
    const enrichedInvestments = investorInvestments.map(investment => {
      const campaign = campaigns.find(c => c.id === investment.projectId);
      return {
        ...investment,
        campaign
      };
    }).filter(investment => investment.campaign); // Only include valid campaigns
    
    return {
      data: enrichedInvestments,
      count: enrichedInvestments.length
    };
  },

  // Create new investment (placeholder for Phase 2)
  async createInvestment(investmentData) {
    await delay(1000);
    
    // PHASE 2: Implement actual investment processing with Supabase
    throw new Error('Investment processing will be available in Phase 2 with database integration');
  }
};

// User API
export const userApi = {
  // Get user by ID
  async getUserById(userId) {
    await delay();
    
    const user = users.find(u => u.id === userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    return { data: user };
  },

  // Update user profile (placeholder for Phase 2)
  async updateProfile(userId, profileData) {
    await delay(1000);
    
    // PHASE 2: Implement actual profile updates with Supabase
    throw new Error('Profile updates will be available in Phase 2 with database integration');
  }
};

// Auth API (used by AuthContext)
export const authApi = {
  // Login user
  async login(email, password) {
    await delay(500);
    
    // PHASE 2: Replace with actual Supabase auth
    const user = users.find(u => u.email === email);
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    return { data: user };
  },

  // Register new user
  async register(email, password, displayName) {
    await delay(500);
    
    // PHASE 2: Replace with actual Supabase auth
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      throw new Error('User already exists');
    }
    
    const newUser = {
      id: Date.now(), // Simple ID generation for mock
      email,
      displayName,
      role: 'investor', // Default role
      createdAt: new Date().toISOString()
    };
    
    // Add to mock users array (for session only)
    users.push(newUser);
    
    return { data: newUser };
  },

  // Logout user
  async logout() {
    await delay(200);
    // PHASE 2: Implement actual Supabase logout
    return { success: true };
  }
};

// Search API
export const searchApi = {
  // Search across campaigns
  async searchCampaigns(query, filters = {}) {
    await delay();
    
    const results = await campaignApi.getCampaigns({
      ...filters,
      search: query
    });
    
    return results;
  }
};

// Analytics API (placeholder for future features)
export const analyticsApi = {
  // Get platform statistics
  async getPlatformStats() {
    await delay();
    
    const totalProjects = campaigns.length;
    const activeProjects = campaigns.filter(c => c.status === 'live').length;
    const completedProjects = campaigns.filter(c => c.status === 'completed').length;
    const totalRaised = campaigns.reduce((sum, c) => sum + c.raisedAmount, 0);
    
    return {
      data: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalRaised
      }
    };
  }
};

// Export all APIs as a single object for convenience
export default {
  campaigns: campaignApi,
  milestones: milestoneApi,
  investments: investmentApi,
  users: userApi,
  auth: authApi,
  search: searchApi,
  analytics: analyticsApi
};