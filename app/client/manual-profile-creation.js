// Manual profile creation helper for debugging
// Copy this to browser console after registration fails

const createProfileManually = async (userId, email, username, fullName, role = 'investor') => {
  console.log('Manual profile creation started...');
  
  try {
    // Method 1: Try RPC function
    console.log('Trying RPC function...');
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('create_user_profile', {
        user_id: userId,
        user_email: email,
        user_username: username,
        user_full_name: fullName,
        user_role: role,
        user_verified: 'no'
      });

    if (!rpcError && !rpcData?.error) {
      console.log('✅ Profile created via RPC:', rpcData);
      return { success: true, method: 'rpc', data: rpcData };
    }

    console.log('RPC failed, trying direct insert...', { rpcError, rpcData });

    // Method 2: Try direct insert
    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email,
        username: username,
        full_name: fullName,
        role: role,
        is_verified: 'no'
      })
      .select();

    if (!insertError) {
      console.log('✅ Profile created via direct insert:', insertData);
      return { success: true, method: 'insert', data: insertData };
    }

    console.log('Direct insert failed, trying upsert...', insertError);

    // Method 3: Try upsert
    const { data: upsertData, error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: email,
        username: username,
        full_name: fullName,
        role: role,
        is_verified: 'no'
      })
      .select();

    if (!upsertError) {
      console.log('✅ Profile created via upsert:', upsertData);
      return { success: true, method: 'upsert', data: upsertData };
    }

    console.error('❌ All methods failed:', { rpcError, insertError, upsertError });
    return { success: false, errors: { rpcError, insertError, upsertError } };

  } catch (error) {
    console.error('❌ Manual profile creation failed:', error);
    return { success: false, error: error.message };
  }
};

// Usage after failed registration:
// 1. Get the user ID from the auth.users table or console logs
// 2. Run: createProfileManually('user-id-here', 'email@example.com', 'username', 'Full Name', 'investor')

console.log('Manual profile creation helper loaded. Use createProfileManually() function.');