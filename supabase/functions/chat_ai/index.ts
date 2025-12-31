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

// Cache embeddings in memory (loaded once per function instance)
let cachedEmbeddings: any[] | null = null;

async function getEmbeddings() {
  if (!cachedEmbeddings) {
    console.log('Loading embeddings for the first time...');
    cachedEmbeddings = await prepareEmbeddings();
    console.log(`Loaded ${cachedEmbeddings.length} embeddings into cache`);
  }
  return cachedEmbeddings;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !geminiApiKey) {
      throw new Error('Missing environment variables');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body - API Contract
    // POST /chat_ai
    // body: { message, campaignId?, history? }
    // response: { answer, explanation, intent }
    const { message, campaignId, history } = await req.json();
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${user.id} sent message: "${message}"`);

    // Step 1: Detect intent
    const detectedIntent = detectIntent(message);
    console.log(`Detected intent: ${detectedIntent}`);

    // Step 2: Build internal context if needed
    let internalContext: any = {};
    let explanation = '';

    const needsInternalContext = [
      'CAMPAIGN_ANALYSIS',
      'RISK_EXPLANATION', 
      'RECOMMENDATION_REASON',
      'HYBRID'
    ].includes(detectedIntent);

    if (needsInternalContext) {
      console.log('Building internal context...');
      try {
        internalContext = await buildInternalContext({
          supabase,
          userId: user.id,
          campaignId,
          includeRecommendations: detectedIntent === 'RECOMMENDATION_REASON' || detectedIntent === 'HYBRID',
          includeRiskAnalysis: detectedIntent === 'RISK_EXPLANATION' || detectedIntent === 'HYBRID',
          includeFundingStats: detectedIntent === 'CAMPAIGN_ANALYSIS' || detectedIntent === 'HYBRID',
        });

        // Step 3: Generate explanation from internal context
        if (Object.keys(internalContext).length > 0) {
          const explanationResult = generateExplanation(internalContext);
          explanation = explanationResult.fullExplanation;
          console.log('Generated explanation from internal context');
        }
      } catch (contextError) {
        console.error('Error building internal context:', contextError);
        // Continue without internal context
      }
    }

    // Step 4: Retrieve external knowledge if needed
    let externalKnowledge: any[] = [];

    const needsExternalKnowledge = [
      'EXTERNAL_KNOWLEDGE',
      'HYBRID'
    ].includes(detectedIntent);

    if (needsExternalKnowledge) {
      console.log('Retrieving external knowledge...');
      try {
        // Load embeddings (cached after first load)
        const embeddings = await getEmbeddings();
        
        // Find relevant knowledge entries
        const relevantEntries = await findRelevantKnowledge(message, embeddings, 3);
        
        if (relevantEntries.length > 0) {
          externalKnowledge = relevantEntries;
          console.log(`Retrieved ${relevantEntries.length} relevant knowledge entries`);
        }
      } catch (embeddingError) {
        console.error('Error loading external knowledge:', embeddingError);
        // Continue without external knowledge
      }
    }

    // Step 5: Assemble prompts
    console.log('Assembling prompts...');
    const messages = buildCompletePrompt(
      message,
      detectedIntent,
      internalContext,
      explanation,
      externalKnowledge
    );

    // Step 5.5: Insert chat history for conversational context
    if (history && Array.isArray(history) && history.length > 0) {
      // Take last 5 messages for context (to avoid token limits)
      const recentHistory = history.slice(-5);
      
      // Insert history between system messages and current user message
      // System messages are at the beginning, user message is at the end
      const systemMessages = messages.filter(m => m.role === 'system');
      const userMessage = messages.find(m => m.role === 'user');
      
      // Build conversation history in correct format
      const historyMessages = recentHistory.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content || msg.message || msg.response || ''
      })).filter((msg: any) => msg.content.trim() !== '');
      
      // Reconstruct messages array: [system messages, history, current user message]
      const finalMessages = [
        ...systemMessages,
        ...historyMessages,
        userMessage
      ].filter(Boolean);
      
      console.log(`Including ${historyMessages.length} messages from chat history`);
      
      // Replace messages with history-enhanced version
      messages.length = 0;
      messages.push(...finalMessages);
    }

    console.log(`Built prompt with ${messages.length} messages`);

    // Step 6: Call LLM
    console.log('Calling LLM...');
    const assistantMessage = await callLLM(messages, {
      temperature: 0.7,
      maxTokens: 800,
    });

    // Step 7: Add disclaimer if needed
    const disclaimer = getDisclaimerText(detectedIntent);
    const finalResponse = assistantMessage + disclaimer;

    console.log(`Generated response: ${finalResponse.length} characters`);

    // Step 8: Save conversation to database
    try {
      await supabase.from('chat_messages').insert({
        user_id: user.id,
        message,
        response: finalResponse,
        intent: detectedIntent,
        metadata: {
          campaignId: campaignId || null,
          hasInternalContext: Object.keys(internalContext).length > 0,
          hasExternalKnowledge: externalKnowledge.length > 0,
        }
      });
    } catch (dbError) {
      console.error('Error saving to database:', dbError);
      // Don't fail the request if DB save fails
    }

    // Step 9: Determine sources used
    const sources: string[] = [];
    if (Object.keys(internalContext).length > 0) {
      sources.push('internal');
    }
    if (externalKnowledge.length > 0) {
      sources.push('external');
    }

    // Step 10: Return structured response per API contract
    return new Response(
      JSON.stringify({
        answer: finalResponse,
        explanation: explanation || null,
        intent: detectedIntent
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Chat AI error:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
