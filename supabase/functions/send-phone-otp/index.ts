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

    const { phone, countryCode } = await req.json();

    if (!phone) {
      throw new Error("Phone number is required");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Check if user_verifications record exists
    const { data: existingRecord } = await supabaseClient
      .from("user_verifications")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existingRecord) {
      // Update existing record
      const { error: updateError } = await supabaseClient
        .from("user_verifications")
        .update({
          phone_otp_code: otp,
          phone_otp_expires_at: expiresAt,
          phone_otp_attempts: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Error updating OTP:", updateError);
        throw new Error(`Failed to update OTP: ${updateError.message || updateError.code || 'Unknown error'}`);
      }
    } else {
      // Create new record with minimal required fields
      const { error: insertError } = await supabaseClient
        .from("user_verifications")
        .insert({
          user_id: user.id,
          legal_name: "Pending",
          phone: phone,
          phone_country_code: countryCode || "+1",
          legal_email: user.email || "pending@example.com",
          legal_address: {
            line1: "Pending",
            city: "Pending",
            state: "Pending",
            postal_code: "00000",
            country: "Pending"
          },
          phone_otp_code: otp,
          phone_otp_expires_at: expiresAt,
          phone_otp_attempts: 0,
          verification_status: "pending",
        });

      if (insertError) {
        console.error("Error inserting OTP:", insertError);
        throw new Error(`Failed to generate OTP: ${insertError.message || insertError.code || 'Unknown error'}`);
      }
    }

    // TODO: In production, integrate with SMS provider here
    // Example: Twilio, AWS SNS, or any SMS gateway
    // await sendSMS(phone, `Your verification code is: ${otp}`);

    // For development, we return the OTP in the response
    // REMOVE THIS IN PRODUCTION!
    return new Response(
      JSON.stringify({
        success: true,
        message: "OTP sent successfully",
        // Remove 'otp' field in production
        otp: otp,
        expiresAt: expiresAt,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in send-phone-otp function:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
