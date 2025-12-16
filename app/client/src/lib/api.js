// =============================================================================
// API LAYER - UPDATED FOR REAL DATABASE SCHEMA
// =============================================================================
// Complete API overhaul based on actual Supabase schema
// Handles all CRUD operations for the FundChain platform
// =============================================================================

import { supabase } from './supabase.js';

// Add at the top of the file, after imports
const ensureValidSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.warn('[API] No valid session, attempting refresh...');
      const { data: { session: refreshedSession }, error: refreshError } = 
        await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('[API] Session refresh failed:', refreshError);
        throw new Error('Authentication expired. Please log in again.');
      }
      
      return refreshedSession;
    }
    
    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at * 1000;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiresAt - now < fiveMinutes) {
      console.log('[API] Token expiring soon, refreshing...');
      const { data: { session: refreshedSession } } = 
        await supabase.auth.refreshSession();
      return refreshedSession || session;
    }
    
    return session;
  } catch (error) {
    console.error('[API] Session check failed:', error);
    throw error;
  }
};

// Timeout helper without auth check (for public endpoints)
export const withTimeoutPublic = async (promise, timeoutMs = 10000, retries = 2) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
        )
      ]);
    } catch (error) {
      if (attempt === retries) throw error;
      console.warn(`[API] Retry ${attempt + 1}/${retries}:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
};

// Connection pool management (Fix 7)
let activeConnections = 0;
const MAX_CONNECTIONS = 40;

const waitForConnection = async () => {
  while (activeConnections >= MAX_CONNECTIONS) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  activeConnections++;
};

const releaseConnection = () => {
  activeConnections = Math.max(0, activeConnections - 1);
};

// Update withTimeout to include session check (for authenticated endpoints)
export const withTimeout = async (promise, timeoutMs = 10000, retries = 2) => {
  await waitForConnection();
  
  let lastError;
  
  for (let i = 0; i <= retries; i++) {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      );
      
      const result = await Promise.race([promise, timeoutPromise]);
      releaseConnection();
      return result;
    } catch (error) {
      lastError = error;
      
      // Only validate session on auth errors (Fix 1)
      if (error.message?.includes('JWT') || error.message?.includes('auth') || 
          error.code === '401' || error.code === 'PGRST301') {
        console.log('[API] Auth error, refreshing session once');
        await ensureValidSession();
      }
      
      if (!error.message?.includes('timeout') && 
          !error.message?.includes('connection') &&
          !error.message?.includes('closed') &&
          !error.message?.includes('JWT')) {
        releaseConnection();
        throw error;
      }
      
      if (i < retries) {
        console.log(`[API] Retry ${i + 1}/${retries} after error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  releaseConnection();
  throw lastError;
};

// Simulate network delay for better UX
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// Fix 3: Request deduplication cache
const requestCache = new Map();

export const clearRequestCache = () => {
  requestCache.clear();
  console.log('[API] Request cache cleared');
};

const dedupeRequest = async (key, requestFn, ttl = 3000) => {
  if (requestCache.has(key)) {
    console.log(`[API] Reusing request: ${key}`);
    return requestCache.get(key);
  }

  const promise = requestFn().finally(() => {
    setTimeout(() => requestCache.delete(key), ttl);
  });

  requestCache.set(key, promise);
  return promise;
};

// =============================================================================
// USER API - Based on your exact users table
// =============================================================================
export const userApi = {
  // Get user profile by ID
  async getProfile(userId) {
    return dedupeRequest(`profile-${userId}`, async () => {
      try {
        console.log('🔍 API: Fetching user profile for:', userId);

      const { data, error } = await withTimeout(
        supabase
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
          .single(),
        15000
      );

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
    });
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

      // Perform update and return updated data in one query
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select('*')
        .single();

      if (error) {
        console.error('❌ Database update failed:', error);
        throw new Error(`Failed to update profile: ${error.message}`);
      }

      console.log('🎉 Profile updated successfully:', data);
      // Normalize return shape for callers expecting { data, error }
      return { data, error: null };

    } catch (error) {
      console.error('💥 Profile update error:', error);
      // Normalize thrown error shape similar to Supabase helpers
      throw error;
    }
  },

  // Check if username is available
  async checkUsernameAvailability(username) {
    try {
      if (!username || username.trim().length === 0) {
        return { available: false, error: 'Username is required' };
      }

      const { data, error } = await withTimeoutPublic(
        supabase
          .from('users')
          .select('username')
          .eq('username', username.trim())
          .maybeSingle(),
        5000,
        1
      );

      if (error) {
        console.error('Username check error:', error);
        return { available: false, error: 'Error checking username availability' };
      }

      return { available: !data, error: null };
    } catch (error) {
      console.error('Username check failed:', error);
      return { available: false, error: 'Error checking username availability' };
    }
  },

  // Create new user record
  async createUser(userData) {
    try {
      console.log('🆕 API: Creating user record', userData);

      const userRecord = {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name || userData.user_metadata?.full_name || userData.email?.split('@')[0],
        username: userData.username || userData.user_metadata?.username || null,
        role: userData.role || userData.user_metadata?.role || 'investor',
        avatar_url: userData.avatar_url || userData.user_metadata?.avatar_url || null,
        is_verified: userData.is_verified || 'no',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('🆕 API: Inserting user record:', userRecord);

      const { data, error } = await supabase
        .from('users')
        .insert(userRecord)
        .select('*')
        .single();

      if (error) {
        console.error('❌ User creation failed:', error);
        throw new Error(`Failed to create user: ${error.message}`);
      }

      console.log('✅ User created successfully:', data);
      
      // Auto-create wallet for new user
      try {
        console.log('💰 Creating wallet for new user:', data.id);
        const { data: walletData, error: walletError } = await supabase.functions.invoke('create-user-wallet', {
          body: { userId: data.id }
        });
        
        if (walletError) {
          console.error('⚠️ Wallet creation failed:', walletError);
        } else {
          console.log('✅ Wallet created successfully:', walletData);
        }
      } catch (walletErr) {
        console.warn('⚠️ Wallet auto-creation error (non-fatal):', walletErr);
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('💥 Create user error:', error);
      throw error;
    }
  },

  // Update wallet address
  async updateWalletAddress(userId, address) {
    try {
      console.log('🔄 API: Updating wallet address for user:', userId);
      
      const { data, error } = await supabase
        .from('users')
        .update({ wallet_address: address })
        .eq('id', userId)
        .select('*')
        .single();

      if (error) {
        console.error('❌ Wallet address update failed:', error);
        throw new Error(`Failed to update wallet address: ${error.message}`);
      }

      console.log('✅ Wallet address updated successfully:', data);
      return { data, error: null };
    } catch (error) {
      console.error('💥 Update wallet address error:', error);
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
        submitted_at: new Date().toISOString(),
        reviewed_at: null, // Reset reviewed_at when resubmitting
        reviewed_by: null // Reset reviewed_by when resubmitting
      };

      const { data, error } = await supabase
        .from('user_verifications')
        .upsert(verificationData, {
          onConflict: 'user_id',
          ignoreDuplicates: false // Ensure updates happen
        })
        .select('*')
        .single();

      if (error) {
        console.error('❌ KYC submission failed:', error);
        throw new Error(`KYC submission failed: ${error.message}`);
      }

      // Also update users.is_verified to 'pending'
      const { error: updateError } = await supabase
        .from('users')
        .update({ is_verified: 'pending' })
        .eq('id', kycData.user_id);

      if (updateError) {
        console.warn('⚠️ Failed to update user verification status:', updateError);
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
  // Ensure a category exists and return its id
  async ensureCategoryByName(name) {
    if (!name) return null;
    try {
      const { data: existing, error: selErr } = await supabase
        .from('categories')
        .select('id')
        .eq('name', name)
        .single();
      if (!selErr && existing) return existing.id;
    } catch (_) { }
    // Insert if not found
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name, created_at: new Date().toISOString() })
        .select('id')
        .single();
      if (error) return null;
      return data?.id || null;
    } catch (_) {
      return null;
    }
  },

  // Read-only helper to fetch a category id by name without creating it
  async getCategoryIdByName(name) {
    if (!name) return null;
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id')
        .eq('name', name)
        .single();
      if (error) return null;
      return data?.id || null;
    } catch (_) {
      return null;
    }
  },

  // Create a campaign draft/pending review
  async createCampaign(form, creatorId) {
    try {
      // Resolve creator_id from current session if not provided
      let finalCreatorId = creatorId;
      if (!finalCreatorId) {
        const { data: authData } = await supabase.auth.getUser();
        finalCreatorId = authData?.user?.id || null;
      }

      const category_id = await this.ensureCategoryByName(form.category);
      const payload = {
        creator_id: finalCreatorId,
        category_id,
        title: form.title,
        slug: form.slug,
        description: form.description,
        short_description: form.summary || null,
        image_url: form.imageUrl || null,
        funding_goal: form.goalAmount,
        min_investment: Math.max(10, Math.min(1000, Math.floor((form.goalAmount || 1000) / 100))),
        end_date: form.deadline ? new Date(form.deadline).toISOString() : null,
        status: 'pending_review',
        verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('campaigns')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('💥 Create campaign error:', error);
      return { success: false, error: error.message };
    }
  },
  // Get all campaigns with filters
  async getCampaigns(filters = {}) {
    try {
      // Simplified query without join for better performance
      let query = supabase
        .from('campaigns')
        .select('*');

      // Apply status filter - default to active if not specified
      const status = filters.status || 'active';
      if (status && status !== '') {
        query = query.eq('status', status);
      }

      // Apply filters
      if (filters.category) {
        const catId = await this.getCategoryIdByName(filters.category);
        if (catId) query = query.eq('category_id', catId);
      }

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%, description.ilike.%${filters.search}%`);
      }

      query = query.order('created_at', { ascending: false });

      // Use public timeout for guest access - increased timeout, no retries
      const { data, error } = await withTimeoutPublic(query, 30000, 0);

      if (error) {
        console.error('❌ Failed to fetch campaigns:', error);
        return { data: [], count: 0, error: error.message };
      }

      return { data: data || [], count: data?.length || 0 };
    } catch (error) {
      console.error('💥 Get campaigns error:', error);
      return { data: [], count: 0, error: error.message };
    }
  },

  // Get campaigns created by a specific user (any status)
  async getUserCampaigns(userId) {
    try {
      // Fallback: infer current user if not provided
      let uid = userId;
      if (!uid) {
        const { data: authData } = await supabase.auth.getUser();
        uid = authData?.user?.id || null;
      }

      console.log('🔍 API: getUserCampaigns called for userId:', uid);

      const { data, error } = await withTimeout(
        supabase
          .from('campaigns')
          .select(`
            *,
            categories(name, icon)
          `)
          .eq('creator_id', uid)
          .order('created_at', { ascending: false }),
        15000
      );

      console.log('📊 API: getUserCampaigns query result. Error:', error, 'Data count:', data?.length);

      if (error) {
        console.error('❌ API: getUserCampaigns error:', error);
        throw error;
      }

      console.log('✅ API: getUserCampaigns success. Returning', data?.length || 0, 'campaigns');
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('💥 Get user campaigns error:', error);
      return { success: false, data: [], error: error.message };
    }
  },

  // Get campaign by slug
  async getCampaignBySlug(slug) {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          categories(name, icon, color)
        `)
        .eq('slug', slug)
        .single();

      if (error) {
        console.error('❌ Campaign not found:', error);
        throw new Error('Campaign not found');
      }
      // Try to fetch authoritative stats via RPC (if deployed)
      try {
        const { data: stats, error: statsErr } = await supabase.rpc('get_campaign_stats', { campaign_id: data.id });
        if (!statsErr && stats && (typeof stats.current_funding !== 'undefined')) {
          // Merge stats onto row
          return { data: { ...data, current_funding: stats.current_funding, investor_count: stats.investor_count } };
        }
      } catch (_) {
        // Ignore if RPC not available; fall back to row values
      }
      // Fallback: compute from investments if triggers are not active
      try {
        const { data: invs, error: invErr } = await supabase
          .from('investments')
          .select('amount, investor_id, status')
          .eq('campaign_id', data.id)
          .eq('status', 'confirmed');
        if (!invErr && Array.isArray(invs)) {
          const current = Number(
            invs.reduce((sum, row) => sum + Number(row.amount || 0), 0)
          );
          const uniqueInvestors = new Set(invs.map(r => r.investor_id)).size;
          const merged = {
            ...data,
            current_funding: (Number(data.current_funding || 0) > 0) ? Number(data.current_funding) : current,
            investor_count: (Number(data.investor_count || 0) > 0) ? Number(data.investor_count) : uniqueInvestors
          };
          return { data: merged };
        }
      } catch (_) { }
      return { data };
    } catch (error) {
      console.error('💥 Get campaign error:', error);
      throw error;
    }
  },

  // Get milestones for a campaign
  async getMilestones(campaignId) {
    try {
      const { data, error } = await supabase
        .from('milestones')
        .select('id, title, description, target_amount, order_index, is_completed, created_at')
        .eq('campaign_id', campaignId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('💥 Get milestones error:', error);
      return { success: false, data: [], error: error.message };
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
      console.log('💰 API: Fetching investments for user:', userId);

      // First check if there are ANY investments for this user
      const { data: basicData, error: basicError } = await withTimeout(
        supabase
          .from('investments')
          .select('id, investor_id, campaign_id, amount, status, investment_date')
          .eq('investor_id', userId),
        15000
      );

      console.log('💰 API: Basic investment check result:', basicData);
      console.log('💰 API: Basic investment check error:', basicError);

      if (basicError) {
        console.error('❌ Failed basic investment check:', basicError);
        return { data: [], count: 0 };
      }

      if (!basicData || basicData.length === 0) {
        console.log('💰 API: No investments found for user');
        return { data: [], count: 0 };
      }

      // If we have investments, try to get them with campaign data
      const { data, error } = await withTimeout(
        supabase
          .from('investments')
          .select(`
            id,
            investor_id,
            campaign_id,
            amount,
            status,
            investment_date,
            created_at,
            campaigns!inner(
              id,
              title,
              slug,
              short_description,
              image_url,
              status,
              funding_goal,
              current_funding,
              end_date
            )
          `)
          .eq('investor_id', userId)
          .order('investment_date', { ascending: false }),
        15000
      );

      if (error) {
        console.warn('💰 API: Join query failed, using basic data:', error.message);

        // Fallback: manually join the data
        const enrichedData = await Promise.all(
          basicData.map(async (investment) => {
            const { data: campaign } = await supabase
              .from('campaigns')
              .select('id, title, slug, short_description, image_url, status, funding_goal, current_funding, end_date')
              .eq('id', investment.campaign_id)
              .single();

            return {
              ...investment,
              campaigns: campaign
            };
          })
        );

        console.log('✅ Investments enriched manually:', enrichedData.length);
        return { data: enrichedData, count: enrichedData.length };
      }

      console.log('✅ Investments fetched with join:', data?.length || 0, 'investments');
      console.log('💰 API: Sample investment data:', data?.[0]);

      return { data: data || [], count: data?.length || 0 };
    } catch (error) {
      console.error('💥 Get investments error:', error);
      return { data: [], count: 0 };
    }
  }
};

// =============================================================================
// WALLET API - Dummy wallet stored in users.preferences.wallet_balance
// =============================================================================
export const walletApi = {
  async getBalance() {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return { success: false, balance: 0, error: 'Not authenticated' };

    const { data, error } = await withTimeout(
      supabase
        .from('users')
        .select('preferences')
        .eq('id', uid)
        .single(),
      10000
    );

    // If user profile doesn't exist yet, return 0 balance instead of error
    if (error && error.code === 'PGRST116') {
      console.log('User profile not found, returning 0 balance');
      return { success: true, balance: 0 };
    }

    if (error) return { success: false, balance: 0, error: error.message };
    const balance = Number(data?.preferences?.wallet_balance || 0);
    return { success: true, balance };
  },

  async topUp(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: 'Invalid amount' };
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return { success: false, error: 'Not authenticated' };

    // Read current preferences
    const { data: current, error: readErr } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', uid)
      .single();

    // If user profile doesn't exist, create a basic one first
    if (readErr && readErr.code === 'PGRST116') {
      console.log('User profile not found for topUp, creating basic profile...');
      const basicProfile = {
        id: uid,
        email: auth.user.email,
        full_name: auth.user.user_metadata?.full_name || auth.user.email?.split('@')[0] || '',
        username: auth.user.user_metadata?.username || null,
        role: auth.user.user_metadata?.role || 'investor',
        is_verified: 'no',
        preferences: { wallet_balance: Number(amount) },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertErr } = await supabase
        .from('users')
        .insert(basicProfile);

      if (insertErr) return { success: false, error: insertErr.message };
      return { success: true, balance: Number(amount) };
    }

    if (readErr) return { success: false, error: readErr.message };

    const prefs = current?.preferences || {};
    const nextBalance = Number(prefs.wallet_balance || 0) + Number(amount);
    const nextPrefs = { ...prefs, wallet_balance: nextBalance };
    const { error: updErr } = await supabase
      .from('users')
      .update({ preferences: nextPrefs, updated_at: new Date().toISOString() })
      .eq('id', uid);
    if (updErr) return { success: false, error: updErr.message };
    return { success: true, balance: nextBalance };
  },

  async invest(campaignId, amount) {
    if (!campaignId) return { success: false, error: 'Missing campaign' };
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: 'Invalid amount' };
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return { success: false, error: 'Not authenticated' };
    // Check balance
    const bal = await this.getBalance();
    if (!bal.success) return bal;
    if (bal.balance < amount) return { success: false, error: 'Insufficient balance' };

    // Try to insert a new confirmed investment
    const insertPayload = {
      investor_id: uid,
      campaign_id: campaignId,
      amount: Number(amount),
      status: 'confirmed',
      investment_date: new Date().toISOString(),
      confirmed_at: new Date().toISOString()
    };

    let inv = null;
    let invErr = null;
    try {
      const res = await supabase
        .from('investments')
        .insert(insertPayload)
        .select('*')
        .single();
      inv = res.data;
      invErr = res.error || null;
    } catch (e) {
      invErr = e;
    }

    // If duplicate (one investment per user per campaign), increment existing investment instead
    if (invErr && (invErr.code === '23505' || String(invErr.message || '').includes('investments_investor_id_campaign_id_key'))) {
      // Fetch existing investment
      const { data: existing, error: fetchErr } = await supabase
        .from('investments')
        .select('*')
        .eq('investor_id', uid)
        .eq('campaign_id', campaignId)
        .single();
      if (fetchErr || !existing) {
        return { success: false, error: (fetchErr?.message || 'Existing investment not found') };
      }

      const newTotalAmount = Number(existing.amount || 0) + Number(amount);

      // If previously confirmed, temporarily set to pending to let trigger subtract old amount
      if (existing.status === 'confirmed') {
        const { error: toPendingErr } = await supabase
          .from('investments')
          .update({ status: 'pending' })
          .eq('id', existing.id);
        if (toPendingErr) {
          return { success: false, error: toPendingErr.message };
        }
      }

      // Now set new amount and confirm again so trigger re-adds with new total
      const { data: upd, error: updErr } = await supabase
        .from('investments')
        .update({ amount: newTotalAmount, status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (updErr) {
        return { success: false, error: updErr.message };
      }
      inv = upd;
    } else if (invErr) {
      // Other errors
      return { success: false, error: invErr.message };
    }

    // Decrement balance
    const { data: current, error: readErr } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', uid)
      .single();

    if (!readErr && current) {
      const prefs = current.preferences || {};
      const nextBalance = Number(prefs.wallet_balance || 0) - Number(amount);
      const nextPrefs = { ...prefs, wallet_balance: nextBalance };
      await supabase
        .from('users')
        .update({ preferences: nextPrefs, updated_at: new Date().toISOString() })
        .eq('id', uid);
    }

    return { success: true, investment: inv };
  }
};

// =============================================================================
// MILESTONE API
// =============================================================================
export const milestoneApi = {
  async createMilestone(milestoneData) {
    try {
      const { data, error } = await supabase
        .from('milestones')
        .insert(milestoneData)
        .select()
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Create milestone error:', error);
      return { success: false, error: error.message };
    }
  }
};

// =============================================================================
// UTILITY FUNCTIONS & COMPOSITE ACTIONS
// =============================================================================

export const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};

export const validateMilestones = (milestones) => {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return { isValid: false, error: 'At least one milestone is required' };
  }
  const totalPercentage = milestones.reduce((sum, m) => sum + (parseFloat(m.payoutPercentage) || 0), 0);

  // Allow small floating point error
  if (Math.abs(totalPercentage - 100) > 0.1) {
    return { isValid: false, error: `Total percentage must be 100% (current: ${totalPercentage.toFixed(1)}%)` };
  }
  return { isValid: true };
};

