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
      
      // Map form fields to database column names (from main)
      const { category, deadline, goalAmount, summary, imageUrl, ...campaignData } = form;
      const payload = { 
        ...campaignData, 
        creator_id: finalCreatorId, 
        category_id,
        end_date: deadline,
        funding_goal: goalAmount,
        short_description: summary,
        image_url: imageUrl,
        status: 'pending_review' 
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
// =============================================================================
// MILESTONE VOTING API
// =============================================================================
export const milestoneVotingApi = {
  /**
   * Submit a vote for a milestone
   */
  async submitVote(milestoneId, campaignId, vote) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if user already voted
    const { data: existing } = await supabase
      .from('milestone_votes')
      .select('id')
      .eq('milestone_id', milestoneId)
      .eq('investor_id', user.id)
      .maybeSingle();

    if (existing) {
      throw new Error('You have already voted on this milestone');
    }

    // Get user's investment weight
    const { data: investment } = await supabase
      .from('investments')
      .select('amount')
      .eq('campaign_id', campaignId)
      .eq('investor_id', user.id)
      .eq('status', 'confirmed')
      .maybeSingle();

    const investmentWeight = investment?.amount || 0;

    const { data, error } = await supabase
      .from('milestone_votes')
      .insert({
        milestone_id: milestoneId,
        investor_id: user.id,
        campaign_id: campaignId,
        vote,
        investment_weight: investmentWeight
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get user's vote for a milestone
   */
  async getUserVote(milestoneId, userId) {
    const { data, error } = await supabase
      .from('milestone_votes')
      .select('*')
      .eq('milestone_id', milestoneId)
      .eq('investor_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Get vote statistics for a milestone
   */
  async getVoteStats(milestoneId) {
    const { data, error } = await supabase
      .from('milestone_votes')
      .select('vote, investment_weight')
      .eq('milestone_id', milestoneId);

    if (error) throw error;

    const votes = data || [];
    const totalWeight = votes.reduce((sum, v) => sum + (v.investment_weight || 0), 0);
    const approveWeight = votes.filter(v => v.vote === true).reduce((sum, v) => sum + (v.investment_weight || 0), 0);
    const rejectWeight = votes.filter(v => v.vote === false).reduce((sum, v) => sum + (v.investment_weight || 0), 0);

    const approvalPercentage = totalWeight > 0 ? (approveWeight / totalWeight) * 100 : 0;
    const rejectionPercentage = totalWeight > 0 ? (rejectWeight / totalWeight) * 100 : 0;

    let consensus = 'pending';
    if (approvalPercentage >= 60) {
      consensus = 'approved';
    } else if (rejectionPercentage >= 40) {
      consensus = 'rejected';
    }

    return {
      totalVotes: votes.length,
      approvalCount: votes.filter(v => v.vote === true).length,
      rejectionCount: votes.filter(v => v.vote === false).length,
      approvalPercentage: Math.round(approvalPercentage),
      rejectionPercentage: Math.round(rejectionPercentage),
      consensus,
      totalWeight,
      approveWeight,
      rejectWeight
    };
  },

  /**
   * Check if user has invested in campaign (required to vote)
   */
  async canUserVote(campaignId, userId) {
    const { data, error } = await supabase
      .from('investments')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('investor_id', userId)
      .eq('status', 'confirmed')
      .maybeSingle();

    if (error) return false;
    return !!data;
  }
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
// MILESTONE UPDATE API
// =============================================================================
export const milestoneUpdateApi = {
  /**
   * Upload media to Supabase Storage
   */
  async uploadMedia(campaignId, milestoneId, file) {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `campaign_${campaignId}/milestone_${milestoneId}/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from('milestone-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('milestone-media')
      .getPublicUrl(filePath);
    
    return publicUrl;
  },

  /**
   * Create milestone update
   */
  async createUpdate(campaignId, milestoneId, title, content, mediaFiles = []) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Upload all media files
    const mediaUrls = [];
    for (const file of mediaFiles) {
      try {
        const url = await this.uploadMedia(campaignId, milestoneId, file);
        mediaUrls.push(url);
      } catch (err) {
        console.error('Failed to upload file:', file.name, err);
      }
    }

    // Create update record
    const { data, error } = await supabase
      .from('campaign_updates')
      .insert({
        campaign_id: campaignId,
        author_id: user.id,
        title: title || 'Milestone Update',
        content,
        media_urls: mediaUrls,
        is_public: true
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get updates for a campaign
   */
  async getCampaignUpdates(campaignId, showAll = false) {
    let query = supabase
      .from('campaign_updates')
      .select('*')
      .eq('campaign_id', campaignId);
    
    if (!showAll) {
      query = query.eq('is_public', true);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Fetch author details
    if (data && data.length > 0) {
      const authorIds = [...new Set(data.map(u => u.author_id))];
      const { data: authors } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', authorIds);
      
      const authorsMap = {};
      (authors || []).forEach(a => authorsMap[a.id] = a);
      
      return data.map(update => ({
        ...update,
        author: authorsMap[update.author_id] || null
      }));
    }
    
    return data || [];
  },

  /**
   * Check if milestone has any updates
   */
  async milestoneHasUpdates(campaignId) {
    const { data, error } = await supabase
      .from('campaign_updates')
      .select('id')
      .eq('campaign_id', campaignId)
      .limit(1);
    
    if (error) return false;
    return data && data.length > 0;
  }
};

// =============================================================================
// Q&A API
// =============================================================================
export const qaApi = {
  /**
   * Get all visible questions for a campaign
   */
  async getCampaignQuestions(campaignId) {
    const { data: questions, error } = await supabase
      .from('campaign_questions')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Fetch user details separately
    if (questions && questions.length > 0) {
      const userIds = [...new Set(questions.map(q => q.user_id))];
      const { data: users } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);
      
      // Map users to questions
      const usersMap = {};
      (users || []).forEach(u => usersMap[u.id] = u);
      
      return questions.map(q => ({
        ...q,
        users: usersMap[q.user_id] || null
      }));
    }
    
    return questions || [];
  },

  /**
   * Get answers for a question
   */
  async getQuestionAnswers(questionId) {
    const { data: answers, error } = await supabase
      .from('campaign_answers')
      .select('*')
      .eq('question_id', questionId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Fetch creator details separately
    if (answers && answers.length > 0) {
      const creatorIds = [...new Set(answers.map(a => a.creator_id))];
      const { data: users } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', creatorIds);
      
      // Map users to answers
      const usersMap = {};
      (users || []).forEach(u => usersMap[u.id] = u);
      
      return answers.map(a => ({
        ...a,
        users: usersMap[a.creator_id] || null
      }));
    }
    
    return answers || [];
  },

  /**
   * Post a new question (requires auth)
   */
  async postQuestion(campaignId, questionText) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('campaign_questions')
      .insert({
        campaign_id: campaignId,
        user_id: user.id,
        question: questionText
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Post an answer to a question (creator only)
   */
  async postAnswer(questionId, answerText) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('campaign_answers')
      .insert({
        question_id: questionId,
        creator_id: user.id,
        answer: answerText
      })
      .select()
      .single();
    
    if (error) throw error;

    // Mark question as answered
    await supabase
      .from('campaign_questions')
      .update({ is_answered: true })
      .eq('id', questionId);
    
    return data;
  },

  /**
   * Report a question or answer
   */
  async reportContent(contentType, contentId, reason) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('content_reports')
      .insert({
        content_type: contentType,
        content_id: contentId,
        reported_by: user.id,
        reason
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('You have already reported this content');
      }
      throw error;
    }
    
    return data;
  }
};

// =============================================================================
// ADMIN API (RESTORED)
>>>>>>> main
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
  },

  /**
   * Hide a question (moderation)
   */
  async hideQuestion(questionId) {
    const { data, error } = await supabase
      .from('campaign_questions')
      .update({ is_hidden: true })
      .eq('id', questionId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Hide an answer (moderation)
   */
  async hideAnswer(answerId) {
    const { data, error } = await supabase
      .from('campaign_answers')
      .update({ is_hidden: true })
      .eq('id', answerId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get all content reports (admin only)
   */
  async getContentReports() {
    const { data: reports, error } = await supabase
      .from('content_reports')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Fetch reporter details separately
    if (reports && reports.length > 0) {
      const reporterIds = [...new Set(reports.map(r => r.reported_by))];
      const { data: users } = await supabase
        .from('users')
        .select('id, username, email')
        .in('id', reporterIds);
      
      // Map users to reports
      const usersMap = {};
      (users || []).forEach(u => usersMap[u.id] = u);
      
      return reports.map(r => ({
        ...r,
        reporter: usersMap[r.reported_by] || null
      }));
    }
    
    return reports || [];
  },

  /**
   * Get all questions for admin review (including hidden)
   */
  async getAllQuestions() {
    const { data: questions, error } = await supabase
      .from('campaign_questions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    if (questions && questions.length > 0) {
      // Fetch user details
      const userIds = [...new Set(questions.map(q => q.user_id))];
      const { data: users } = await supabase
        .from('users')
        .select('id, username, full_name')
        .in('id', userIds);
      
      // Fetch campaign details
      const campaignIds = [...new Set(questions.map(q => q.campaign_id))];
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, title, slug')
        .in('id', campaignIds);
      
      const usersMap = {};
      (users || []).forEach(u => usersMap[u.id] = u);
      
      const campaignsMap = {};
      (campaigns || []).forEach(c => campaignsMap[c.id] = c);
      
      return questions.map(q => ({
        ...q,
        users: usersMap[q.user_id] || null,
        campaigns: campaignsMap[q.campaign_id] || null
      }));
    }
    
    return questions || [];
  },

  /**
   * Get all answers for admin review (including hidden)
   */
  async getAllAnswers() {
    const { data: answers, error } = await supabase
      .from('campaign_answers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    if (answers && answers.length > 0) {
      // Fetch creator details
      const creatorIds = [...new Set(answers.map(a => a.creator_id))];
      const { data: users } = await supabase
        .from('users')
        .select('id, username, full_name')
        .in('id', creatorIds);
      
      // Fetch question details
      const questionIds = [...new Set(answers.map(a => a.question_id))];
      const { data: questions } = await supabase
        .from('campaign_questions')
        .select('id, question, campaign_id')
        .in('id', questionIds);
      
      const usersMap = {};
      (users || []).forEach(u => usersMap[u.id] = u);
      
      const questionsMap = {};
      (questions || []).forEach(q => questionsMap[q.id] = q);
      
      return answers.map(a => ({
        ...a,
        users: usersMap[a.creator_id] || null,
        campaign_questions: questionsMap[a.question_id] || null
      }));
    }
    
    return answers || [];
  },

  /**
   * Resolve a content report
   */
  async resolveReport(reportId) {
    const { data, error } = await supabase
      .from('content_reports')
      .update({ resolved: true })
      .eq('id', reportId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
>>>>>>> main
  }
};