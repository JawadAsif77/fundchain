// supabase/functions/buy-fc-tokens/index.ts
// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FC_PER_SOL = 100; // 1 SOL = 100 FC

Deno.serve(async (req) => {
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

    // DEMO_MODE=true  → simulated txSignatures are accepted (FYP demo).
    // DEMO_MODE=false → txSignature is verified on the Solana blockchain (production).
    // Duplicate-signature checks run in BOTH modes to prevent replay attacks.
    const isDemoMode = Deno.env.get("DEMO_MODE") === "true";

    // --- Auth: derive user from JWT, never trust body ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify JWT — userId in the request body is intentionally ignored
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    // userId from body is intentionally ignored — we use the verified JWT user ID below
    const { amountSol, amountFc, usdAmount, txSignature, purchaseType } = body ?? {};

    if (!txSignature || typeof txSignature !== "string") {
      return new Response(
        JSON.stringify({ error: "txSignature is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Replay-attack prevention: reject duplicate signatures ---
    // txSignature is stored in metadata->txSignature in token_transactions.
    // This check runs in both demo and production mode.
    const { data: existingTx } = await supabase
      .from("token_transactions")
      .select("id")
      .eq("metadata->>txSignature", txSignature)
      .maybeSingle();

    if (existingTx) {
      return new Response(
        JSON.stringify({ error: "Transaction signature has already been used" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- On-chain verification (production mode only) ---
    if (!isDemoMode) {
      const solanaNetwork = Deno.env.get("SOLANA_NETWORK") ?? "devnet";
      const rpcUrl = solanaNetwork === "mainnet-beta"
        ? "https://api.mainnet-beta.solana.com"
        : "https://api.devnet.solana.com";

      let rpcData: { result?: unknown };
      try {
        const rpcResp = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTransaction",
            params: [txSignature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
          }),
        });
        rpcData = await rpcResp.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Unable to reach Solana RPC for verification" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!rpcData?.result) {
        return new Response(
          JSON.stringify({ error: "Transaction not found on-chain or not yet confirmed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // --- Calculate FC to credit ---
    let fcAmount: number;
    let sourceAmount: number;
    let sourceType: string;

    if (purchaseType === "usd" && amountFc) {
      fcAmount = Number(amountFc);
      sourceAmount = Number(usdAmount || amountFc);
      sourceType = "USD";
    } else if (amountSol) {
      const parsedAmountSol = Number(amountSol);
      if (!parsedAmountSol || parsedAmountSol <= 0) {
        return new Response(
          JSON.stringify({ error: "amountSol must be a positive number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      fcAmount = parsedAmountSol * FC_PER_SOL;
      sourceAmount = parsedAmountSol;
      sourceType = "SOL";
    } else {
      return new Response(
        JSON.stringify({ error: "Either amountFc (for USD) or amountSol (for SOL) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!fcAmount || fcAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid FC amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the authenticated user's ID — not anything from the request body
    const userId = user.id;

    // 1) Get or create wallet
    const { data: existingWallet, error: walletSelectError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletSelectError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch wallet" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let wallet;
    if (!existingWallet) {
      const { data: newWallet, error: insertWalletError } = await supabase
        .from("wallets")
        .insert({ user_id: userId, balance_fc: fcAmount, locked_fc: 0 })
        .select("*")
        .single();

      if (insertWalletError) {
        return new Response(
          JSON.stringify({ error: "Failed to create wallet" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      wallet = newWallet;
    } else {
      const newBalance = Number(existingWallet.balance_fc ?? 0) + fcAmount;
      const { data: updatedWallet, error: updateWalletError } = await supabase
        .from("wallets")
        .update({ balance_fc: newBalance })
        .eq("user_id", userId)
        .select("*")
        .single();

      if (updateWalletError) {
        return new Response(
          JSON.stringify({ error: "Failed to update wallet" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      wallet = updatedWallet;
    }

    // 2) Insert token transaction (txSignature stored in metadata for deduplication queries)
    await supabase.from("token_transactions").insert({
      user_id: userId,
      type: "buy_fc",
      amount_fc: fcAmount,
      metadata: {
        sourceAmount,
        sourceType,
        txSignature,
        fcRate: purchaseType === "usd" ? 1 : FC_PER_SOL,
        network: purchaseType === "usd" ? "fiat" : "devnet",
        purchaseType: purchaseType || "sol",
        demo_mode: isDemoMode,
      },
    });

    // 3) Audit log
    await supabase.from("audit_logs").insert({
      actor_user_id: userId,
      action: "BUY_FC",
      target_type: "wallet",
      target_id: userId,
      metadata: { amountFc: fcAmount, sourceType, sourceAmount, demo_mode: isDemoMode },
    });

    return new Response(
      JSON.stringify({
        status: "success",
        sourceAmount,
        sourceType,
        amountFc: fcAmount,
        demo_mode: isDemoMode,
        wallet: {
          balance_fc: wallet.balance_fc,
          locked_fc: wallet.locked_fc,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (_err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
