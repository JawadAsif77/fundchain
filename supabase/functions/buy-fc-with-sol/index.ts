// supabase/functions/buy-fc-with-sol/index.ts
// Deno edge function
// POST body: { userId, amountUsd, amountSol, txSignature }

// @deno-types="https://esm.sh/@supabase/supabase-js@2"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { userId, amountUsd, amountSol, txSignature } = body ?? {};

    if (!userId || !amountUsd || !amountSol || !txSignature) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1 FC = $1 for now (or read from env)
    const rate = Number(Deno.env.get('FC_USD_RATE') ?? '1');
    const fcAmount = Math.round(Number(amountUsd) * rate);

    // Optional: here you could verify txSignature on Solana RPC that
    // amountSol was actually paid to your TREASURY_WALLET.

    // Update wallets table: add fcAmount to balance_fc
    const { data: walletRow, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (walletError && walletError.code !== 'PGRST116') {
      console.error('Wallet fetch error:', walletError);
      throw walletError;
    }

    if (!walletRow) {
      const { data: created, error: createError } = await supabase
        .from('wallets')
        .insert({
          user_id: userId,
          balance_fc: fcAmount,
          locked_fc: 0,
        })
        .select()
        .single();

      if (createError) throw createError;

      return new Response(
        JSON.stringify({
          status: 'created',
          fcAmount,
          wallet: created,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('wallets')
      .update({
        balance_fc: (walletRow.balance_fc ?? 0) + fcAmount,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Optionally log transaction in wallet_transactions table
    await supabase.from('wallet_transactions').insert({
      user_id: userId,
      type: 'buy_fc_with_sol',
      amount_fc: fcAmount,
      amount_usd: amountUsd,
      amount_sol: amountSol,
      sol_tx_signature: txSignature,
      status: 'completed',
    });

    return new Response(
      JSON.stringify({
        status: 'ok',
        fcAmount,
        wallet: updated,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('buy-fc-with-sol error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
