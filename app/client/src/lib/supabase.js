import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

// Create Supabase client with enhanced session management
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Refresh tokens 5 minutes before expiry
    tokenRefreshMargin: 300, // 5 minutes in seconds
    // Retry failed refresh attempts
    refreshTokenRetries: 3
  },
  // Enable debug mode to see auth events
  debug: import.meta.env.DEV
});

// Export URL and key for edge function calls
supabase.supabaseUrl = supabaseUrl;
supabase.supabaseKey = supabaseAnonKey;

// Auth helper functions
export const auth = {
  // Sign up with email and password
  signUp: async (email, password, userData = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData // Additional user metadata
        }
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Sign in with email and password
  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Sign out
  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.warn('[Auth] signOut error:', error);
      return { error };
    }
  },

  // Get current session
  getSession: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { session, error: null };
    } catch (error) {
      return { session: null, error };
    }
  },

  // Get current user
  getCurrentUser: async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { user, error: null };
    } catch (error) {
      return { user: null, error };
    }
  },

  // Reset password
  resetPassword: async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Update password
  updatePassword: async (newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  // Subscribe to auth state changes
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// Database helper functions
export const db = {
  // Users
  users: {
    // Get user profile
    getProfile: async (userId) => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    // Update user profile
    updateProfile: async (userId, updates) => {
      try {
        const { data, error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', userId)
          .select()
          .single();
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    // Create user profile (called after signup)
    createProfile: async (userData) => {
      try {
        const { data, error } = await supabase
          .from('users')
          .insert([userData])
          .select()
          .single();
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    }
  },

  // Campaigns
  campaigns: {
    // Get all campaigns with pagination
    getAll: async (page = 1, limit = 12, filters = {}) => {
      try {
        let query = supabase
          .from('campaign_stats')
          .select('*')
          .range((page - 1) * limit, page * limit - 1);

        // Apply filters
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.category) {
          query = query.eq('category_id', filters.category);
        }
        if (filters.featured) {
          query = query.eq('featured', true);
        }
        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
        }

        // Default ordering
        query = query.order('created_at', { ascending: false });

        const { data, error, count } = await query;
        
        if (error) throw error;
        return { data, error: null, count };
      } catch (error) {
        return { data: null, error, count: 0 };
      }
    },

    // Get campaign by ID
    getById: async (campaignId) => {
      try {
        const { data, error } = await supabase
          .from('campaign_stats')
          .select('*')
          .eq('id', campaignId)
          .single();
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    // Get campaigns by user
    getByUser: async (userId) => {
      try {
        const { data, error } = await supabase
          .from('campaign_stats')
          .select('*')
          .eq('creator_id', userId)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    // Create campaign
    create: async (campaignData) => {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .insert([campaignData])
          .select()
          .single();
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    // Update campaign
    update: async (campaignId, updates) => {
      try {
        const { data, error } = await supabase
          .from('campaigns')
          .update(updates)
          .eq('id', campaignId)
          .select()
          .single();
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    }
  },

  // Investments
  investments: {
    // Get user investments
    getByUser: async (userId) => {
      try {
        const { data, error } = await supabase
          .from('investments')
          .select(`
            *,
            campaigns:campaign_id (
              id,
              title,
              image_url,
              status,
              funding_goal,
              current_funding
            )
          `)
          .eq('investor_id', userId)
          .order('investment_date', { ascending: false });
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    // Get campaign investments
    getByCampaign: async (campaignId) => {
      try {
        const { data, error } = await supabase
          .from('investments')
          .select(`
            *,
            users:investor_id (
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('campaign_id', campaignId)
          .eq('status', 'confirmed')
          .order('investment_date', { ascending: false });
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    // Create investment
    create: async (investmentData) => {
      try {
        const { data, error } = await supabase
          .from('investments')
          .insert([investmentData])
          .select()
          .single();
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    // Update investment status
    updateStatus: async (investmentId, status, updates = {}) => {
      try {
        const { data, error } = await supabase
          .from('investments')
          .update({ status, ...updates })
          .eq('id', investmentId)
          .select()
          .single();
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    }
  },

  // Categories
  categories: {
    getAll: async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name');
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    }
  },

  // Milestones
  milestones: {
    getByCampaign: async (campaignId) => {
      try {
        const { data, error } = await supabase
          .from('milestones')
          .select('*')
          .eq('campaign_id', campaignId)
          .order('order_index');
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    }
  },

  // Favorites
  favorites: {
    getByUser: async (userId) => {
      try {
        const { data, error } = await supabase
          .from('favorites')
          .select(`
            *,
            campaigns:campaign_id (*)
          `)
          .eq('user_id', userId);
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    add: async (userId, campaignId) => {
      try {
        const { data, error } = await supabase
          .from('favorites')
          .insert([{ user_id: userId, campaign_id: campaignId }])
          .select()
          .single();
        
        if (error) throw error;
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    remove: async (userId, campaignId) => {
      try {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('campaign_id', campaignId);
        
        if (error) throw error;
        return { error: null };
      } catch (error) {
        return { error };
      }
    }
  }
};

// Storage helpers (for file uploads)
export const storage = {
  // Upload file to campaign images bucket
  uploadCampaignImage: async (file, campaignId) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${campaignId}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('campaign-images')
        .upload(fileName, file);
      
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('campaign-images')
        .getPublicUrl(fileName);
      
      return { data: { ...data, publicUrl }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Upload user avatar
  uploadAvatar: async (file, userId) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatars/${userId}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, file, {
          upsert: true // Replace existing avatar
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(fileName);
      
      return { data: { ...data, publicUrl }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
};

export default supabase;