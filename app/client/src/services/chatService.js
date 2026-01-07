import { supabase } from '../lib/supabase.js';

/**
 * Send a message to the AI chatbot
 * 
 * @param {Array} messages - Array of message objects with role and content
 * @param {string|null} campaignId - Optional campaign ID for context
 * @returns {Promise<Object>} Response object with answer, explanation, and intent
 * @throws {Error} If the request fails or user is not authenticated
 */
export async function sendChatMessage(messages, campaignId = null) {
  try {
    console.log('💬 Sending chat messages:', { messageCount: messages.length, campaignId });

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('You must be logged in to use the chatbot');
    }

    // Prepare request body with messages array
    const requestBody = {
      messages,  // Send full conversation history
    };

    // Add campaign context if provided
    if (campaignId) {
      requestBody.campaignId = campaignId;
    }

    // Call the chat_ai Edge Function
    const functionUrl = `${supabase.supabaseUrl}/functions/v1/chat_ai`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': supabase.supabaseKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Chat request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('✅ Chat response received:', {
      intent: data.intent,
      answerLength: data.answer?.length || 0,
      hasExplanation: !!data.explanation,
    });

    return {
      answer: data.answer || '',
      explanation: data.explanation || null,
      intent: data.intent || 'UNKNOWN',
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    console.error('❌ Chat service error:', error);
    throw error;
  }
}

/**
 * Fetch chat history from database
 * 
 * @param {number} limit - Maximum number of messages to fetch (default: 20)
 * @returns {Promise<Array>} Array of chat messages
 */
export async function fetchChatHistory(limit = 20) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Convert to chat history format
    const history = [];
    data.reverse().forEach(msg => {
      history.push({ role: 'user', content: msg.message });
      history.push({ role: 'assistant', content: msg.response });
    });

    return history;

  } catch (error) {
    console.error('❌ Error fetching chat history:', error);
    return [];
  }
}

/**
 * Clear chat history from localStorage
 * 
 * @param {string} userId - User ID for localStorage key
 */
export function clearLocalChatHistory(userId) {
  try {
    localStorage.removeItem(`fundchain-chat-history-${userId}`);
    console.log('✅ Local chat history cleared');
  } catch (error) {
    console.error('❌ Error clearing local history:', error);
  }
}

/**
 * Save chat history to localStorage
 * 
 * @param {string} userId - User ID for localStorage key
 * @param {Array} messages - Array of messages to save
 */
export function saveLocalChatHistory(userId, messages) {
  try {
    localStorage.setItem(
      `fundchain-chat-history-${userId}`,
      JSON.stringify(messages)
    );
  } catch (error) {
    console.error('❌ Error saving local history:', error);
  }
}

/**
 * Load chat history from localStorage
 * 
 * @param {string} userId - User ID for localStorage key
 * @returns {Array} Array of messages or empty array
 */
export function loadLocalChatHistory(userId) {
  try {
    const stored = localStorage.getItem(`fundchain-chat-history-${userId}`);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('❌ Error loading local history:', error);
    return [];
  }
}
