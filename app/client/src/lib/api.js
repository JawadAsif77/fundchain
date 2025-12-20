// =============================================================================
// API LAYER - FIXED (FULL VERSION - NO CONNECTION POOL)
// =============================================================================
import { supabase } from './supabase.js';

// Mock data imports (for fallback during development)
import { campaigns } from '../mock/campaigns.js';
import { milestones } from '../mock/milestones.js';
import { users } from '../mock/users.js';
import { investments } from '../mock/investments.js';
import { analyzeCampaignRisk } from '../services/riskAnalysis'

// =============================================================================
// SESSION HELPERS (from main branch)
// =============================================================================
const ensureValidSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) return null;
      return refreshed;
    }
    return session;
  } catch (error) { return null; }
};

// --- REQUEST WRAPPERS (NO BLOCKING POOL) ---

// For public requests (no auth check needed)
export const withTimeoutPublic = async (promise, timeoutMs = 15000, retries = 1) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let timer;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timer);
      return result;
    } catch (error) {
      clearTimeout(timer);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
};

// For authenticated requests
export const withTimeout = async (promise, timeoutMs = 15000, retries = 1) => {
  await ensureValidSession();
  
  for (let i = 0; i <= retries; i++) {
    let timer;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });
      
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timer);
      return result;
    } catch (error) {
      clearTimeout(timer);
      
      // If auth error, refresh and retry
      if (error.message?.includes('JWT') || error.code === '401') {
        await supabase.auth.refreshSession();
      }
      
      if (i === retries) throw error;
      
      // Only retry on timeouts/network errors
      if (!error.message?.includes('timeout') && !error.message?.includes('connection')) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

const requestCache = new Map();
export const clearRequestCache = () => requestCache.clear();

const dedupeRequest = async (key, requestFn, ttl = 2000) => { 
  if (requestCache.has(key)) return requestCache.get(key);
  const promise = requestFn().finally(() => setTimeout(() => requestCache.delete(key), ttl));
  requestCache.set(key, promise);
  return promise;
};

// =============================================================================
// USER API
// =============================================================================
export const userApi = {
  async getProfile(userId) {
    return dedupeRequest(`profile-${userId}`, async () => {
      const { data, error } = await withTimeout(
        supabase.from('users').select('*').eq('id', userId).single()
      );
      if (error) throw error;
      return { data };
    });
  },

  async updateProfile(userId, profileData) {
    const updates = { ...profileData, updated_at: new Date().toISOString() };
    const { data, error } = await withTimeout(
      supabase.from('users').update(updates).eq('id', userId).select('*').single()
    );
    if (error) throw error;
    return { data, error: null };
  },

  async checkUsernameAvailability(username) {
    if (!username) return { available: false };
    const { data, error } = await withTimeoutPublic(
      supabase.from('users').select('username').eq('username', username).maybeSingle()
    );
    if (error) return { available: false };
    return { available: !data };
  },

  async createUser(userData) {
    const { data, error } = await supabase.from('users').insert(userData).select('*').single();
    if (error) throw error;
    try {
      supabase.functions.invoke('create-user-wallet', { body: { userId: data.id } });
    } catch(e) { console.warn('Wallet creation trigger failed', e); }
    return { data };
  },

  async updateWalletAddress(userId, address) {
    const { data, error } = await supabase.from('users').update({ wallet_address: address }).eq('id', userId).select('*').single();
    if (error) throw error;
    return { data };
  }
};

// =============================================================================
// KYC API
// =============================================================================
export const kycApi = {
  async submitKyc(kycData) {
    const { data, error } = await withTimeout(
      supabase.from('user_verifications').upsert(kycData, { onConflict: 'user_id' }).select('*').single()
    );
    if (error) throw error;
    await supabase.from('users').update({ is_verified: 'pending' }).eq('id', kycData.user_id);
    return data;
  },

  async getKycStatus(userId) {
    const { data, error } = await withTimeout(
      supabase.from('user_verifications').select('*').eq('user_id', userId).maybeSingle()
    );
    if (error) throw error;
    return data;
  }
};

// =============================================================================
// COMPANY API
// =============================================================================
export const companyApi = {
  async createCompany(companyData) {
    const { data, error } = await supabase.from('companies').insert(companyData).select('*').single();
    if (error) throw error;
    return data;
  },
  async getUserCompanies(userId) {
    const { data, error } = await supabase.from('companies').select('*').eq('owner_id', userId);
    if (error) throw error;
    return data || [];
  }
};

// =============================================================================
// PROJECT API
// =============================================================================
export const projectApi = {
  async createProject(projectData) {
    const { data, error } = await supabase.from('projects').insert(projectData).select('*').single();
    if (error) throw error;
    return data;
  },
  async getAll() {
    const { data, error } = await supabase.from('projects')
      .select('*, companies(*), users!projects_creator_id_fkey(*)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async getUserProjects(userId) {
    let query = supabase.from('projects').select('*, companies(*)').order('created_at', { ascending: false });
    if (userId) query = query.eq('creator_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
};

// =============================================================================
// CAMPAIGN API
// =============================================================================
export const campaignApi = {
  async ensureCategoryByName(name) {
    if (!name) return null;
    const { data } = await supabase.from('categories').select('id').eq('name', name).maybeSingle();
    if (data) return data.id;
    const { data: newCat } = await supabase.from('categories').insert({ name }).select('id').single();
    return newCat?.id;
  },
  
  async createCampaign(form, creatorId) {
    try {
      let finalCreatorId = creatorId;
      if (!finalCreatorId) {
        const { data } = await supabase.auth.getUser();
        finalCreatorId = data?.user?.id;
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
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('campaigns').insert(payload).select('*').single();
      if (error) throw error;
      
      // Trigger AI risk analysis (from AI branch)
      try {
        await analyzeCampaignRisk(data.id);
        console.log('✅ AI risk analysis triggered');
      } catch (err) {
        console.error('⚠️ Risk analysis failed:', err.message);
      }
      
      return { success: true, data };
    } catch (error) { 
      console.error('💥 Create campaign error:', error);
      return { success: false, error: error.message };
    }
  },

  async getCampaigns(filters = {}) {
    let query = supabase.from('campaigns').select('*, categories(*)');
    if (filters.status) query = query.eq('status', filters.status || 'active');
    if (filters.search) query = query.ilike('title', `%${filters.search}%`);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await withTimeoutPublic(query);
    if (error) return { data: campaigns, error: error.message };
    return { data: data || [], count: data?.length || 0 };
  },

  async getUserCampaigns(userId) {
    let uid = userId;
    if (!uid) {
      const { data: authData } = await supabase.auth.getUser();
      uid = authData?.user?.id;
    }
    const { data, error } = await withTimeout(
      supabase.from('campaigns').select('*, categories(*)').eq('creator_id', uid).order('created_at', { ascending: false })
    );
    if (error) throw error;
    return { success: true, data: data || [] };
  },

  async getCampaignBySlug(slug) {
    const { data, error } = await supabase.from('campaigns').select('*, categories(*)').eq('slug', slug).single();
    if (error) throw new Error('Not found');
    return { data };
  },
  
  async getMilestones(campaignId) {
    const { data, error } = await supabase.from('milestones').select('*').eq('campaign_id', campaignId).order('order_index');
    if (error) throw error;
    return { success: true, data: data || [] };
  }
};
    if (error) throw error;
    return { success: true, data: data || [] };
  }
};

// =============================================================================
// INVESTMENT API
// =============================================================================
export const investmentApi = {
  async getUserInvestments(userId) {
    const { data, error } = await withTimeout(
      supabase.from('investments').select('*, campaigns(*)').eq('investor_id', userId)
    );
    if (error) {
      // Fallback
      const { data: basic } = await supabase.from('investments').select('*').eq('investor_id', userId);
      return { data: basic || [] };
    }
    return { data: data || [] };
  }
};

// =============================================================================
// WALLET API
// =============================================================================
export const walletApi = {
  async getBalance() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { success: false, balance: 0 };
    const { data, error } = await withTimeout(
      supabase.from('users').select('preferences').eq('id', auth.user.id).single()
    );
    if (error) return { success: true, balance: 0 };
    return { success: true, balance: Number(data?.preferences?.wallet_balance || 0) };
  },
  
  async topUp(amount) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { success: false };
    
    const { data } = await supabase.from('users').select('preferences').eq('id', auth.user.id).single();
    const current = Number(data?.preferences?.wallet_balance || 0);
    const newBal = current + Number(amount);
    
    await supabase.from('users').update({ 
      preferences: { ...data?.preferences, wallet_balance: newBal } 
    }).eq('id', auth.user.id);
    
    return { success: true, balance: newBal };
  },

  async invest(campaignId, amount) {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user.id;
    
    const { data: u } = await supabase.from('users').select('preferences').eq('id', uid).single();
    const bal = Number(u?.preferences?.wallet_balance || 0);
    if (bal < amount) return { success: false, error: 'Insufficient funds' };
    
    const { data: inv, error } = await supabase.from('investments').insert({
      investor_id: uid, campaign_id: campaignId, amount, status: 'confirmed'
    }).select('*').single();
    
    if (error) return { success: false, error: error.message };
    
    await supabase.from('users').update({
      preferences: { ...u.preferences, wallet_balance: bal - amount }
    }).eq('id', uid);
    
    return { success: true, investment: inv };
  }
};

// =============================================================================
// MILESTONE & UTILITIES API (RESTORED)
// =============================================================================

export const milestoneApi = {
  async createMilestone(milestoneData) {
    const { data, error } = await supabase.from('milestones').insert(milestoneData).select().single();
    if (error) throw error;
    return { success: true, data };
  }
};

export const generateSlug = (title) => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

export const validateMilestones = (milestones) => {
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return { isValid: false, error: 'At least one milestone is required' };
  }
  const totalPercentage = milestones.reduce((sum, m) => sum + (parseFloat(m.payoutPercentage) || 0), 0);
  if (Math.abs(totalPercentage - 100) > 0.1) {
    return { isValid: false, error: `Total percentage must be 100% (current: ${totalPercentage.toFixed(1)}%)` };
  }
  return { isValid: true };
};

