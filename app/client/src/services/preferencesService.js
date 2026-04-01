import { supabase } from '../lib/supabase'

/**
 * Fetch user's investment preferences
 */
export async function getUserPreferences(userId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching preferences:', error)
    return null
  }

  return data
}

/**
 * Save or update user's investment preferences
 */
export async function saveUserPreferences(userId, preferences) {
  const { preferred_categories, preferred_regions, risk_tolerance } = preferences

  // Check if preferences already exist
  const existing = await getUserPreferences(userId)

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('user_preferences')
      .update({
        preferred_categories,
        preferred_regions,
        risk_tolerance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('user_preferences')
      .insert({
        user_id: userId,
        preferred_categories,
        preferred_regions,
        risk_tolerance,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}
