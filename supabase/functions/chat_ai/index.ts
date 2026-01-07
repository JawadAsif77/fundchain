import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface Message {
  role: string;
  content: string;
}

interface Document {
  content: string;
  metadata?: Record<string, unknown>;
}

interface Investment {
  amount: number;
  status: string;
  campaign_id: string;
  campaigns: {
    title: string;
    final_risk_score: number | null;
  };
}

serve(async (req) => {
  try {
    // 1. HANDLE CORS PREFLIGHT
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    // 2. PARSE REQUEST
    const { messages, campaignId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }

    // 3. ENVIRONMENT VARIABLES
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const model = Deno.env.get("OPENROUTER_MODEL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!apiKey || !model || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================================
    // 4. PERSONAL ASSISTANT LOGIC (Auth & Dossier)
    // ============================================================
    const authHeader = req.headers.get("Authorization");
    let userDossier = "";
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (!authError && user) {
          // Fetch from your actual schema: public.users, public.wallets, public.investments
          const { data: profile } = await supabase.from("users").select("full_name, role, trust_score").eq("id", user.id).single();
          const { data: wallet } = await supabase.from("wallets").select("balance_fc, locked_fc").eq("user_id", user.id).single();
          const { data: investments } = await supabase
            .from("investments")
            .select("amount, status, campaign_id, campaigns!inner(title, final_risk_score)")
            .eq("investor_id", user.id) as { data: Investment[] | null };

          const available = wallet?.balance_fc || 0;
          const locked = wallet?.locked_fc || 0;
          
          let portfolioSummary = "No active investments found.";
          if (investments && investments.length > 0) {
            portfolioSummary = investments.map((inv: Investment) => {
              const campaign = inv.campaigns;
              const risk = campaign?.final_risk_score;
              const riskLabel = risk ? (risk < 0.3 ? "Low ✅" : risk < 0.6 ? "Medium ⚠️" : "High 🚨") : "Unscored";
              return `• **${campaign?.title}**: ${inv.amount} FC (${riskLabel})`;
            }).join("\n");
          }

          userDossier = `
### USER DOSSIER
👤 **Name:** ${profile?.full_name || 'User'}
🎭 **Role:** ${profile?.role || 'Investor'}
💎 **Trust Score:** ${profile?.trust_score || 0}/100
💰 **Wallet:** ${available.toFixed(2)} FC Available | ${locked.toFixed(2)} FC Locked
💼 **Portfolio:**
${portfolioSummary}
`;
        }
      } catch (e) { console.log("User Context Error:", e); }
    }

    // ============================================================
    // 5. CAMPAIGN DEEP DIVE (Current Page Knowledge)
    // ============================================================
    let deepDiveContext = "";
    if (campaignId) {
      try {
        const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
        const { data: milestones } = await supabase.from("milestones").select("*").eq("campaign_id", campaignId).order("order_index");

        if (campaign) {
          const milestoneList = milestones?.map((m, i) => 
            `${i+1}. **${m.title}**: ${m.description} [Status: ${m.is_completed ? '✅ Done' : '⏳ Pending'}]`
          ).join("\n");

          deepDiveContext = `
### CURRENT PROJECT CONTEXT (User is viewing this)
Project: **${campaign.title}**
Goal: ${campaign.funding_goal} FC | Raised: ${campaign.current_funding} FC
Risk Assessment: ${campaign.final_risk_score || 'Pending'}
Description: ${campaign.description}
Roadmap:
${milestoneList}
`;
        }
      } catch (e) { console.log("Deep Dive Error:", e); }
    }

    // ============================================================
    // 6. ACTIVE CAMPAIGNS (Real-Time Platform Data)
    // ============================================================
    let activeCampaignsInfo = "";
    try {
      const { data: activeCampaigns } = await supabase
        .from("campaigns")
        .select("id, title, description, final_risk_score, funding_goal, current_funding, status")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(10);

      if (activeCampaigns && activeCampaigns.length > 0) {
        activeCampaignsInfo = activeCampaigns.map((c, i) => 
          `${i+1}. **${c.title}** (ID: ${c.id})\n   Goal: ${c.funding_goal} FC | Raised: ${c.current_funding} FC | Risk: ${c.final_risk_score || 'N/A'}`
        ).join("\n");
      } else {
        activeCampaignsInfo = "No active campaigns currently available.";
      }
    } catch (e) {
      console.log("Active Campaigns Fetch Error:", e);
      activeCampaignsInfo = "Unable to fetch active campaigns.";
    }

    // ============================================================
    // 7. RAG (Knowledge Retrieval)
    // ============================================================
    const lastUserMsg = messages.filter((m: Message) => m.role === "user").pop()?.content || "";
    let retrievedContext = "";
    
    if (lastUserMsg) {
      const embResp = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "openai/text-embedding-3-small", input: lastUserMsg })
      });
      const embData = await embResp.json();
      const embedding = embData.data?.[0]?.embedding;

      if (embedding) {
        const { data: docs } = await supabase.rpc("match_documents", { 
          query_embedding: embedding, 
          match_threshold: 0.3, 
          match_count: 3 
        });
        retrievedContext = docs?.map((d: Document) => d.content).join("\n\n---\n\n") || "";
      }
    }

    // ============================================================
    // 8. SYSTEM PROMPT & LLM CALL
    // ============================================================
    const systemPrompt = `You are FC AI, a Personal Financial Assistant for FundChain. 

${userDossier}
${deepDiveContext}

📊 REAL-TIME PLATFORM DATA (Active Campaigns):
${activeCampaignsInfo}

📚 KNOWLEDGE BASE:
${retrievedContext}

**CORE PERSONA:**
- You are a helpful, protective investment guide.
- **Tone:** Use simple analogies like "Digital Safe" for escrow and "Safety Check" for risk detection. Avoid tech jargon (RPC, HNSW, Smart Contracts).
- **Briefness:** Start with a 2-line summary. Use detail only if asked.
- **Rules:** 1 SOL = 100 FC. Reference the user's specific investments and balance from the Dossier.
- **Formatting:** Use **Bold** for all numbers and key terms. Use bullet points for lists.
- **Safety:** Always mention Milestone-Based Escrow and AI Risk scores when security is discussed.
- **Call to Action:** Every response MUST end with a short "Next Step" question.

🚨 CRITICAL: NO HALLUCINATIONS
- **NEVER** invent project names, campaigns, or data that doesn't appear in the sections above.
- **DATA SOURCE:** Only suggest or discuss campaigns that appear in "REAL-TIME PLATFORM DATA" or "CURRENT PROJECT CONTEXT".
- **FAILSAFE:** If activeCampaignsInfo says "No active campaigns" or is empty, tell the user: "I don't see any live campaigns in the database right now. Would you like to know how to create one?"
- **VALIDATION:** If a user asks about "Campaign 1" or any specific project, check if it exists in the provided data. If NOT found, explain: "I can only see the campaigns currently live on FundChain. Here's what's available: [list from REAL-TIME PLATFORM DATA]."
- **HONESTY:** If you don't have information, say "I don't have that information right now" instead of guessing.

Remember: You inform and educate, but users make their own decisions.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "FC AI Assistant"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages]
      })
    });

    const data = await response.json();
    return new Response(JSON.stringify({ 
      answer: data.choices?.[0]?.message?.content ?? "No response",
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
    });
  }
});