import { supabase } from '../lib/supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

function normalizeCategoryName(value) {
  return String(value || '').trim()
}

async function resolveCategoryIds(preferredCategories) {
  const raw = Array.isArray(preferredCategories) ? preferredCategories : []

  const uuids = []
  const names = []

  for (const item of raw) {
    if (isUuid(item)) {
      uuids.push(item)
      continue
    }

    const str = String(item || '')
    if (!str) continue

    if (str.startsWith('name:')) {
      const name = normalizeCategoryName(str.slice('name:'.length))
      if (name) names.push(name)
    } else {
      const name = normalizeCategoryName(str)
      if (name) names.push(name)
    }
  }

  if (names.length === 0) return { categoryIds: uuids, unresolvedNames: [] }

  // 1) Try to resolve existing categories by name
  const { data: existingRows, error: existingError } = await supabase
    .from('categories')
    .select('id, name')
    .in('name', names)

  if (existingError) {
    return { categoryIds: uuids, unresolvedNames: names }
  }

  const nameToId = new Map((existingRows || []).map((r) => [r.name, r.id]))
  const missing = names.filter((n) => !nameToId.has(n))

  // 2) Attempt to create missing categories (may fail due to permissions)
  if (missing.length > 0) {
    const { error: upsertError } = await supabase
      .from('categories')
      .upsert(missing.map((name) => ({ name })), { onConflict: 'name' })

    if (!upsertError) {
      const { data: afterRows } = await supabase
        .from('categories')
        .select('id, name')
        .in('name', missing)

      for (const row of afterRows || []) {
        nameToId.set(row.name, row.id)
      }
    }
  }

  const resolved = names.map((n) => nameToId.get(n)).filter(Boolean)
  const unresolved = names.filter((n) => !nameToId.has(n))

  return { categoryIds: [...uuids, ...resolved], unresolvedNames: unresolved }
}

async function savePreferencesFallbackToUser(userId, preferences) {
  const { preferred_categories, preferred_regions, risk_tolerance } = preferences
  const { data: userRow } = await supabase
    .from('users')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle()

  const currentPrefs =
    userRow && userRow.preferences && typeof userRow.preferences === 'object'
      ? userRow.preferences
      : {}

  const merged = {
    ...currentPrefs,
    preferred_categories,
    preferred_regions,
    risk_tolerance,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('users')
    .update({ preferences: merged, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('preferences')
    .single()

  if (error) throw error
  return {
    user_id: userId,
    preferred_categories: merged.preferred_categories,
    preferred_regions: merged.preferred_regions,
    risk_tolerance: merged.risk_tolerance,
    source: 'users.preferences',
    raw: data,
  }
}

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
    // fall back to users.preferences
    const { data: userRow } = await supabase
      .from('users')
      .select('preferences')
      .eq('id', userId)
      .maybeSingle()
    const prefs = userRow?.preferences
    if (prefs && typeof prefs === 'object') {
      return {
        user_id: userId,
        preferred_categories: prefs.preferred_categories || [],
        preferred_regions: prefs.preferred_regions || [],
        risk_tolerance: prefs.risk_tolerance || 'MEDIUM',
        source: 'users.preferences',
      }
    }
    return null
  }

  if (data) return { ...data, source: 'user_preferences' }

  // fall back to users.preferences if user_preferences row not found
  const { data: userRow } = await supabase
    .from('users')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle()
  const prefs = userRow?.preferences
  if (prefs && typeof prefs === 'object') {
    return {
      user_id: userId,
      preferred_categories: prefs.preferred_categories || [],
      preferred_regions: prefs.preferred_regions || [],
      risk_tolerance: prefs.risk_tolerance || 'MEDIUM',
      source: 'users.preferences',
    }
  }

  return null
}

/**
 * Save or update user's investment preferences
 */
export async function saveUserPreferences(userId, preferences) {
  const { preferred_categories, preferred_regions, risk_tolerance } = preferences

  const { categoryIds, unresolvedNames } = await resolveCategoryIds(preferred_categories)

  // If we can't resolve to UUIDs, fall back to saving names on the user row.
  if (categoryIds.length === 0 && Array.isArray(preferred_categories) && preferred_categories.length > 0) {
    return await savePreferencesFallbackToUser(userId, {
      preferred_categories,
      preferred_regions,
      risk_tolerance,
      unresolvedNames,
    })
  }

  // Check if preferences already exist
  const existing = await getUserPreferences(userId)

  if (existing) {
    // Update existing
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .update({
          preferred_categories: categoryIds,
          preferred_regions,
          risk_tolerance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return { ...data, source: 'user_preferences' }
    } catch (err) {
      // If user_preferences write fails (RLS/permissions), persist on user profile
      return await savePreferencesFallbackToUser(userId, {
        preferred_categories,
        preferred_regions,
        risk_tolerance,
        unresolvedNames,
      })
    }
  } else {
    // Insert new
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          preferred_categories: categoryIds,
          preferred_regions,
          risk_tolerance,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      return { ...data, source: 'user_preferences' }
    } catch (err) {
      // If user_preferences write fails (RLS/permissions), persist on user profile
      return await savePreferencesFallbackToUser(userId, {
        preferred_categories,
        preferred_regions,
        risk_tolerance,
        unresolvedNames,
      })
    }
  }
}
