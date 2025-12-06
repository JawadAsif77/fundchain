const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fixed conversion rate: 1 USD = 1 FC
const USD_TO_FC_RATE = 1

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const body = await req.json()
    const usd = body.usd

    // Validate input
    if (typeof usd !== 'number' || usd <= 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request: usd must be a positive number' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Calculate FC tokens
    const fc = usd * USD_TO_FC_RATE

    // Return conversion result
    return new Response(
      JSON.stringify({ 
        status: 'success',
        usd,
        fc
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (err) {
    console.error('Error in exchange-usd-to-fc:', err)
    
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
