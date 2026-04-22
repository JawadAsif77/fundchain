// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_CATEGORIES = new Set([
  'FAKE_IDENTITY',
  'PLAGIARIZED_CONTENT',
  'UNREALISTIC_MILESTONES',
  'SUSPICIOUS_WALLET',
  'MISLEADING_FINANCIALS',
  'OTHER',
])

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ReportBody {
  campaign_id?: string
  category?: string
  description?: string
  is_anonymous?: boolean
}

interface UserReputationRow {
  user_id: string
  reputation: number | null
  reports_submitted_today: number | null
  last_report_reset_at: string | null
}

type DatabaseShape = {
  public: {
    Tables: Record<string, unknown>
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
    CompositeTypes: Record<string, unknown>
  }
}

type SupabaseClientType = ReturnType<typeof createClient<DatabaseShape, 'public'>>

interface ReportWithCampaign {
  id: string
  campaign_id: string
  category: string
  description: string | null
  status: string
  resolution: string | null
  created_at: string
  resolved_at: string | null
  campaigns: { title: string } | { title: string }[] | null
}

function sanitizeDescription(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim()
}

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

function hasResetWindowElapsed(lastResetAt: string | null): boolean {
  if (!lastResetAt) return true
  const last = new Date(lastResetAt)
  if (Number.isNaN(last.getTime())) return true
  const nowMs = Date.now()
  return nowMs - last.getTime() > 24 * 60 * 60 * 1000
}

async function authenticateRequest(
  req: Request,
  supabase: SupabaseClientType
): Promise<{ userId: string; response?: Response }> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return {
      userId: '',
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    console.error('reports: auth failed', authError)
    return {
      userId: '',
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }

  return { userId: user.id }
}

function getReportsRouteParts(req: Request): string[] {
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const fnIndex = pathParts.lastIndexOf('reports')
  if (fnIndex === -1) return []
  return pathParts.slice(fnIndex + 1)
}

