// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
      console.error('reputation: missing Supabase environment variables')
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    const authUserId = user.id

    const { data: authUserRow, error: authUserRowError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', authUserId)
      .maybeSingle()

    if (authUserRowError) {
      console.error('reputation: failed to fetch auth user role', authUserRowError)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isAdmin = authUserRow?.role === 'admin'

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const functionIndex = pathParts.lastIndexOf('reputation')
    const routeParts = functionIndex === -1 ? [] : pathParts.slice(functionIndex + 1)

    // ROUTE 1: GET /reputation/{userId}
    if (req.method === 'GET' && routeParts.length === 1) {
      const userId = routeParts[0]

      if (!UUID_REGEX.test(userId)) {
        return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (authUserId !== userId && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: repRow, error: repError } = await supabase
        .from('user_reputation')
        .select('user_id, reputation, reports_submitted_today')
        .eq('user_id', userId)
        .maybeSingle()

      if (repError) {
        console.error('reputation: failed to fetch user_reputation', repError)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!repRow) {
        return new Response(JSON.stringify({ error: 'User reputation record not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: logRows, error: logError } = await supabase
        .from('reputation_log')
        .select('id, change_amount, reason, related_report_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (logError) {
        console.error('reputation: failed to fetch reputation history', logError)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const currentReputation = Number(repRow.reputation || 0)
      const dailyLimit = currentReputation >= 50 ? 5 : 2

      return new Response(
        JSON.stringify({
          success: true,
          user_id: userId,
          current_reputation: currentReputation,
          reports_submitted_today: Number(repRow.reports_submitted_today || 0),
          daily_limit: dailyLimit,
          history: logRows || [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // ROUTE 2: POST /reputation/deduct
    if (req.method === 'POST' && routeParts.length === 1 && routeParts[0] === 'deduct') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden. Admin access required.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const body = await req.json()
      const userId = body?.user_id
      const amount = body?.amount
      const reason = body?.reason
      const relatedReportId = body?.related_report_id

      if (!userId || typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
        return new Response(JSON.stringify({ error: 'user_id is required and must be a valid UUID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
        return new Response(JSON.stringify({ error: 'amount is required and must be an integer between 1 and 100' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!reason || typeof reason !== 'string' || reason.trim().length === 0 || reason.trim().length > 255) {
        return new Response(JSON.stringify({ error: 'reason is required and must be at most 255 characters' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (typeof relatedReportId !== 'undefined' && relatedReportId !== null) {
        if (typeof relatedReportId !== 'string' || !UUID_REGEX.test(relatedReportId)) {
          return new Response(JSON.stringify({ error: 'related_report_id must be a valid UUID' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      const { data: repRow, error: repError } = await supabase
        .from('user_reputation')
        .select('user_id, reputation')
        .eq('user_id', userId)
        .maybeSingle()

      if (repError) {
        console.error('reputation: failed to fetch user_reputation for deduct', repError)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!repRow) {
        return new Response(JSON.stringify({ error: 'User reputation record not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const previousReputation = Number(repRow.reputation || 0)
      const newReputation = Math.max(0, previousReputation - amount)

      const { error: updateError } = await supabase
        .from('user_reputation')
        .update({ reputation: newReputation })
        .eq('user_id', userId)

      if (updateError) {
        console.error('reputation: failed to update user_reputation', updateError)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: logInsertError } = await supabase
        .from('reputation_log')
        .insert({
          user_id: userId,
          change_amount: -amount,
          reason: reason.trim(),
          related_report_id: relatedReportId ?? null,
        })

      if (logInsertError) {
        console.error('reputation: failed to insert reputation_log', logInsertError)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log('Manual reputation deduction: ', amount, 'from user: ', userId, 'by admin: ', authUserId)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Reputation deducted successfully',
          user_id: userId,
          deducted_amount: amount,
          previous_reputation: previousReputation,
          new_reputation: newReputation,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('reputation: unexpected error', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
