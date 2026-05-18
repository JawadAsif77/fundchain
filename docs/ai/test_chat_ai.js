// Test script for chat_ai function
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testChatAI() {
  try {
    console.log('🔍 Testing chat_ai function...\n');
    
    // First check if we need to authenticate
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('❌ No active session. You need to be logged in.');
      console.log('Please log in through the app first.\n');
      return;
    }
    
    console.log('✅ Session found\n');
    
    // Test message
    const testMessage = "Who are you?";
    console.log(`📤 Sending message: "${testMessage}"\n`);
    
    // Call the edge function
    const { data, error } = await supabase.functions.invoke('chat_ai', {
      body: { message: testMessage }
    });
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('✅ Response received:\n');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n🎉 Chat AI is working!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testChatAI();
