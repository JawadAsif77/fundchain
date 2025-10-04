// =============================================================================
// API LAYER - UPDATED FOR REAL DATABASE SCHEMA
// =============================================================================
// Complete API overhaul based on actual Supabase schema
// Handles all CRUD operations for the FundChain platform
// =============================================================================

import { supabase } from './supabase.js';

// Mock data imports (for fallback during development)
import { campaigns } from '../mock/campaigns.js';
import { milestones } from '../mock/milestones.js';
import { users } from '../mock/users.js';
import { investments } from '../mock/investments.js';

// Simulate network delay for better UX
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// =============================================================================
// USER API - Based on your exact users table
// =============================================================================
export const userApi = {
  // Get user profile by ID
  async getProfile(userId) {
    try {
      console.log('🔍 API: Fetching user profile for:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, email, username, full_name, avatar_url, role,
          linkedin_url, twitter_url, instagram_url, is_verified,
          created_at, updated_at, bio, location, phone, date_of_birth,
          social_links, preferences, verification_level, trust_score,
          referral_code, last_active_at, followers_count, following_count,
          is_accredited_investor, total_invested, total_campaigns_backed
        `)
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Failed to fetch user profile:', error);
        throw new Error(`Failed to fetch profile: ${error.message}`);
      }

      console.log('✅ User profile fetched successfully');
      return { data };
    } catch (error) {
      console.error('💥 Get profile error:', error);
      throw error;
    }
  },

  // Update user profile
  async updateProfile(userId, profileData) {
    try {
      console.log('🔄 API: Starting profile update for user:', userId);
      console.log('📝 Profile data received:', profileData);
      
      // Map form data to exact database columns
      const updateData = {};
      
      // Basic fields
      if (profileData.full_name !== undefined) updateData.full_name = profileData.full_name;
      if (profileData.username !== undefined) updateData.username = profileData.username;
      if (profileData.bio !== undefined) updateData.bio = profileData.bio;
      if (profileData.location !== undefined) updateData.location = profileData.location;
      if (profileData.phone !== undefined) updateData.phone = profileData.phone;
      if (profileData.date_of_birth !== undefined) updateData.date_of_birth = profileData.date_of_birth;
      if (profileData.avatar_url !== undefined) updateData.avatar_url = profileData.avatar_url;
      
      // Social media (individual columns)
      if (profileData.linkedin_url !== undefined) updateData.linkedin_url = profileData.linkedin_url;
      if (profileData.twitter_url !== undefined) updateData.twitter_url = profileData.twitter_url;
      if (profileData.instagram_url !== undefined) updateData.instagram_url = profileData.instagram_url;
      
  // JSONB fields
  if (profileData.social_links !== undefined) updateData.social_links = profileData.social_links || {};
  if (profileData.preferences !== undefined) updateData.preferences = profileData.preferences;
      
      // Role enum (include only on explicit change)
      if (profileData.role && ['investor', 'creator', 'admin'].includes(profileData.role)) {
        updateData.role = profileData.role;
      }
      
      // Always update timestamp
      updateData.updated_at = new Date().toISOString();
      
      console.log('✅ Mapped to database format:', updateData);
      
      // Perform update with minimal return to avoid RLS issues on SELECT after UPDATE
      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (updateError) {
        console.error('❌ Database update failed:', updateError);
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }

      console.log('✅ Update applied, fetching fresh profile...');
      const { data, error: fetchError } = await supabase
        .from('users')
        .select(`
          id, email, username, full_name, avatar_url, role,
          linkedin_url, twitter_url, instagram_url, is_verified,
          created_at, updated_at, bio, location, phone, date_of_birth,
          social_links, preferences, verification_level, trust_score,
          referral_code, last_active_at, followers_count, following_count,
          is_accredited_investor, total_invested, total_campaigns_backed
        `)
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('⚠️ Profile fetch after update failed:', fetchError);
        throw new Error(`Profile updated but fetch failed: ${fetchError.message}`);
      }

      console.log('🎉 Profile updated and fetched successfully');
      // Normalize return shape for callers expecting { data, error }
      return { data, error: null };
      
    } catch (error) {
      console.error('💥 Profile update error:', error);
      // Normalize thrown error shape similar to Supabase helpers
      throw error;
    }
  },

  // Create new user record
  async createUser(userData) {
    try {
      console.log('🆕 API: Creating user record');
      
      const userRecord = {
        id: userData.id,
        email: userData.email,
        full_name: userData.user_metadata?.full_name || userData.email?.split('@')[0],
        role: 'investor', // Default role
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('users')
        .insert(userRecord)
        .select('*')
        .single();
        
      if (error) {
        console.error('❌ User creation failed:', error);
        throw new Error(`Failed to create user: ${error.message}`);
      }
      
      console.log('✅ User created successfully');
      return data;
    } catch (error) {
      console.error('💥 Create user error:', error);
      throw error;
    }
  }
};

// =============================================================================
// KYC API - Based on your user_verifications table
// =============================================================================
export const kycApi = {
  // Submit KYC verification
  async submitKyc(kycData) {
    try {
      console.log('🔄 API: Submitting KYC verification');
      
      const verificationData = {
        user_id: kycData.user_id,
        legal_name: kycData.legal_name,
        legal_address: kycData.legal_address, // JSONB with required fields
        phone: kycData.phone,
        legal_email: kycData.legal_email,
        business_email: kycData.business_email || null,
        id_document_url: kycData.id_document_url || null,
        selfie_image_url: kycData.selfie_image_url || null,
        verification_type: kycData.verification_type || 'individual',
        verification_status: 'pending',
        submitted_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from('user_verifications')
        .upsert(verificationData, { 
          onConflict: 'user_id'
        })
        .select('*')
        .single();
        
      if (error) {
        console.error('❌ KYC submission failed:', error);
        throw new Error(`KYC submission failed: ${error.message}`);
      }
      
      console.log('✅ KYC submitted successfully');
      return data;
    } catch (error) {
      console.error('💥 KYC submission error:', error);
      throw error;
    }
  },

  // Get KYC status
  async getKycStatus(userId) {
    try {
      const { data, error } = await supabase
        .from('user_verifications')
        .select('verification_status, verification_type, submitted_at, reviewed_at')
        .eq('user_id', userId)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to get KYC status: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      console.error('💥 Get KYC status error:', error);
      throw error;
    }
  }
};

// =============================================================================
// COMPANY API - Based on your companies table
// =============================================================================
export const companyApi = {
  // Create company
  async createCompany(companyData) {
    try {
      console.log('🔄 API: Creating company');
      
      const { data, error } = await supabase
        .from('companies')
        .insert({
          owner_id: companyData.owner_id,
          name: companyData.name,
          registration_number: companyData.registration_number || null,
          country: companyData.country,
          website: companyData.website || null,
          verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();
        
      if (error) {
        console.error('❌ Company creation failed:', error);
        throw new Error(`Company creation failed: ${error.message}`);
      }
      
      console.log('✅ Company created successfully');
      return data;
    } catch (error) {
      console.error('💥 Company creation error:', error);
      throw error;
    }
  },

  // Get user's companies
  async getUserCompanies(userId) {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) {
        throw new Error(`Failed to get companies: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      console.error('💥 Get companies error:', error);
      throw error;
    }
  }
};

// =============================================================================
// PROJECT API - Based on your projects table
// =============================================================================
export const projectApi = {
  // Create project
  async createProject(projectData) {
    try {
      console.log('🔄 API: Creating project');
      
      const { data, error } = await supabase
        .from('projects')
        .insert({
          creator_id: projectData.creator_id,
          company_id: projectData.company_id,
          title: projectData.title,
          slug: projectData.slug,
          summary: projectData.summary,
          description: projectData.description || null,
          category: projectData.category,
          goal_amount: projectData.goal_amount,
          deadline: projectData.deadline,
          status: 'draft',
          image_url: projectData.image_url || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();
        
      if (error) {
        console.error('❌ Project creation failed:', error);
        throw new Error(`Project creation failed: ${error.message}`);
      }
      
      console.log('✅ Project created successfully');
      return data;
    } catch (error) {
      console.error('💥 Project creation error:', error);
      throw error;
    }
  },

  // Get all projects (public)
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          companies(name, verified),
          users!projects_creator_id_fkey(full_name, avatar_url, is_verified)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
        
      if (error) {
        throw new Error(`Failed to get projects: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      console.error('💥 Get all projects error:', error);
      throw error;
    }
  },

  // Get user's projects
  async getUserProjects(userId) {
    try {
      let query = supabase
        .from('projects')
        .select(`
          *,
          companies(name, verified)
        `)
        .order('created_at', { ascending: false });
      
      // If userId is provided, filter by creator, otherwise get all
      if (userId) {
        query = query.eq('creator_id', userId);
      }
        
      const { data, error } = await query;
        
      if (error) {
        throw new Error(`Failed to get projects: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      console.error('💥 Get projects error:', error);
      throw error;
    }
  }
};

// =============================================================================
// CAMPAIGN API - Based on your campaigns table
// =============================================================================
export const campaignApi = {
  // Get all campaigns with filters
  async getCampaigns(filters = {}) {
    try {
      let query = supabase
        .from('campaigns')
        .select(`
          *,
          categories(name, icon),
          users!campaigns_creator_id_fkey(full_name, avatar_url, is_verified)
        `)
        .eq('status', 'active'); // Only show active campaigns
      
      // Apply filters
      if (filters.category) {
        query = query.eq('categories.name', filters.category);
      }
      
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%, description.ilike.%${filters.search}%`);
      }
      
      query = query.order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Failed to fetch campaigns:', error);
        // Fallback to mock data
        return { data: campaigns, count: campaigns.length };
      }
      
      return { data: data || [], count: data?.length || 0 };
    } catch (error) {
      console.error('💥 Get campaigns error:', error);
      // Fallback to mock data
      return { data: campaigns, count: campaigns.length };
    }
  },

  // Get campaign by slug
  async getCampaignBySlug(slug) {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          categories(name, icon, color),
          users!campaigns_creator_id_fkey(full_name, avatar_url, is_verified, bio)
        `)
        .eq('slug', slug)
        .single();
        
      if (error) {
        console.error('❌ Campaign not found:', error);
        // Fallback to mock data
        const campaign = campaigns.find(c => c.slug === slug);
        if (!campaign) throw new Error('Campaign not found');
        return { data: campaign };
      }
      
      return { data };
    } catch (error) {
      console.error('💥 Get campaign error:', error);
      throw error;
    }
  }
};

// =============================================================================
// INVESTMENT API - Based on your investments table
// =============================================================================
export const investmentApi = {
  // Get user investments
  async getUserInvestments(userId) {
    try {
      const { data, error } = await supabase
        .from('investments')
        .select(`
          *,
          campaigns(title, slug, image_url, status)
        `)
        .eq('investor_id', userId)
        .order('investment_date', { ascending: false });
        
      if (error) {
        console.error('❌ Failed to fetch investments:', error);
        return { data: [], count: 0 };
      }
      
      return { data: data || [], count: data?.length || 0 };
    } catch (error) {
      console.error('💥 Get investments error:', error);
      return { data: [], count: 0 };
    }
  }
};

// =============================================================================
// NOTIFICATION API - Based on your notifications table
// =============================================================================
export const notificationApi = {
  // Get user notifications
  async getUserNotifications(userId) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) {
        throw new Error(`Failed to get notifications: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      console.error('💥 Get notifications error:', error);
      return [];
    }
  },

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
        
      if (error) {
        throw new Error(`Failed to mark notification as read: ${error.message}`);
      }
    } catch (error) {
      console.error('💥 Mark notification as read error:', error);
      throw error;
    }
  }
};

// =============================================================================
// LEGACY COMPATIBILITY FUNCTIONS
// =============================================================================
// These functions provide backward compatibility for existing components

export const getUserRoleStatus = async (userId) => {
  try {
    const { data } = await userApi.getProfile(userId);
    
    // Check if user has a valid role set (investor and creator are both valid)
    const validRoles = ['investor', 'creator', 'admin'];
    const hasRole = !!(data?.role && validRoles.includes(data.role));
    
    // For creators, check if they have KYC verification or company data
    let companyData = null;
    let hasKycVerification = false;
    
    if (data?.role === 'creator') {
      try {
        // Check for KYC verification first
        const kycStatus = await kycApi.getKycStatus(userId);
        hasKycVerification = !!(kycStatus && (kycStatus.verification_status === 'pending' || kycStatus.verification_status === 'approved'));
        
        // Also check for company data
        const companies = await companyApi.getUserCompanies(userId);
        companyData = companies?.length > 0 ? companies[0] : null;
      } catch (error) {
        console.warn('Could not fetch KYC/company data:', error);
      }
    }
    
    return {
      hasRole,
      // Normalize to a valid role with investor as safe default
      role: validRoles.includes(data?.role) ? data.role : 'investor',
      isVerified: data?.is_verified || false,
      verificationLevel: data?.verification_level || 'basic',
      companyData,
      hasKycVerification
    };
  } catch (error) {
    console.error('Error getting user role status:', error);
    return { 
      hasRole: false,
      role: 'investor', 
      isVerified: false, 
      verificationLevel: 'basic',
      companyData: null,
      hasKycVerification: false
    };
  }
};

export const getPublicProjects = async () => {
  try {
    return await projectApi.getUserProjects(); // Get all projects (public)
  } catch (error) {
    console.error('Error getting public projects:', error);
    return { data: [] };
  }
};

export const getUserProjects = async (userId) => {
  try {
    const data = await projectApi.getUserProjects(userId);
    return { data };
  } catch (error) {
    console.error('Error getting user projects:', error);
    return { data: [] };
  }
};

export const getUserInvestments = async (userId) => {
  try {
    return await investmentApi.getUserInvestments(userId);
  } catch (error) {
    console.error('Error getting user investments:', error);
    return { data: [] };
  }
};

export const createProjectWithMilestones = async (projectData) => {
  try {
    return await projectApi.create(projectData);
  } catch (error) {
    console.error('Error creating project with milestones:', error);
    throw error;
  }
};

export const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

export const validateMilestones = (milestones) => {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return { isValid: false, error: 'At least one milestone is required' };
  }

  for (let i = 0; i < milestones.length; i++) {
    const milestone = milestones[i];
    if (!milestone.title?.trim()) {
      return { isValid: false, error: `Milestone ${i + 1}: Title is required` };
    }
    if (!milestone.description?.trim()) {
      return { isValid: false, error: `Milestone ${i + 1}: Description is required` };
    }
    if (!milestone.amount || milestone.amount <= 0) {
      return { isValid: false, error: `Milestone ${i + 1}: Valid amount is required` };
    }
  }

  return { isValid: true };
};

// =============================================================================
// EXPORTS
// =============================================================================
export default {
  userApi,
  kycApi,
  companyApi,
  projectApi,
  campaignApi,
  investmentApi,
  notificationApi
};