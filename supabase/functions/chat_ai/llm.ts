import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.22.0';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function callLLM(messages: Message[], options?: LLMOptions): Promise<string> {
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Extract System Prompt and History
    const systemInstruction = messages.find(m => m.role === 'system')?.content || "";
    const history = messages
      .filter(m => m.role !== 'system' && m !== messages[messages.length - 1])
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      systemInstruction: systemInstruction 
    });

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 800,
      },
    });

    const userMsg = messages[messages.length - 1].content;
    const result = await chat.sendMessage(userMsg);
    return result.response.text();

  } catch (error: unknown) {
    const err = error as Error;
    console.error('LLM Error:', err);
    if (err.message?.includes('429')) throw new Error('Rate limit exceeded. Please wait a moment.');
    throw new Error(`Gemini Error: ${err.message}`);
  }
}