export const createProjectWithMilestones = async (projectData, milestones) => {
  try {
    // 1. Create Campaign
    const campaignRes = await campaignApi.createCampaign(projectData);
    if (!campaignRes.success || !campaignRes.data) {
      throw new Error(campaignRes.error || 'Failed to create campaign');
    }
    const campaignId = campaignRes.data.id;

    // 2. Create Milestones
    const milestonePromises = milestones.map((m, index) => {
      return milestoneApi.createMilestone({
        campaign_id: campaignId,
        title: m.name,
        description: m.description,
        target_amount: (projectData.goalAmount * (m.payoutPercentage / 100)),
        order_index: index,
        is_completed: false
      });
    });

    await Promise.all(milestonePromises);

    return { success: true, data: campaignRes.data };
  } catch (error) {
    console.error('createProjectWithMilestones error:', error);
    return { success: false, error: error.message };
  }
};

// =============================================================================
// HELPER FOR ROLE STATUS
// =============================================================================

// Map enum → UI strings
const mapVerificationStatus = (raw) => {
  if (!raw) return 'not_started';
  switch (raw) {
    case 'approved':
    case 'verified':
      return 'approved';
    case 'pending':
    case 'in_review':
      return 'pending';
    case 'rejected':
    case 'failed':
      return 'rejected';
    default:
      return raw; // fallback
  }
};

