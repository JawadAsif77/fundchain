import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      token
    );

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { otp } = await req.json();

    if (!otp) {
      throw new Error("OTP is required");
    }

    // Get stored OTP from user_verifications
    const { data: verification, error: fetchError } = await supabaseClient
      .from("user_verifications")
      .select("phone_otp_code, phone_otp_expires_at, phone_otp_attempts")
      .eq("user_id", user.id)
      .single();

    if (fetchError || !verification) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No OTP request found. Please request a new OTP.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Check if OTP exists
    if (!verification.phone_otp_code) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No OTP request found. Please request a new OTP.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Check if OTP has expired
    if (new Date(verification.phone_otp_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "OTP has expired. Please request a new OTP.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Check if too many attempts
    if (verification.phone_otp_attempts >= 5) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Too many failed attempts. Please request a new OTP.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Verify OTP
    if (verification.phone_otp_code === otp) {
      // OTP is correct - mark as verified
      const { error: updateError } = await supabaseClient
        .from("user_verifications")
        .update({
          phone_verified: true,
          phone_verified_at: new Date().toISOString(),
          phone_otp_code: null,
          phone_otp_expires_at: null,
          phone_otp_attempts: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Error updating verification:", updateError);
        throw new Error("Failed to verify phone");
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Phone verified successfully",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      // OTP is incorrect - increment attempts
      const { error: updateError } = await supabaseClient
        .from("user_verifications")
        .update({
          phone_otp_attempts: verification.phone_otp_attempts + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Error updating attempts:", updateError);
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid OTP. Please try again.",
          attempts_remaining: 5 - verification.phone_otp_attempts - 1,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
  } catch (error) {
    console.error("Error in verify-phone-otp function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
