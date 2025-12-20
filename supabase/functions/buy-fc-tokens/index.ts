// supabase/functions/buy-fc-tokens/index.ts
// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FC_PER_SOL = 100; // 🔹 1 SOL = 100 FC (adjust if you want)

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase env vars");
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { userId, amountSol, amountFc, usdAmount, txSignature, purchaseType } = body ?? {};

    if (!userId || typeof userId !== "string") {
      return new Response(
        JSON.stringify({ error: "userId is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!txSignature || typeof txSignature !== "string") {
      return new Response(
        JSON.stringify({ error: "txSignature is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate FC to credit based on purchase type
    let fcAmount: number;
    let sourceAmount: number;
    let sourceType: string;

    if (purchaseType === 'usd' && amountFc) {
      // USD purchase: FC amount is already calculated (1 USD = 1 FC)
      fcAmount = Number(amountFc);
      sourceAmount = Number(usdAmount || amountFc);
      sourceType = 'USD';
    } else if (amountSol) {
      // SOL purchase: Convert SOL to FC (1 SOL = 100 FC)
      const parsedAmountSol = Number(amountSol);
      if (!parsedAmountSol || parsedAmountSol <= 0) {
        return new Response(
          JSON.stringify({ error: "amountSol must be a positive number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      fcAmount = parsedAmountSol * FC_PER_SOL;
      sourceAmount = parsedAmountSol;
      sourceType = 'SOL';
    } else {
      return new Response(
        JSON.stringify({ error: "Either amountFc (for USD) or amountSol (for SOL) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!fcAmount || fcAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid FC amount calculated" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) Get or create wallet
    const { data: existingWallet, error: walletSelectError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletSelectError) {
      console.error("walletSelectError", walletSelectError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch wallet", details: walletSelectError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let wallet;
    if (!existingWallet) {
      // create wallet with initial balance
      const { data: newWallet, error: insertWalletError } = await supabase
        .from("wallets")
        .insert({
          user_id: userId,
          balance_fc: fcAmount,
          locked_fc: 0,
        })
        .select("*")
        .single();

      if (insertWalletError) {
        console.error("insertWalletError", insertWalletError);
        return new Response(
          JSON.stringify({ error: "Failed to create wallet", details: insertWalletError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      wallet = newWallet;
    } else {
      // update existing wallet balance
      const newBalance = Number(existingWallet.balance_fc ?? 0) + fcAmount;

      const { data: updatedWallet, error: updateWalletError } = await supabase
        .from("wallets")
        .update({ balance_fc: newBalance })
        .eq("user_id", userId)
        .select("*")
        .single();

      if (updateWalletError) {
        console.error("updateWalletError", updateWalletError);
        return new Response(
          JSON.stringify({ error: "Failed to update wallet", details: updateWalletError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      wallet = updatedWallet;
    }

    // 2) Insert token transaction record
    const { error: txInsertError } = await supabase
      .from("token_transactions")
      .insert({
        user_id: userId,
        type: "buy_fc",
        amount_fc: fcAmount,
        metadata: {
          sourceAmount,
          sourceType,
          txSignature,
          fcRate: purchaseType === 'usd' ? 1 : FC_PER_SOL,
          network: purchaseType === 'usd' ? 'fiat' : 'devnet',
          purchaseType: purchaseType || 'sol',
        },
      });

    if (txInsertError) {
      console.error("txInsertError", txInsertError);
      // We don't revert wallet update here, just log
    }

    return new Response(
      JSON.stringify({
        status: "success",
        userId,
        sourceAmount,
        sourceType,
        amountFc: fcAmount,
        wallet: {
          balance_fc: wallet.balance_fc,
          locked_fc: wallet.locked_fc,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in buy-fc-tokens:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