export const createProjectWithMilestones = async (projectData, milestones) => {
  try {
    const campaignRes = await campaignApi.createCampaign(projectData);
    if (!campaignRes.success || !campaignRes.data) throw new Error(campaignRes.error);
    const campaignId = campaignRes.data.id;

    await Promise.all(milestones.map((m, index) => 
      milestoneApi.createMilestone({
        campaign_id: campaignId,
        title: m.name,
        description: m.description,
        target_amount: (projectData.goalAmount * (m.payoutPercentage / 100)),
        order_index: index,
        is_completed: false
      })
    ));
    return { success: true, data: campaignRes.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getUserRoleStatus = async (userId) => {
  if (!userId) return { hasRole: false };
  const [p, k] = await Promise.all([
    supabase.from('users').select('role, is_verified').eq('id', userId).maybeSingle(),
    supabase.from('user_verifications').select('*').eq('user_id', userId).maybeSingle()
  ]);
  
  const role = p.data?.role || 'investor';
  const kycStatus = k.data?.verification_status === 'approved' ? 'approved' : 'pending';
  
  return { hasRole: !!p.data?.role, role, isKYCVerified: kycStatus === 'approved', companyData: k.data, success: true };
};

// =============================================================================
// ADMIN API (MERGED - includes both approval AND risk override functions)
// =============================================================================
export const adminApi = {
  // Campaign approval/rejection
  async approveCampaign(campaignId) {
    const { data, error } = await supabase.from('campaigns')
      .update({ status: 'active', verified: true, updated_at: new Date().toISOString() })
      .eq('id', campaignId).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  async rejectCampaign(campaignId, reason) {
    const { data, error } = await supabase.from('campaigns')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', campaignId).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  },

  // Risk override functions (from AI branch)
  async setManualRiskLevel(campaignId, riskLevel) {
    try {
      console.log('🛡️ Admin: Setting manual risk level:', { campaignId, riskLevel });
      
      if (!['low', 'medium', 'high'].includes(riskLevel)) {
        throw new Error('Invalid risk level. Must be low, medium, or high');
      }

      const { data, error } = await supabase
        .from('campaigns')
        .update({ 
          manual_risk_level: riskLevel,
          updated_at: new Date().toISOString() 
        })
        .eq('id', campaignId)
        .select('*')
        .single();
      
      if (error) throw error;
      
      console.log('✅ Manual risk level set successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('💥 Set manual risk level error:', error);
      return { success: false, error: error.message };
    }
  },

  async clearManualRiskLevel(campaignId) {
    try {
      console.log('🛡️ Admin: Clearing manual risk override for campaign:', campaignId);
      
      const { data, error } = await supabase
        .from('campaigns')
        .update({ 
          manual_risk_level: null,
          updated_at: new Date().toISOString() 
        })
        .eq('id', campaignId)
        .select('*')
        .single();
      
      if (error) throw error;
      
      console.log('✅ Manual risk override cleared:', data);
      return { success: true, data };
    } catch (error) {
      console.error('💥 Clear manual risk level error:', error);
      return { success: false, error: error.message };
    }
  }
};