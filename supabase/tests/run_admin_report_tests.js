/*
  Run end-to-end moderation tests for admin report flows.

  Requires these environment variables:
    SUPABASE_URL
    SUPABASE_ANON_KEY
    SUPABASE_SERVICE_ROLE_KEY
    ADMIN_EMAIL
    ADMIN_PASSWORD

  Optional (if not provided script will create test reporter):
    REPORTER_EMAIL
    REPORTER_PASSWORD

  Usage:
    npm install @supabase/supabase-js dotenv
    SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node supabase/tests/run_admin_report_tests.js

*/
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const WebSocket = require('ws')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in env')
  process.exit(1)
}

const adminEmail = process.env.ADMIN_EMAIL
const adminPassword = process.env.ADMIN_PASSWORD

if (!adminEmail || !adminPassword) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in env (an admin user)')
  process.exit(1)
}

const reporterEmail = process.env.REPORTER_EMAIL || `test_reporter_${Date.now()}@example.com`
const reporterPassword = process.env.REPORTER_PASSWORD || 'TestPass123!'
const creatorEmail = process.env.CREATOR_EMAIL || `test_creator_${Date.now()}@example.com`
const creatorPassword = process.env.CREATOR_PASSWORD || 'TestPass123!'

const clientOptions = {
  realtime: {
    transport: WebSocket,
  },
}

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, clientOptions)
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientOptions)

async function createOrGetUser(email, password, makeAdmin = false) {
  // Try to find in auth users (best-effort)
  try {
    const { data: listUsers } = await service.auth.admin.listUsers()
    const found = listUsers.users.find(u => u.email === email)
    if (found) {
      // Upsert profile row
      await service.from('users').upsert({ id: found.id, email }, { onConflict: 'id' })
      if (makeAdmin) await service.from('users').update({ role: 'admin' }).eq('id', found.id)
      return { id: found.id, email }
    }
  } catch (e) {
    // ignore
  }

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    console.error('createUser warning:', error.message || error)
  }

  const userId = data?.user?.id
  if (!userId) {
    // fallback: sign in and fetch the auth user id, then upsert the profile row
    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({ email, password })
    if (signInError || !signInData?.session?.access_token) {
      const { data: userRow } = await service.from('users').select('id').eq('email', email).maybeSingle()
      if (userRow && userRow.id) return { id: userRow.id, email }
      throw new Error('Failed to create or find user: ' + email)
    }

    const { data: authUserData, error: authUserError } = await anon.auth.getUser(signInData.session.access_token)
    if (authUserError || !authUserData?.user?.id) {
      throw new Error('Failed to resolve auth user id for: ' + email)
    }

    const resolvedId = authUserData.user.id
    await service.from('users').upsert({ id: resolvedId, email }, { onConflict: 'id' })
    if (makeAdmin) await service.from('users').update({ role: 'admin' }).eq('id', resolvedId)
    return { id: resolvedId, email }
  }

  await service.from('users').upsert({ id: userId, email }, { onConflict: 'id' })
  if (makeAdmin) await service.from('users').update({ role: 'admin' }).eq('id', userId)
  return { id: userId, email }
}

async function signIn(email, password) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session.access_token
}

