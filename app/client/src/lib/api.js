// API abstraction layer for Phase 1 (mock data)
// PHASE 2: Replace these functions with actual Supabase API calls

import { campaigns } from '../mock/campaigns.js';
import { milestones } from '../mock/milestones.js';
import { users } from '../mock/users.js';
import { investments } from '../mock/investments.js';
import { supabase } from './supabase.js';

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

  // Update user profile using RPC to bypass RLS
  async updateProfile(userId, profileData) {
    try {
      console.log('🔄 Starting RPC profile update for user:', userId);
      console.log('📝 Raw profile data received:', profileData);
      
      // Prepare data for RPC function (only include supported parameters)
      const rpcParams = {
        user_id: userId,
        p_full_name: profileData.full_name || null,
        p_username: profileData.username || null,
        p_linkedin_url: profileData.linkedin_url || null,
        p_twitter_url: profileData.twitter_url || null,
        p_instagram_url: profileData.instagram_url || null
      };
      
      console.log('🚀 Calling update_user_profile RPC with:', rpcParams);
      
      // Add timeout to prevent hanging
      const rpcPromise = supabase.rpc('update_user_profile', rpcParams);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RPC call timed out after 10 seconds')), 10000)
      );
      
      const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

      if (error) {
        console.error('❌ RPC update failed:', error);
        
        // If RPC function doesn't exist, provide helpful error
        if (error.message?.includes('does not exist')) {
          throw new Error('RPC function not found. Please run the RPC setup SQL in Supabase first.');
        }
        
        throw new Error(`Failed to update profile: ${error.message}`);
      }

      // RPC returns array, get first item
      const updatedProfile = data && data.length > 0 ? data[0] : null;
      
      if (!updatedProfile) {
        throw new Error('Profile update returned no data');
      }

      console.log('🎉 RPC Profile updated successfully:', updatedProfile);
      return { data: updatedProfile, error: null };
      
    } catch (error) {
      console.error('💥 RPC Profile update error:', error);
      return { data: null, error: error };
    }
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

    try {
      await createUserRecord(user.id);
    } catch (recordError) {
      console.warn('selectRole: createUserRecord failed (continuing):', recordError);
    }

    // Method 1: Try using the existing db helper first
    try {
      const updateResult = await db.users.updateProfile(user.id, { role });

      if (!updateResult.error) {
        console.log('Role updated via db.users.updateProfile');
        return { success: true, data: updateResult.data, role };
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
          return { success: true, data: createResult.data, role };
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
    return { success: true, data, role };

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
  const defaultStatus = {
    hasRole: false,
    role: null,
    isKYCVerified: false,
    companyData: null,
    success: true,
    kycStatus: 'not_started'
  };

  try {
    console.log('getUserRoleStatus: Starting with userId:', userId);
    let targetUserId = userId;
    
    // If no userId provided, get current auth user
    if (!targetUserId) {
      console.log('getUserRoleStatus: No userId provided, getting current auth user');
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        console.warn('getUserRoleStatus called without authenticated user');
        return defaultStatus;
      }
      targetUserId = user.id;
      console.log('getUserRoleStatus: Got auth user ID:', targetUserId);
    }

    console.log('getUserRoleStatus: Querying users table for ID:', targetUserId);
    // Get user with role information and verification status
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('role, full_name, email, is_verified')
      .eq('id', targetUserId)
      .maybeSingle();

    console.log('getUserRoleStatus: Query result - userData:', userData, 'error:', userError);

    // If the user record hasn't been created yet, create it
    if (userError && userError.code === 'PGRST116') {
      console.log('getUserRoleStatus: User record not found (PGRST116), creating user record');
      try {
        await createUserRecord(targetUserId);
        console.log('getUserRoleStatus: User record created successfully, returning defaults');
        return defaultStatus;
      } catch (createError) {
        console.error('getUserRoleStatus: Failed to create user record:', createError);
        return defaultStatus;
      }
    }

    if (userError) {
      console.error('getUserRoleStatus: Unexpected error:', userError);
      throw userError;
    }

    const status = {
      ...defaultStatus,
      hasRole: !!userData?.role,
      role: userData?.role ?? null,
      success: true
    };

    console.log('getUserRoleStatus: Base status created:', status);

    // Investors don't require KYC in the current mock flow
    if (status.role === 'investor') {
      const finalStatus = {
        ...status,
        isKYCVerified: true,
        kycStatus: 'not_required'
      };
      console.log('getUserRoleStatus: Returning investor status:', finalStatus);
      return finalStatus;
    }

    // Creators need to complete KYC verification
    if (status.role === 'creator') {
      console.log('getUserRoleStatus: Creator role, checking verification status');
      
      // Check user verification status from users table
      const userVerificationStatus = userData?.is_verified || 'no';
      
      // Check if there's a KYC submission in user_verifications table
      const { data: kycData, error: kycError } = await supabaseClient
        .from('user_verifications')
        .select('id, verification_status, submitted_at, reviewed_at')
        .eq('user_id', targetUserId)
        .maybeSingle();

      console.log('getUserRoleStatus: KYC query result - data:', kycData, 'error:', kycError);

      let kycStatus = 'not_started';
      let isKYCVerified = false;

      if (userVerificationStatus === 'yes') {
        kycStatus = 'approved';
        isKYCVerified = true;
      } else if (userVerificationStatus === 'pending') {
        kycStatus = 'pending';
        isKYCVerified = false;
      } else if (kycData) {
        // There's a KYC submission, check its status
        kycStatus = kycData.verification_status || 'pending';
        isKYCVerified = kycStatus === 'approved';
      }

      const finalStatus = {
        ...status,
        companyData: kycData ? {
          id: kycData.id,
          verified: isKYCVerified,
          submitted_at: kycData.submitted_at,
          reviewed_at: kycData.reviewed_at
        } : null,
        isKYCVerified,
        kycStatus
      };
      console.log('getUserRoleStatus: Returning creator status:', finalStatus);
      return finalStatus;
    }
    
    console.log('getUserRoleStatus: Returning default status (no specific role):', status);
    return status;
    
  } catch (error) {
    console.error('Error getting user role status:', error);
    console.error('Error stack:', error.stack);
    return {
      ...defaultStatus,
      success: false,
      error: error.message
    };
  }
};

