/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { Connection } from 'https://esm.sh/@solana/web3.js@1.95.8';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as { userId: string; txId: string; amountSol: number };
    const { userId, txId, amountSol } = body;

    if (!userId || !txId || !amountSol) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // verify on Solana blockchain
    const connection = new Connection("https://api.devnet.solana.com");
    const tx = await connection.getTransaction(txId, { commitment: "confirmed" });

    if (!tx) {
      return new Response(
        JSON.stringify({ error: "Transaction not found on blockchain" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Credit FC: 1 SOL = 100 FC (example)
    const fcAmount = amountSol * 100;

    // Get current wallet balance
    const walletResponse = await supabase
      .from("wallets")
      .select("balance_fc")
      .eq("user_id", userId)
      .single();

    if (walletResponse.error) {
      return new Response(
        JSON.stringify({ error: "Wallet not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Update wallet with new balance
    const newBalance = (walletResponse.data.balance_fc || 0) + fcAmount;
    
    const updateResponse = await supabase
      .from("wallets")
      .update({ balance_fc: newBalance })
      .eq("user_id", userId);

    if (updateResponse.error) {
      return new Response(
        JSON.stringify({ error: updateResponse.error.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Record transaction
    await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        type: "DEPOSIT_SOL",
        amount_fc: fcAmount,
        metadata: { txId, amountSol }
      });

    return new Response(
      JSON.stringify({ success: true, credited: fcAmount }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