export const getUserRoleStatus = async (userId) => {
  if (!userId) {
    return {
      hasRole: false,
      role: null,
      isKYCVerified: false,
      companyData: null,
      success: true,
      kycStatus: 'not_started'
    };
  }

  // 1) Profile / role
  let role = 'investor';
  let hasRole = false;

  try {
    const { data: profile, error: profileError } = await supabase
      .from('users') // or 'profiles' depending on your schema
      .select('id, role, is_verified')
      .eq('id', userId)
      .maybeSingle(); // IMPORTANT: maybeSingle, not single

    if (profileError) {
      console.warn('[getUserRoleStatus] profile error:', profileError);
    }

    if (profile) {
      role = profile.role || 'investor';
      hasRole = !!profile.role;
    }
  } catch (e) {
    console.warn('[getUserRoleStatus] profile exception:', e);
  }

  // 2) KYC / verification
  let kycStatus = 'not_started';
  let isKYCVerified = false;
  let companyData = null;

  try {
    const { data, error, status } = await supabase
      .from('user_verifications')
      .select(
        `
        id,
        user_id,
        verification_status,
        verification_type,
        legal_name,
        legal_address,
        phone,
        legal_email,
        business_email,
        id_document_url,
        selfie_image_url,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        admin_notes,
        submitted_at,
        created_at,
        updated_at
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(); // <— KEY FIX

    if (status === 406) {
      // No row yet – this is FINE, just means user never submitted KYC
      console.info('[getUserRoleStatus] no verification row yet for user, treating as not_started');
    } else if (error) {
      console.warn('[getUserRoleStatus] verification error:', error);
    } else if (data) {
      const mapped = mapVerificationStatus(data.verification_status);
      kycStatus = mapped;
      companyData = data;
      isKYCVerified = mapped === 'approved';
    }
  } catch (e) {
    console.warn('[getUserRoleStatus] verification exception:', e);
  }

  return {
    hasRole,
    role,
    isKYCVerified,
    companyData,
    success: true,
    kycStatus
  };
};

// =============================================================================
// ADMIN API
// =============================================================================
export const adminApi = {
  async approveCampaign(campaignId) {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', campaignId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Approve campaign error:', error);
      return { success: false, error: error.message };
    }
  },

  async rejectCampaign(campaignId, reason) {
    try {
      // Ideally we would store the rejection reason somewhere, but for now just updating status
      const { data, error } = await supabase
        .from('campaigns')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', campaignId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Reject campaign error:', error);
      return { success: false, error: error.message };
    }
  }
};