/**
 * Creates a user record in the public.users table if it doesn't exist
 * This should be called when a user first signs up or when we detect they don't have a record
 */
export const createUserRecord = async (userId = null) => {
  try {
    let targetUserId = userId;
    let userEmail = null;
    
    // If no userId provided, get current auth user
    if (!targetUserId) {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      targetUserId = user.id;
      userEmail = user.email;
    } else {
      // If userId provided, we need to get the email from auth
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user && user.id === targetUserId) {
        userEmail = user.email;
      }
    }

    console.log('createUserRecord: Creating user record for ID:', targetUserId, 'email:', userEmail);

    // Create the user record
    const { data, error } = await supabaseClient
      .from('users')
      .insert({
        id: targetUserId,
        email: userEmail,
        full_name: userEmail ? userEmail.split('@')[0] : null, // Use email prefix as initial name
        role: null, // No role assigned yet
        verification_level: 'none',
        trust_score: 0
      })
      .select()
      .single();

    if (error) {
      console.error('createUserRecord: Error creating user record:', error);
      throw error;
    }

    console.log('createUserRecord: Successfully created user record:', data);
    return data;
    
  } catch (error) {
    console.error('createUserRecord: Error:', error);
    throw error;
  }
};

// Debug functions - can be called from browser console
if (typeof window !== 'undefined') {
  window.debugUserRoleStatus = async () => {
    try {
      console.log('=== DEBUG getUserRoleStatus ===');
      const result = await getUserRoleStatus();
      console.log('Result:', result);
      return result;
    } catch (error) {
      console.error('Debug error:', error);
      return error;
    }
  };
  
  window.debugAuth = async () => {
    try {
      console.log('=== DEBUG AUTH STATE ===');
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      console.log('Auth user:', user);
      console.log('Auth error:', error);
      return { user, error };
    } catch (error) {
      console.error('Debug auth error:', error);
      return error;
    }
  };
  
  window.debugCreateUser = async () => {
    try {
      console.log('=== DEBUG CREATE USER ===');
      const result = await createUserRecord();
      console.log('Create user result:', result);
      return result;
    } catch (error) {
      console.error('Debug create user error:', error);
      return error;
    }
  };
  
  window.testDirectQuery = async () => {
    try {
      console.log('=== DIRECT DATABASE QUERY TEST ===');
      const userId = '08a623b6-4482-4dd3-a01f-7191dd4e624a';
      
      const { data: userData, error: userError } = await supabaseClient
        .from('users')
        .select('role, full_name, email')
        .eq('id', userId)
        .single();
      
      console.log('Direct query result - userData:', userData, 'error:', userError);
      
      if (!userError) {
        const status = {
          hasRole: !!userData?.role,
          role: userData?.role ?? null,
          isKYCVerified: userData?.role === 'investor' ? true : false,
          companyData: null,
          success: true
        };
        console.log('Expected status:', status);
        return status;
      }
      return { error: userError };
    } catch (error) {
      console.error('Direct query test error:', error);
      return error;
    }
  };
}

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

    const basePayload = {
      owner_id: user.id,
      name: formData.companyName,
      registration_number: formData.registrationNumber || null,
      country: formData.country,
      website: formData.website || null,
      verified: false,
      verification_notes: JSON.stringify({
        businessDescription: formData.businessDescription,
        owner: formData.ownerInfo,
        team: formData.teamInfo
      })
    };

    const { data: existingCompany, error: existingError } = await supabaseClient
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError;
    }

    let response;
    if (existingCompany) {
      response = await supabaseClient
        .from('companies')
        .update(basePayload)
        .eq('id', existingCompany.id)
        .select()
        .single();
    } else {
      response = await supabaseClient
        .from('companies')
        .insert(basePayload)
        .select()
        .single();
    }

    const { data, error } = response;
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

