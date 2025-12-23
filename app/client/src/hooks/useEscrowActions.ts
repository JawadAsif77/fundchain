import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/AuthContext';

interface InvestInCampaignParams {
  campaignId: string;
  amount: number;
}

interface ReleaseMilestoneParams {
  campaignId: string;
  milestoneId: string;
  amountFc: number;
  notes?: string;
}

interface RefundCampaignParams {
  campaignId: string;
  reason?: string;
}

interface EscrowActionResult<T = any> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

interface InvestmentResponse {
  success: boolean;
  investment?: {
    id: string;
    campaign_id: string;
    investor_id: string;
    amount: number;
    status: string;
  };
  newBalance?: {
    balance_fc: number;
    locked_fc: number;
  };
  campaignWallet?: {
    escrow_balance_fc: number;
    released_fc: number;
  };
  error?: string;
  details?: string;
}

interface ReleaseMilestoneResponse {
  success: boolean;
  campaignWallet?: {
    escrow_balance_fc: number;
    released_fc: number;
  };
  creatorWallet?: {
    balance_fc: number;
    locked_fc: number;
  };
  milestone?: {
    id: string;
    is_completed: boolean;
    completion_date: string;
  };
  error?: string;
  details?: string;
}

interface RefundResponse {
  success: boolean;
  message?: string;
  refundedCount?: number;
  totalRefund?: number;
  error?: string;
  details?: string;
}

export const useEscrowActions = () => {
  const { user } = useAuth() as { user: { id: string } | null };
  
  const [investLoading, setInvestLoading] = useState(false);
  const [investError, setInvestError] = useState<string | null>(null);
  
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  const getSupabaseUrl = () => {
    const url = (import.meta as any).env.VITE_SUPABASE_URL as string;
    if (!url) {
      throw new Error('Supabase URL is not configured');
    }
    return url;
  };

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    };
  };

  /**
   * Invest in a campaign with FC tokens
   */
  const investInCampaign = async ({ 
    campaignId, 
    amount 
  }: InvestInCampaignParams): Promise<InvestmentResponse> => {
    setInvestLoading(true);
    setInvestError(null);

    try {
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }

      const supabaseUrl = getSupabaseUrl();
      const headers = await getAuthHeaders();

      const response = await fetch(
        `${supabaseUrl}/functions/v1/invest-in-campaign`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            userId: user.id,
            campaignId,
            amount,
          }),
        }
      );

      const result: InvestmentResponse = await response.json();

      if (!response.ok || !result.success) {
        console.error('Investment API Error:', result);
        const errorMsg = result.error || result.details || 'Investment failed';
        setInvestError(errorMsg);
        throw new Error(errorMsg);
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setInvestError(errorMsg);
      throw err;
    } finally {
      setInvestLoading(false);
    }
  };

  /**
   * Release milestone funds to campaign creator (Admin only)
   */
  const releaseMilestone = async ({
    campaignId,
    milestoneId,
    amountFc,
    notes,
  }: ReleaseMilestoneParams): Promise<ReleaseMilestoneResponse> => {
    setReleaseLoading(true);
    setReleaseError(null);

    try {
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }

      const supabaseUrl = getSupabaseUrl();
      const headers = await getAuthHeaders();

      const response = await fetch(
        `${supabaseUrl}/functions/v1/release-milestone-funds`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            adminId: user.id,
            campaignId,
            milestoneId,
            amountFc,
            notes,
          }),
        }
      );

      const result: ReleaseMilestoneResponse = await response.json();

      if (!response.ok || !result.success) {
        const errorMsg = result.error || result.details || 'Milestone release failed';
        setReleaseError(errorMsg);
        throw new Error(errorMsg);
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setReleaseError(errorMsg);
      throw err;
    } finally {
      setReleaseLoading(false);
    }
  };

  /**
   * Refund all campaign investors (Admin only)
   */
  const refundCampaignInvestors = async ({
    campaignId,
    reason,
  }: RefundCampaignParams): Promise<RefundResponse> => {
    setRefundLoading(true);
    setRefundError(null);

    try {
      if (!user || !user.id) {
        throw new Error('User not authenticated');
      }

      const supabaseUrl = getSupabaseUrl();
      const headers = await getAuthHeaders();

      const response = await fetch(
        `${supabaseUrl}/functions/v1/refund-campaign-investors`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            adminId: user.id,
            campaignId,
            reason,
          }),
        }
      );

      const result: RefundResponse = await response.json();

      if (!response.ok || !result.success) {
        const errorMsg = result.error || result.details || 'Refund failed';
        setRefundError(errorMsg);
        throw new Error(errorMsg);
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setRefundError(errorMsg);
      throw err;
    } finally {
      setRefundLoading(false);
    }
  };

  return {
    // Investment
    investInCampaign,
    investLoading,
    investError,
    
    // Milestone release
    releaseMilestone,
    releaseLoading,
    releaseError,
    
    // Refund
    refundCampaignInvestors,
    refundLoading,
    refundError,
  };
};
