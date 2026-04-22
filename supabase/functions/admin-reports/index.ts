// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_STATUSES = new Set(['PENDING', 'UNDER_REVIEW', 'RESOLVED'])
const DEFAULT_STATUSES = ['PENDING', 'UNDER_REVIEW']
const VALID_ACTION_TYPES = new Set([
  'DISMISSED',
  'WARNED_CREATOR',
  'ESCALATED',
  'DELISTED_PROJECT',
  'SUSPENDED_USER',
])
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('admin-reports: missing Supabase environment variables')
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const functionIndex = pathParts.lastIndexOf('admin-reports')
    const routeParts = functionIndex === -1 ? [] : pathParts.slice(functionIndex + 1)

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id

    const { data: adminUser, error: adminFetchError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle()

    if (adminFetchError) {
      console.error('admin-reports: failed to fetch user role', adminFetchError)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!adminUser || adminUser.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden. Admin access required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Admin access by user: ', userId)

    if (req.method === 'POST' && routeParts.length === 2 && routeParts[1] === 'action') {
      const reportId = routeParts[0]
      if (!UUID_REGEX.test(reportId)) {
        return new Response(JSON.stringify({ error: 'Invalid report ID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log('Admin action by user: ', userId)

      const body = await req.json()
      const actionType = body?.action_type
      const notes = body?.notes

      if (!actionType || typeof actionType !== 'string' || !VALID_ACTION_TYPES.has(actionType)) {
        return new Response(JSON.stringify({ error: 'action_type is required and must be valid' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (typeof notes !== 'undefined' && typeof notes !== 'string') {
        return new Response(JSON.stringify({ error: 'notes must be a string' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const normalizedNotes = typeof notes === 'string' ? notes.trim() : null
      if (normalizedNotes && normalizedNotes.length > 500) {
        return new Response(JSON.stringify({ error: 'notes must not exceed 500 characters' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select('id, campaign_id, reporter_user_id, status')
        .eq('id', reportId)
        .maybeSingle()

      if (reportError) {
        console.error('admin-reports: failed to fetch report', reportError)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!report) {
        return new Response(JSON.stringify({ error: 'Report not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (report.status === 'RESOLVED') {
        return new Response(JSON.stringify({ error: 'This report has already been resolved' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let resolution: string | null = null
      if (actionType === 'DISMISSED') resolution = 'NO_VIOLATION'
      if (actionType === 'WARNED_CREATOR') resolution = 'ACTION_TAKEN'
      if (actionType === 'ESCALATED') resolution = 'UNDER_REVIEW'
      if (actionType === 'DELISTED_PROJECT') resolution = 'ACTION_TAKEN'
      if (actionType === 'SUSPENDED_USER') resolution = 'ACTION_TAKEN'

      if (actionType !== 'ESCALATED') {
        const { error: updateReportError } = await supabase
          .from('reports')
          .update({
            status: 'RESOLVED',
            resolution,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', reportId)

        if (updateReportError) {
          console.error('admin-reports: failed to resolve report', updateReportError)
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } else {
        const { error: escalateReportError } = await supabase
          .from('reports')
          .update({ status: 'UNDER_REVIEW' })
          .eq('id', reportId)

        if (escalateReportError) {
          console.error('admin-reports: failed to escalate report', escalateReportError)
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      const { error: adminActionError } = await supabase
        .from('admin_actions')
        .insert({
          report_id: reportId,
          admin_user_id: userId,
          action_type: actionType,
          notes: normalizedNotes,
        })

      if (adminActionError) {
        console.error('admin-reports: failed to insert admin action', adminActionError)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (actionType === 'DISMISSED') {
        const reporterId = report.reporter_user_id

        const { data: reporterRep, error: reporterRepError } = await supabase
          .from('user_reputation')
          .select('reputation')
          .eq('user_id', reporterId)
          .maybeSingle()

        if (reporterRepError) {
          console.error('admin-reports: failed to fetch reporter reputation', reporterRepError)
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const currentReputation = Number(reporterRep?.reputation ?? 0)
        const { error: reputationUpdateError } = await supabase
          .from('user_reputation')
          .update({ reputation: currentReputation - 10 })
          .eq('user_id', reporterId)

        if (reputationUpdateError) {
          console.error('admin-reports: failed to deduct reputation', reputationUpdateError)
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { error: repLogError } = await supabase
          .from('reputation_log')
          .insert({
            user_id: reporterId,
            change_amount: -10,
            reason: 'False report penalty',
            related_report_id: reportId,
          })

        if (repLogError) {
          console.error('admin-reports: failed to insert reputation log', repLogError)
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        console.log('Reputation deducted for user: ', reporterId)
      }

      if (actionType === 'DELISTED_PROJECT') {
        const { error: campaignUpdateError } = await supabase
          .from('campaigns')
          .update({
            is_flagged: true,
            flag_reason: normalizedNotes || 'Delisted by admin',
          })
          .eq('id', report.campaign_id)

        if (campaignUpdateError) {
          console.error('admin-reports: failed to delist campaign', campaignUpdateError)
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        console.log('Campaign delisted: ', report.campaign_id)
      }

      if (actionType === 'SUSPENDED_USER' || actionType === 'WARNED_CREATOR') {
        const { data: campaignForCreator, error: creatorLookupError } = await supabase
          .from('campaigns')
          .select('id, creator_id')
          .eq('id', report.campaign_id)
          .maybeSingle()

        if (creatorLookupError) {
          console.error('admin-reports: failed to fetch campaign creator', creatorLookupError)
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (!campaignForCreator) {
          console.error('admin-reports: campaign missing for creator lookup', report.campaign_id)
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const creatorId = campaignForCreator.creator_id

        if (actionType === 'SUSPENDED_USER') {
          const { error: suspendError } = await supabase
            .from('users')
            .update({ is_suspended: true })
            .eq('id', creatorId)

          if (suspendError) {
            console.error('admin-reports: failed to suspend user', suspendError)
            return new Response(JSON.stringify({ error: 'Internal server error' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          console.log('User suspended: ', creatorId)
        }

        if (actionType === 'WARNED_CREATOR') {
          const { error: warnError } = await supabase
            .from('notifications')
            .insert({
              user_id: creatorId,
              title: 'Official Warning',
              message: 'Your campaign has received an official warning due to a verified report.',
              type: 'admin_warning',
              is_read: false,
            })

          if (warnError) {
            const relationMissing = warnError.code === '42P01'
            if (!relationMissing) {
              console.error('admin-reports: failed to send creator warning notification', warnError)
              return new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              })
            }
            console.log('notifications table does not exist; skipping warning notification insert')
          } else {
            console.log('Warning sent to creator: ', creatorId)
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Action taken successfully',
          report_id: reportId,
          action_type: actionType,
          resolution: actionType === 'ESCALATED' ? null : resolution,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (req.method === 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const statusParam = url.searchParams.get('status')

    let statusesToQuery: string[] = DEFAULT_STATUSES
    if (statusParam) {
      if (!VALID_STATUSES.has(statusParam)) {
        return new Response(JSON.stringify({ error: 'Invalid status filter' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      statusesToQuery = [statusParam]
    }

    const parsedPage = Number(url.searchParams.get('page') ?? '1')
    const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1

    const parsedLimit = Number(url.searchParams.get('limit') ?? '20')
    const normalizedLimit = Number.isFinite(parsedLimit) && parsedLimit >= 1 ? Math.floor(parsedLimit) : 20
    const limit = Math.min(normalizedLimit, 50)

    const offset = (page - 1) * limit

    const baseCountQuery = supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .in('status', statusesToQuery)

    const { count, error: countError } = await baseCountQuery

    if (countError) {
      console.error('admin-reports: failed to count reports', countError)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data, error } = await supabase
      .from('reports')
      .select(
        'id, campaign_id, category, description, status, is_anonymous, ai_risk_contribution, created_at, campaigns!inner(title, risk_score, report_count, is_flagged), users!inner(id)'
      )
      .in('status', statusesToQuery)
      .order('report_count', { foreignTable: 'campaigns', ascending: false })
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('admin-reports: failed to fetch reports', error)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const reports = (data || []).map((row) => {
      const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns
      const reporter = Array.isArray(row.users) ? row.users[0] : row.users

      return {
        report_id: row.id,
        campaign_id: row.campaign_id,
        campaign_title: campaign?.title ?? '',
        campaign_risk_score: campaign?.risk_score ?? null,
        campaign_report_count: campaign?.report_count ?? 0,
        campaign_is_flagged: campaign?.is_flagged ?? false,
        reporter_id: row.is_anonymous ? null : (reporter?.id ?? null),
        category: row.category,
        description: row.description,
        status: row.status,
        is_anonymous: row.is_anonymous,
        ai_risk_contribution: row.ai_risk_contribution,
        created_at: row.created_at,
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        page,
        limit,
        total: count ?? 0,
        reports,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('admin-reports: unexpected error', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
