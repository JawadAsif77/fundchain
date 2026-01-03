import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { prepareEmbeddings, findRelevantKnowledge } from './external_model.ts';
import { detectIntent } from './intent.ts';
import { buildInternalContext } from './internal_context.ts';
import { generateExplanation } from './explain.ts';
import { buildCompletePrompt, getDisclaimerText } from './prompts.ts';
import { callLLM } from './llm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Global cache to prevent re-training on every click
let cachedEmbeddings: Array<{ question: string; answer: string; embedding: number[] }> | null = null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const _geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || "";
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || "";

    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || "" } }
    });

    const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || "");
    if (!user) throw new Error('Unauthorized');

    const { message, campaignId, history: chatHistory } = await req.json();
    const intent = detectIntent(message);

    let knowledgeMatches: Array<{ question: string; answer: string; embedding: number[]; similarity?: number }> = [];
    let internalContext = {};
    let explanation = "";

    // OPTIMIZATION: Only run RAG if it's not a simple greeting
    const isGreeting = ["hello", "hi", "hey", "greetings"].includes(message.toLowerCase().trim());

    if (!isGreeting) {
      // 1. RAG: External Knowledge (Only if needed or not a greeting)
      if (!cachedEmbeddings) {
        console.log("Cold start: Training knowledge base...");
        cachedEmbeddings = await prepareEmbeddings();
      }
      knowledgeMatches = await findRelevantKnowledge(message, cachedEmbeddings);

      // 2. Internal Context (Campaign data)
      internalContext = await buildInternalContext({ supabase, userId: user.id, campaignId });
      if (Object.keys(internalContext).length > 0) {
        explanation = generateExplanation(internalContext).fullExplanation;
      }
    }

    // 3. Assemble Prompt
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = buildCompletePrompt(message, intent, internalContext, explanation, knowledgeMatches);

    // 4. History Integration
    if (chatHistory?.length > 0) {
      const historyItems: Array<{ role: 'user' | 'assistant'; content: string }> = chatHistory.slice(-3).map((h: { role: string; message?: string; response?: string }) => ({
        role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: h.message || h.response || ""
      }));
      messages.splice(1, 0, ...historyItems);
    }

    // 5. Call Chatbot
    const answer = await callLLM(messages);
    const finalResponse = answer + getDisclaimerText(intent);

    // 6. Save to DB
    await supabase.from('chat_messages').insert({
      user_id: user.id, message, response: finalResponse, intent
    });

    return new Response(JSON.stringify({ answer: finalResponse, intent }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Edge Function Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, headers: corsHeaders 
    });
  }
});