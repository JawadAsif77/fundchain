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

// =============================================================================
// PHASE 3 API HELPERS
// =============================================================================
// New Phase 3 functionality for roles, KYC, projects, and investments

import { supabase as supabaseClient, db } from './supabase.js';

// =============================================================================
// ROLE MANAGEMENT
// =============================================================================

/**
 * Update user role (investor or creator)
 */
export const selectRole = async (role) => {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    console.log('Attempting to select role for user:', user.id, 'role:', role);

    // Method 1: Try using the existing db helper first
    try {
      const updateResult = await db.users.updateProfile(user.id, { role });
      
      if (!updateResult.error) {
        console.log('Role updated via db.users.updateProfile');
        return { success: true, data: updateResult.data };
      }
      
      if (updateResult.error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('Creating new user profile via db.users.createProfile...');
        const profileData = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          avatar_url: user.user_metadata?.avatar_url || null,
          role
        };
        
        const createResult = await db.users.createProfile(profileData);
        
        if (!createResult.error) {
          console.log('Profile created successfully');
          return { success: true, data: createResult.data };
        }
        
        console.log('Create failed, trying direct upsert...', createResult.error);
      } else {
        console.log('Update failed, trying direct upsert...', updateResult.error);
      }
    } catch (helperError) {
      console.log('Helper functions failed, trying direct approach...', helperError);
    }

    // Method 2: Direct upsert as fallback
    console.log('Attempting direct upsert...');
    const { data, error } = await supabaseClient
      .from('users')
      .upsert({ 
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        avatar_url: user.user_metadata?.avatar_url || null,
        role 
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('Direct upsert failed:', error);
      throw error;
    }
    
    console.log('Direct upsert successful');
    return { success: true, data };
    
  } catch (error) {
    console.error('Error selecting role:', error);
    return { success: false, error: error.message || 'Failed to select role' };
  }
};

/**
 * Get user role and company status
 * @param {string} userId - Optional user ID, uses current auth user if not provided
 */
export const getUserRoleStatus = async (userId = null) => {
  try {
    let targetUserId = userId;
    
    // If no userId provided, get current auth user
    if (!targetUserId) {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      targetUserId = user.id;
    }

    // Get user with role
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role, full_name, email')
      .eq('id', targetUserId)
      .single();

    // If user doesn't exist in users table, return default status
    if (userError && userError.code === 'PGRST116') {
      return {
        success: true,
        hasRole: false,
        role: null,
        isKYCVerified: false,
        companyData: null
      };
    }

    if (userError) throw userError;

    // If creator, check company status
    let companyData = null;
    if (userData.role === 'creator') {
      const { data: company, error: companyError } = await supabaseClient
        .from('companies')
        .select('*')
        .eq('owner_id', targetUserId)
        .single();

      // No error if company doesn't exist yet
      if (!companyError || companyError.code === 'PGRST116') {
        companyData = company;
      }
    }

    return {
      success: true,
      data: {
        user: userData,
        company: companyData
      }
    };
  } catch (error) {
    console.error('Error getting user role status:', error);
    return { success: false, error: error.message };
  }
};

// =============================================================================
// KYC / COMPANY MANAGEMENT
// =============================================================================

/**
 * Submit KYC form data
 */
export const submitKYC = async (formData) => {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabaseClient
      .from('companies')
      .insert({
        owner_id: user.id,
        name: formData.companyName,
        registration_number: formData.registrationNumber,
        country: formData.country,
        website: formData.website,
        verified: false
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error submitting KYC:', error);
    return { success: false, error: error.message };
  }
};

// =============================================================================
// PROJECT MANAGEMENT
// =============================================================================

/**
 * Create project with milestones
 */
export const createProjectWithMilestones = async (projectData, milestones) => {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get user's company
    const { data: company, error: companyError } = await supabaseClient
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .eq('verified', true)
      .single();

    if (companyError) throw new Error('Verified company required to create projects');

    // Create project
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .insert({
        creator_id: user.id,
        company_id: company.id,
        title: projectData.title,
        slug: projectData.slug,
        summary: projectData.summary,
        description: projectData.description,
        category: projectData.category,
        goal_amount: projectData.goalAmount,
        deadline: projectData.deadline,
        image_url: projectData.imageUrl
      })
      .select()
      .single();

    if (projectError) throw projectError;

    // Create milestones
    const milestonesWithProjectId = milestones.map((milestone, index) => ({
      project_id: project.id,
      milestone_index: index + 1,
      name: milestone.name,
      description: milestone.description,
      payout_percentage: milestone.payoutPercentage,
      target_amount: (projectData.goalAmount * milestone.payoutPercentage) / 100
    }));

    const { data: milestonesData, error: milestonesError } = await supabaseClient
      .from('project_milestones')
      .insert(milestonesWithProjectId)
      .select();

    if (milestonesError) throw milestonesError;

    return {
      success: true,
      data: {
        project,
        milestones: milestonesData
      }
    };
  } catch (error) {
    console.error('Error creating project:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get public projects (for explore page)
 */
export const getPublicProjects = async (filters = {}) => {
  try {
    let query = supabaseClient
      .from('public_projects')
      .select('*');

    // Apply filters
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    // Default ordering
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error getting public projects:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get project by slug with milestones
 */
export const getProjectBySlug = async (slug) => {
  try {
    const { data, error } = await supabaseClient
      .from('projects')
      .select(`
        *,
        companies(name, verified),
        users(full_name, avatar_url),
        project_milestones(*)
      `)
      .eq('slug', slug)
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error getting project by slug:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create investment in project
 */
export const createInvestment = async (projectId, amount) => {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabaseClient
      .from('project_investments')
      .insert({
        project_id: projectId,
        investor_id: user.id,
        amount: amount,
        status: 'initiated'
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating investment:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Complete investment (simulate payment completion)
 */
export const completeInvestment = async (investmentId) => {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabaseClient
      .from('project_investments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', investmentId)
      .eq('investor_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error completing investment:', error);
    return { success: false, error: error.message };
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate unique slug from title
 */
export const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

/**
 * Validate milestone percentages sum to 100%
 */
export const validateMilestones = (milestones) => {
  const total = milestones.reduce((sum, m) => sum + parseFloat(m.payoutPercentage || 0), 0);
  return Math.abs(total - 100) < 0.01; // Allow for small floating point errors
};

/**
 * Format currency
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};