async function run() {
  console.log('Preparing users...')
  const admin = await createOrGetUser(adminEmail, adminPassword, true)
  console.log('Admin id:', admin.id)

  const reporter = await createOrGetUser(reporterEmail, reporterPassword, false)
  console.log('Reporter id:', reporter.id)

  const creator = await createOrGetUser(creatorEmail, creatorPassword, false)
  console.log('Creator id:', creator.id)

  const resetAt = new Date().toISOString()
  await service.from('user_reputation').upsert({
    user_id: reporter.id,
    reputation: 0,
    reports_submitted_today: 0,
    last_report_reset_at: resetAt,
    updated_at: resetAt,
  }, { onConflict: 'user_id' })
  await service.from('user_reputation').upsert({
    user_id: creator.id,
    reputation: 0,
    reports_submitted_today: 0,
    last_report_reset_at: resetAt,
    updated_at: resetAt,
  }, { onConflict: 'user_id' })

  async function createCampaign(label) {
    const suffix = `${Date.now()}-${label}`
    const response = await service.from('campaigns').insert({
      creator_id: creator.id,
      title: `E2E Test Campaign ${label} ${Date.now()}`,
      slug: `e2e-test-${suffix}`,
      description: 'Temporary campaign for tests',
      funding_goal: 1000,
      status: 'active'
    }).select('*').single()

    if (response.error) throw response.error
    return response.data
  }

  const campaign = await createCampaign('warn')
  console.log('Created campaign:', campaign.id)

  // Sign in reporter and create a report via edge function
  const reporterToken = await signIn(reporter.email, reporterPassword)
  console.log('Reporter signed in')

  const createReportResp = await fetch(`${SUPABASE_URL}/functions/v1/reports`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${reporterToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaign_id: campaign.id, category: 'OTHER', description: 'E2E test report' })
  })
  const createReportJson = await createReportResp.json()
  if (!createReportResp.ok) throw new Error('Failed creating report: ' + JSON.stringify(createReportJson))
  const reportId = createReportJson.report_id
  console.log('Report created:', reportId)

  const adminToken = await signIn(admin.email, adminPassword)
  console.log('Admin signed in')

  async function adminAction(actionType) {
    console.log('-> Admin action', actionType)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-reports/${reportId}/action`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_type: actionType, notes: 'Automated test: ' + actionType })
    })
    const json = await res.json()
    if (!res.ok) throw new Error('Admin action failed: ' + JSON.stringify(json))
    console.log('Action response:', json)
    return json
  }

  async function createFreshReport(label, campaignId) {
    const now = new Date().toISOString()
    await service.from('user_reputation').upsert({
      user_id: reporter.id,
      reputation: 0,
      reports_submitted_today: 0,
      last_report_reset_at: now,
      updated_at: now,
    }, { onConflict: 'user_id' })

    const response = await fetch(`${SUPABASE_URL}/functions/v1/reports`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${reporterToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId, category: 'OTHER', description: `E2E ${label}` })
    })
    const json = await response.json()
    if (!response.ok) throw new Error(`Failed creating ${label} report: ` + JSON.stringify(json))
    return json.report_id
  }

  // WARN
  await adminAction('WARNED_CREATOR')
  const { data: notify } = await service.from('notifications').select('*').eq('user_id', creator.id).order('created_at', { ascending: false }).limit(1)
  console.log('Latest notification for creator:', notify && notify[0])

  // SUSPEND
  const suspendCampaign = await createCampaign('suspend')
  const suspendReportId = await createFreshReport('suspend', suspendCampaign.id)
  const suspendResp = await fetch(`${SUPABASE_URL}/functions/v1/admin-reports/${suspendReportId}/action`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_type: 'SUSPENDED_USER', notes: 'suspend test' })
  })
  console.log('Suspend response:', await suspendResp.json())
  const { data: userRow } = await service.from('users').select('is_suspended').eq('id', creator.id).maybeSingle()
  console.log('creator is_suspended:', userRow?.is_suspended)

  // ESCALATE (create fresh report to avoid resolved status)
  const escalateCampaign = await createCampaign('escalate')
  const reportId2 = await createFreshReport('escalate', escalateCampaign.id)
  console.log('Report for escalate:', reportId2)

  const resEsc = await fetch(`${SUPABASE_URL}/functions/v1/admin-reports/${reportId2}/action`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_type: 'ESCALATED', notes: 'escalate test' })
  })
  console.log('Escalate response:', await resEsc.json())
  const { data: reportRow } = await service.from('reports').select('status').eq('id', reportId2).maybeSingle()
  const { data: campRow } = await service.from('campaigns').select('status').eq('id', escalateCampaign.id).maybeSingle()
  console.log('report status:', reportRow?.status, 'campaign status:', campRow?.status)

  // DELIST
  const delistCampaign = await createCampaign('delist')
  const reportId3 = await createFreshReport('delist', delistCampaign.id)
  console.log('Report for delist:', reportId3)

  await fetch(`${SUPABASE_URL}/functions/v1/admin-reports/${reportId3}/action`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_type: 'DELISTED_PROJECT', notes: 'delist test' })
  })
  const { data: campaignFlag } = await service.from('campaigns').select('is_flagged, flag_reason').eq('id', delistCampaign.id).maybeSingle()
  console.log('campaign flagged:', campaignFlag)

  // DISMISS
  const dismissCampaign = await createCampaign('dismiss')
  const reportId4 = await createFreshReport('dismiss', dismissCampaign.id)
  console.log('Report for dismiss:', reportId4)

  const { data: repBefore } = await service.from('user_reputation').select('reputation').eq('user_id', reporter.id).maybeSingle()
  console.log('Reporter reputation before dismiss:', repBefore?.reputation)

  await fetch(`${SUPABASE_URL}/functions/v1/admin-reports/${reportId4}/action`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_type: 'DISMISSED', notes: 'dismiss test' })
  })

  const { data: repAfter } = await service.from('user_reputation').select('reputation').eq('user_id', reporter.id).maybeSingle()
  console.log('Reporter reputation after dismiss:', repAfter?.reputation)

  console.log('E2E moderation tests completed.')
}

run().catch(err => {
  console.error('Test run failed:', err)
  process.exit(1)
})
