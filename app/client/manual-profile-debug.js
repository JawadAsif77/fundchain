// Manual profile debugging tool
// Copy and paste this into browser console to debug profile loading

(async function debugProfile() {
  console.log('🔍 Starting profile debug...');
  
  // Get current user
  const { data: { user }, error: userError } = await window.supabase.auth.getUser();
  console.log('Current user:', { user, userError });
  
  if (!user) {
    console.log('❌ No user found. Please login first.');
    return;
  }
  
  // Try to get profile directly
  console.log('🔍 Fetching profile for user:', user.id);
  const { data: profile, error: profileError } = await window.supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
    
  console.log('Profile result:', { profile, profileError });
  
  // Check if profile exists
  if (profileError) {
    if (profileError.code === 'PGRST116') {
      console.log('❌ Profile does not exist in database');
      
      // Try to create profile using RPC function
      console.log('🔄 Attempting to create profile using RPC...');
      const { data: rpcResult, error: rpcError } = await window.supabase.rpc('create_user_profile_secure', {
        user_id: user.id,
        user_email: user.email,
        user_full_name: user.user_metadata?.full_name || 'Test User',
        user_username: user.user_metadata?.username || 'testuser',
        user_role: user.user_metadata?.role || 'investor'
      });
      
      console.log('RPC result:', { rpcResult, rpcError });
    } else {
      console.log('❌ Database error:', profileError);
    }
  } else {
    console.log('✅ Profile found:', profile);
  }
})();