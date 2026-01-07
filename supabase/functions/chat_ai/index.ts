import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface Message {
  role: string;
  content: string;
}

interface Document {
  content: string;
  metadata?: {
    document?: string;
    chunk_index?: number;
  };
  similarity: number;
}

interface Campaign {
  title: string;
  funding_goal: number;
  categories?: {
    name: string;
  } | null;
}

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { 
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const model = Deno.env.get("OPENROUTER_MODEL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!apiKey || !model || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    // Initialize Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the last user message for embedding
    const lastUserMessage = messages
      .filter((m) => m.role === "user")
      .pop()?.content || "";

    // Generate embedding for the user's query using OpenRouter
    let retrievedContext = "";
    
    if (lastUserMessage) {
      try {
        // Call OpenRouter embedding API (text-embedding-3-small for consistent embeddings)
        const embeddingResponse = await fetch(
          "https://openrouter.ai/api/v1/embeddings",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://fundchain.app",
              "X-Title": "FundChain RAG System",
            },
            body: JSON.stringify({
              model: "openai/text-embedding-3-small",
              input: lastUserMessage,
            }),
          }
        );

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data?.[0]?.embedding;

        if (embedding) {
          // Perform vector search using Supabase RPC
          const { data: documents, error: vectorError } = await supabase.rpc(
            "match_documents",
            {
              query_embedding: embedding,
              match_threshold: 0.3,
              match_count: 3,
            }
          );

          if (!vectorError && documents && documents.length > 0) {
            // Format retrieved context with source citations
            retrievedContext = (documents as Document[])
              .map((doc: Document) => {
                const source = doc.metadata?.document || 'Unknown Source';
                return `[Source: ${source}]\n${doc.content}`;
              })
              .join("\n\n---\n\n");
          }
        }
      } catch (vectorErr) {
        console.error("Vector search failed:", vectorErr);
        // Continue without RAG if vector search fails
      }
    }

    // Fetch active campaigns data
    const { data: campaigns, error: dbError } = await supabase
      .from("campaigns")
      .select("title, funding_goal, status, categories(name)")
      .eq("status", "active")
      .limit(10);

    let activeCampaignsInfo = "No active campaigns at the moment.";
    
    if (!dbError && campaigns && campaigns.length > 0) {
      const campaignList = campaigns
        .map((c) => {
          const cats = c.categories as unknown;
          let categoryName = "Uncategorized";
          
          // Handle both array and object cases
          if (Array.isArray(cats) && cats.length > 0) {
            categoryName = cats[0].name || "Uncategorized";
          } else if (cats && typeof cats === 'object' && 'name' in cats) {
            categoryName = (cats as { name: string }).name || "Uncategorized";
          }
          
          return `${c.title} (${categoryName}, Goal: ${c.funding_goal} FC)`;
        })
        .join(", ");
      activeCampaignsInfo = `Active Campaigns: ${campaignList}`;
    }

    // Create payload with enhanced system message
    const payload = [
      {
        role: "system",
        content: `You are FC AI, an intelligent investment assistant for FundChain, a blockchain-based business crowdfunding platform. Your role is to help users understand investment opportunities, campaign details, and platform features.

**FundChain Platform Rules & Features:**

🪙 **Tokenomics:**
- 1 SOL = 100 FC (FundChain Tokens)
- FC tokens are used for all investments on the platform
- Users can exchange SOL to FC and vice versa

🔒 **Security - Milestone-Based Escrow:**
- All investments are held in secure escrow smart contracts
- Funds are ONLY released to creators when milestones are verified and approved
- Investors can vote on milestone completion
- This protects investors from scams and ensures accountability

🎯 **AI Risk Detection:**
- Every campaign is analyzed by our AI scam-detection system
- Risk scores (Low, Medium, High) are assigned based on:
  - Content plagiarism detection
  - Creator wallet history analysis
  - ML-based scam pattern recognition
- Admin can manually override risk levels if needed

📊 **Real-Time Platform Data:**
${activeCampaignsInfo}

${retrievedContext ? `\n📚 **TECHNICAL CONTEXT:**\nThe following technical documentation provides specific details about the platform's architecture, limitations, and scope:\n\n${retrievedContext}\n\nUse this Technical Context to answer questions about the platform's architecture, limitations, specific features, and any scope details mentioned in the documents.\n` : ''}

**Guidelines:**
- Explain investment concepts and blockchain terminology in clear, accessible language
- Reference the actual active campaigns listed above when users ask about opportunities
- Always mention the tokenomics (1 SOL = 100 FC) when discussing investments
- Emphasize the security of milestone-based escrow when discussing safety
- Highlight the AI risk scoring system when discussing due diligence
- When technical questions arise, use the Technical Context provided above
- Provide neutral, educational information without offering financial advice
- Never guarantee profits or promise investment returns
- Acknowledge investment risks and encourage users to do their own research
- Be concise, professional, and helpful
- Direct users to consult financial advisors for personalized investment advice

Remember: You inform and educate, but users make their own investment decisions.`
      },
      ...messages  // Append the full conversation history
    ];

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost",
          "X-Title": "FC AI Chatbot"
        },
        body: JSON.stringify({
          model,
          messages: payload
        })
      }
    );

    const data = await response.json();

    return new Response(
      JSON.stringify({
        answer: data.choices?.[0]?.message?.content ?? "No response",
        intent: "GENERAL",
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        } 
      }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: errorMessage
      }),
      { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
