import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const kycData = (body && typeof body === "object" && "kycData" in body) ? body.kycData : body;

    if (!kycData || typeof kycData !== "object") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const now = new Date().toISOString();

    // Only allow writing to the authenticated user's record.
    // Also protect admin-managed fields from being overwritten by the client.
    const payload: Record<string, unknown> = {
      ...kycData,
      user_id: user.id,
      verification_status: "pending",
      updated_at: now,
    };

    delete payload.id;
    delete payload.reviewed_by;
    delete payload.reviewed_at;
    delete payload.rejection_reason;
    delete payload.admin_notes;

    // If already approved, do not allow overwriting.
    const { data: existing, error: existingError } = await supabaseClient
      .from("user_verifications")
      .select("verification_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking existing KYC:", existingError);
    }

    if (existing && existing.verification_status === "approved") {
      return new Response(
        JSON.stringify({ success: false, error: "KYC is already approved and cannot be updated." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
      );
    }

    const { data: row, error: upsertError } = await supabaseClient
      .from("user_verifications")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (upsertError) {
      console.error("KYC upsert error:", upsertError);
      return new Response(
        JSON.stringify({ success: false, error: upsertError.message || "Failed to update KYC" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    // Keep the user profile verification status in sync.
    const { error: userUpdateError } = await supabaseClient
      .from("users")
      .update({ is_verified: "pending", updated_at: now })
      .eq("id", user.id);

    if (userUpdateError) {
      console.error("Error updating users.is_verified:", userUpdateError);
      // Don't fail the whole request if KYC row was updated.
    }

    return new Response(
      JSON.stringify({ success: true, data: row }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Error in update-kyc function:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
