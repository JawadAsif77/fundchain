import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.22.0';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * Call OpenAI LLM with chat messages
 * Returns only the assistant's message content
 */
export async function callLLM(
  messages: Message[],
  options?: LLMOptions
): Promise<string> {
  try {
    // Get Gemini API key from environment
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    // Initialize Gemini client
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: options?.model || 'gemini-2.5-pro',
    });

    // Convert messages to Gemini format (combine into conversation history)
    const history = [];
    const userMessage = messages[messages.length - 1].content;
    
    // Build context from system message and previous messages
    let systemContext = '';
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === 'system') {
        systemContext += messages[i].content + '\n\n';
      } else if (messages[i].role === 'user') {
        history.push({ role: 'user', parts: [{ text: messages[i].content }] });
      } else if (messages[i].role === 'assistant') {
        history.push({ role: 'model', parts: [{ text: messages[i].content }] });
      }
    }

    console.log(`Calling Gemini with ${messages.length} messages...`);

    // Create chat session with history
    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 800,
        topP: options?.topP ?? 1,
      },
    });

    // Send message with system context prepended
    const fullPrompt = systemContext ? `${systemContext}${userMessage}` : userMessage;
    const result = await chat.sendMessage(fullPrompt);
    const response = result.response;
    const assistantMessage = response.text();

    if (!assistantMessage) {
      throw new Error('No response generated from LLM');
    }

    console.log(`LLM response received: ${assistantMessage.length} characters`);

    return assistantMessage;

  } catch (error) {
    console.error('Error calling LLM:', error);
    
    // Provide more context for common errors
    if (error.message?.includes('API key') || error.message?.includes('API_KEY')) {
      throw new Error('Gemini API authentication failed. Please check your API key.');
    }
    
    if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
      throw new Error('Gemini API rate limit exceeded. Please try again later.');
    }

    if (error.message?.includes('context length') || error.message?.includes('token')) {
      throw new Error('Message context too long. Please reduce the message length or context.');
    }

    throw new Error(`LLM call failed: ${error.message}`);
  }
}

/**
 * Call Gemini LLM with streaming response
 * Returns an async generator that yields response chunks
 */
export async function* callLLMStream(
  messages: Message[],
  options?: LLMOptions
): AsyncGenerator<string, void, unknown> {
  try {
    // Get Gemini API key from environment
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    // Initialize Gemini client
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: options?.model || 'gemini-2.0-flash-exp',
    });

    // Convert messages to Gemini format
    const history = [];
    const userMessage = messages[messages.length - 1].content;
    
    // Build context from system message and previous messages
    let systemContext = '';
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === 'system') {
        systemContext += messages[i].content + '\n\n';
      } else if (messages[i].role === 'user') {
        history.push({ role: 'user', parts: [{ text: messages[i].content }] });
      } else if (messages[i].role === 'assistant') {
        history.push({ role: 'model', parts: [{ text: messages[i].content }] });
      }
    }

    console.log(`Calling Gemini with streaming enabled...`);

    // Create chat session with history
    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 800,
        topP: options?.topP ?? 1,
      },
    });

    // Send message with streaming
    const fullPrompt = systemContext ? `${systemContext}${userMessage}` : userMessage;
    const result = await chat.sendMessageStream(fullPrompt);

    // Yield each chunk as it arrives
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        yield chunkText;
      }
    }

    console.log('LLM streaming completed');

  } catch (error) {
    console.error('Error in LLM streaming:', error);
    throw new Error(`LLM streaming failed: ${error.message}`);
  }
}

/**
 * Estimate token count for messages (rough approximation)
 */
export function estimateTokenCount(messages: Message[]): number {
  // Rough estimate: 1 token ≈ 4 characters
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  return Math.ceil(totalChars / 4);
}

/**
 * Validate messages before sending to LLM
 */
export function validateMessages(messages: Message[]): { valid: boolean; error?: string } {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { valid: false, error: 'Messages must be a non-empty array' };
  }

  // Check if first message is system message
  if (messages[0].role !== 'system') {
    console.warn('First message should typically be a system message');
  }

  // Validate each message
  for (const msg of messages) {
    if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role)) {
      return { valid: false, error: `Invalid role: ${msg.role}` };
    }

    if (!msg.content || typeof msg.content !== 'string') {
      return { valid: false, error: 'Message content must be a non-empty string' };
    }
  }

  // Check token count
  const estimatedTokens = estimateTokenCount(messages);
  if (estimatedTokens > 3000) {
    console.warn(`High token count: ~${estimatedTokens} tokens. Consider reducing message length.`);
  }

  return { valid: true };
}