async function handleGetMyReports(supabase: SupabaseClientType, userId: string): Promise<Response> {
  const { data, error } = await supabase
    .from('reports')
    .select('id, campaign_id, category, description, status, resolution, created_at, resolved_at, campaigns!inner(title)')
    .eq('reporter_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('reports: failed to fetch user reports', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const reports = ((data || []) as ReportWithCampaign[]).map((row: ReportWithCampaign) => {
    const campaignData = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns
    return {
      report_id: row.id,
      campaign_id: row.campaign_id,
      campaign_title: campaignData?.title ?? '',
      category: row.category,
      description: row.description,
      status: row.status,
      resolution: row.resolution,
      created_at: row.created_at,
      resolved_at: row.resolved_at,
    }
  })

  return new Response(
    JSON.stringify({
      success: true,
      reports,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

async function handleGetSingleReport(
  supabase: SupabaseClientType,
  userId: string,
  reportId: string
): Promise<Response> {
  if (!isUuid(reportId)) {
    return new Response(JSON.stringify({ error: 'Invalid report ID' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: ownerRow, error: ownerError } = await supabase
    .from('reports')
    .select('id, reporter_user_id')
    .eq('id', reportId)
    .maybeSingle()

  if (ownerError) {
    console.error('reports: failed to fetch report owner', ownerError)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!ownerRow) {
    return new Response(JSON.stringify({ error: 'Report not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (ownerRow.reporter_user_id !== userId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: reportData, error: reportError } = await supabase
    .from('reports')
    .select('id, campaign_id, category, description, status, resolution, created_at, resolved_at, campaigns!inner(title)')
    .eq('id', reportId)
    .single()

  if (reportError || !reportData) {
    console.error('reports: failed to fetch report details', reportError)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const campaignData = Array.isArray(reportData.campaigns) ? reportData.campaigns[0] : reportData.campaigns

  return new Response(
    JSON.stringify({
      success: true,
      report: {
        report_id: reportData.id,
        campaign_id: reportData.campaign_id,
        campaign_title: campaignData?.title ?? '',
        category: reportData.category,
        description: reportData.description,
        status: reportData.status,
        resolution: reportData.resolution,
        created_at: reportData.created_at,
        resolved_at: reportData.resolved_at,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

async function handlePostReport(
  req: Request,
  supabase: SupabaseClientType,
  reporterUserId: string
): Promise<Response> {
  const body = (await req.json()) as ReportBody

  if (!body?.campaign_id || typeof body.campaign_id !== 'string' || !isUuid(body.campaign_id)) {
    return new Response(JSON.stringify({ error: 'campaign_id is required and must be a valid UUID' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!body?.category || typeof body.category !== 'string' || !ALLOWED_CATEGORIES.has(body.category)) {
    return new Response(JSON.stringify({ error: 'category is required and must be a valid value' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sanitizedDescription: string | null = null
  if (typeof body.description !== 'undefined' && typeof body.description !== 'string') {
    return new Response(JSON.stringify({ error: 'description must be a string' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (typeof body.description === 'string') {
    sanitizedDescription = sanitizeDescription(body.description)
    if (sanitizedDescription.length > 1000) {
      return new Response(JSON.stringify({ error: 'description must not exceed 1000 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (sanitizedDescription.length === 0) {
      sanitizedDescription = null
    }
  }

  if (typeof body.is_anonymous !== 'undefined' && typeof body.is_anonymous !== 'boolean') {
    return new Response(JSON.stringify({ error: 'is_anonymous must be a boolean' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const isAnonymous = body.is_anonymous ?? false

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, creator_id, report_count')
    .eq('id', body.campaign_id)
    .maybeSingle()

  if (campaignError) {
    console.error('reports: failed to fetch campaign', campaignError)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!campaign) {
    return new Response(JSON.stringify({ error: 'campaign_id is invalid or campaign not found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (campaign.creator_id === reporterUserId) {
    return new Response(JSON.stringify({ error: 'Cannot report your own campaign' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: existingReport, error: existingReportError } = await supabase
    .from('reports')
    .select('id')
    .eq('campaign_id', body.campaign_id)
    .eq('reporter_user_id', reporterUserId)
    .maybeSingle()

  if (existingReportError) {
    console.error('reports: deduplication query failed', existingReportError)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (existingReport) {
    return new Response(JSON.stringify({ error: 'You have already reported this campaign' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: repRow, error: repFetchError } = await supabase
    .from('user_reputation')
    .select('user_id, reputation, reports_submitted_today, last_report_reset_at')
    .eq('user_id', reporterUserId)
    .maybeSingle()

  if (repFetchError) {
    console.error('reports: user_reputation query failed', repFetchError)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const nowIso = new Date().toISOString()
  let reputationRow: UserReputationRow

  if (!repRow) {
    const { data: insertedRepRow, error: repInsertError } = await supabase
      .from('user_reputation')
      .insert({
        user_id: reporterUserId,
        reputation: 0,
        reports_submitted_today: 0,
        last_report_reset_at: nowIso,
        updated_at: nowIso,
      })
      .select('user_id, reputation, reports_submitted_today, last_report_reset_at')
      .single()

    if (repInsertError || !insertedRepRow) {
      console.error('reports: user_reputation insert failed', repInsertError)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    reputationRow = insertedRepRow as UserReputationRow
  } else {
    reputationRow = repRow as UserReputationRow
  }

  let reportsSubmittedToday = Number(reputationRow.reports_submitted_today || 0)
  if (hasResetWindowElapsed(reputationRow.last_report_reset_at)) {
    reportsSubmittedToday = 0

    const { error: repResetError } = await supabase
      .from('user_reputation')
      .update({
        reports_submitted_today: 0,
        last_report_reset_at: nowIso,
        updated_at: nowIso,
      })
      .eq('user_id', reporterUserId)

    if (repResetError) {
      console.error('reports: user_reputation reset failed', repResetError)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const reputationScore = Number(reputationRow.reputation || 0)
  const dailyLimit = reputationScore >= 50 ? 5 : 2

  if (reportsSubmittedToday >= dailyLimit) {
    return new Response(JSON.stringify({ error: 'Daily report limit reached. Try again tomorrow.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: insertedReport, error: insertReportError } = await supabase
    .from('reports')
    .insert({
      campaign_id: body.campaign_id,
      reporter_user_id: reporterUserId,
      category: body.category,
      description: sanitizedDescription,
      is_anonymous: isAnonymous,
      status: 'PENDING',
    })
    .select('id')
    .single()

  if (insertReportError || !insertedReport) {
    console.error('reports: insert failed', insertReportError)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { error: campaignUpdateError } = await supabase
    .from('campaigns')
    .update({ report_count: Number(campaign.report_count || 0) + 1 })
    .eq('id', body.campaign_id)

  if (campaignUpdateError) {
    console.error('reports: campaign report_count update failed', campaignUpdateError)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { error: repCounterUpdateError } = await supabase
    .from('user_reputation')
    .update({
      reports_submitted_today: reportsSubmittedToday + 1,
      updated_at: nowIso,
    })
    .eq('user_id', reporterUserId)

  if (repCounterUpdateError) {
    console.error('reports: user_reputation counter update failed', repCounterUpdateError)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Report submitted successfully',
      report_id: insertedReport.id,
    }),
    {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('reports: missing required Supabase environment variables')
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const authResult = await authenticateRequest(req, supabase)
    if (authResult.response) {
      return authResult.response
    }

    const userId = authResult.userId
    const routeParts = getReportsRouteParts(req)

    if (req.method === 'GET') {
      if (routeParts.length === 0 || (routeParts.length === 1 && routeParts[0] === 'my-reports')) {
        return handleGetMyReports(supabase, userId)
      }

      if (routeParts.length === 1 && routeParts[0] !== 'my-reports') {
        return handleGetSingleReport(supabase, userId, routeParts[0])
      }

      if (routeParts.length === 2 && routeParts[1] === 'status') {
        return handleGetSingleReport(supabase, userId, routeParts[0])
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'POST') {
      return handlePostReport(req, supabase, userId)
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('reports: unexpected error', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
