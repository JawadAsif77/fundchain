// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const body = await req.json()
    const userId = body.userId

    // Validate input
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request: userId is required and must be a string' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Query campaign_investments with join to campaigns
    const { data: investments, error: investmentsError } = await supabase
      .from('campaign_investments')
      .select(`
        campaign_id,
        amount_fc,
        created_at,
        campaigns (
          title,
          image_url
        )
      `)
      .eq('investor_id', userId)
      .order('created_at', { ascending: false })

    if (investmentsError) {
      throw new Error(`Failed to fetch investments: ${investmentsError.message}`)
    }

    // Return investments
    return new Response(
      JSON.stringify({ 
        status: 'success',
        investments: investments || []
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (err) {
    console.error('Error in get-user-investments:', err)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: String(err)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
