import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  try {
    const { message } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400 }
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const model = Deno.env.get("OPENROUTER_MODEL");

    if (!apiKey || !model) {
      throw new Error("Missing environment variables");
    }

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
          messages: [
            {
              role: "system",
              content: `You are FC AI, an intelligent investment assistant for FundChain, a blockchain-based business crowdfunding platform. Your role is to help users understand investment opportunities, campaign details, and platform features.

Guidelines:
- Explain investment concepts and blockchain terminology in clear, accessible language
- Provide neutral, educational information without offering financial advice
- When discussing campaigns, reference available data like risk scores, funding progress, and recommendations
- Never guarantee profits or promise investment returns
- Acknowledge investment risks and encourage users to do their own research
- Be concise, professional, and helpful
- If asked about specific campaigns, use available context to provide relevant insights
- Direct users to consult financial advisors for personalized investment advice

Remember: You inform and educate, but users make their own investment decisions.`
            },
            { role: "user", content: message }
          ]
        })
      }
    );

    const data = await response.json();

    return new Response(
      JSON.stringify({
        reply: data.choices?.[0]?.message?.content ?? "No response"
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: errorMessage
      }),
      { status: 500 }
    );
  }
});