// =============================================================================
// USER PROJECT MANAGEMENT
// =============================================================================

/**
 * Get user's projects (for creators)
 */
export const getUserProjects = async (userId = null) => {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) throw new Error('User not authenticated');

    const { data, error } = await supabaseClient
      .from('projects')
      .select(`
        *,
        project_milestones (
          id,
          name,
          description,
          payout_percentage,
          is_completed,
          completed_at
        ),
        project_investments (
          id,
          amount,
          status,
          created_at
        )
      `)
      .eq('creator_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate aggregated stats for each project
    const projectsWithStats = data?.map(project => {
      const investments = project.project_investments || [];
      const totalRaised = investments
        .filter(inv => inv.status === 'completed')
        .reduce((sum, inv) => sum + inv.amount, 0);
      
      const totalInvestors = new Set(
        investments
          .filter(inv => inv.status === 'completed')
          .map(inv => inv.investor_id)
      ).size;

      const fundingProgress = project.goal_amount > 0 
        ? (totalRaised / project.goal_amount) * 100 
        : 0;

      return {
        ...project,
        total_raised: totalRaised,
        total_investors: totalInvestors,
        funding_progress: Math.min(fundingProgress, 100),
        milestones: project.project_milestones || [],
        investments: investments
      };
    });

    return { success: true, data: projectsWithStats || [] };
  } catch (error) {
    console.error('Error fetching user projects:', error);
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Get user's investments (for investors)
 */
export const getUserInvestments = async (userId = null) => {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) throw new Error('User not authenticated');

    const { data, error } = await supabaseClient
      .from('project_investments')
      .select(`
        *,
        projects (
          id,
          title,
          slug,
          summary,
          description,
          category,
          goal_amount,
          deadline,
          image_url,
          status,
          created_at
        )
      `)
      .eq('investor_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching user investments:', error);
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Update project details
 */
export const updateProject = async (projectId, updates) => {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabaseClient
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .eq('creator_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating project:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete project (and associated data)
 */
export const deleteProject = async (projectId) => {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if project has any completed investments
    const { data: investments } = await supabaseClient
      .from('project_investments')
      .select('status')
      .eq('project_id', projectId)
      .eq('status', 'completed');

    if (investments && investments.length > 0) {
      throw new Error('Cannot delete project with completed investments');
    }

    // Delete in order: milestones, investments, then project
    await supabaseClient
      .from('project_milestones')
      .delete()
      .eq('project_id', projectId);

    await supabaseClient
      .from('project_investments')
      .delete()
      .eq('project_id', projectId);

    const { error } = await supabaseClient
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('creator_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting project:', error);
    return { success: false, error: error.message };
  }
};