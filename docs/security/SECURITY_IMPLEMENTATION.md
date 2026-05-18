# FundChain — Security Implementation Guide

> **Audience:** Professor/examiner review, developer reference.  
> **Date applied:** 2026-05-18

---

## 1. What Was Insecure Before

| # | Issue | Severity |
|---|-------|----------|
| 1 | `buy-fc-tokens` Edge Function accepted `userId` from the request body and credited FC tokens to that arbitrary ID — any authenticated user could credit tokens to any account | **Critical** |
| 2 | `analyze_project` and `analyze-kyc` Edge Functions had no authentication — any anonymous request could trigger AI risk analysis | **High** |
| 3 | `walletApi.topUp()` and `walletApi.invest()` in `api.js` directly updated wallet balances from the frontend via Supabase client (bypassed all business logic) | **High** |
| 4 | No Row Level Security (RLS) on most Supabase tables — any authenticated user could query any row | **High** |
| 5 | The AI FastAPI service (`/analyze-project`) had no secret header — anyone who discovered its Render URL could call it | **High** |
| 6 | Edge Functions leaked internal error details, stack traces, SQL messages, treasury wallet addresses, and balance info in HTTP responses | **Medium** |
| 7 | `ProtectedRoute` accepted `requireRole="admin"` but never actually checked the user's role | **Medium** |
| 8 | Some `console.log` statements in `api.js` printed full data objects including user IDs and investment amounts to the browser console | **Low** |
| 9 | No audit trail for sensitive operations (investments, withdrawals, KYC approvals, risk analysis) | **Low** |

---

## 2. What Was Fixed

### Phase 1 — Frontend Logging
- Replaced remaining raw `console.log` calls in `api.js` with `safeLogger`.
- `safeLogger` (already existing in `src/utils/safeLogger.js`) strips sensitive keys (tokens, wallets, balances) and is a no-op in production.
- `main.jsx` already wrapped all `console.*` calls globally with `sanitizeLogArgs` in dev and silenced them in production — this was confirmed and preserved.

### Phase 2 — Environment Variables
- Frontend only uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Updated `.env.production.example` with clear comments listing all secrets that must **never** appear in frontend env files.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `AI_SERVICE_SECRET`, `TREASURY_PRIVATE_KEY_*`) live only in Supabase Edge Function secrets.

### Phase 3 — Row Level Security
Migration file: `supabase/migrations/20260518000001_security_rls_rbac_audit.sql`

RLS enabled and policies added for:

| Table | Policy Summary |
|-------|----------------|
| `users` | User can read/update own row; role column is protected against self-promotion; admin can read/update all |
| `wallets` | User can read own wallet only; no direct writes from frontend |
| `campaigns` | Public can read active/approved; creator can insert/update own (no status change); admin full access |
| `investments` | User sees own; creator sees investments in own campaigns; admin sees all |
| `transactions` | User sees own; admin sees all |
| `token_transactions` | User sees own; admin sees all |
| `user_verifications` (KYC) | User can read/upsert own; cannot change `verification_status`; admin/customer_support full access |
| `notifications` | User sees/updates own only |
| `fund_transactions` | User sees own; admin sees all |
| `campaign_wallets` | Creator sees own campaign's wallet; admin sees all |
| `campaign_investments` | Investor sees own; creator sees own campaign's; admin sees all |
| `milestone_votes` | Investor can insert/read own vote |
| `reports` | Reporter sees own; admin sees all and can update |
| `milestones` | Public for active campaigns; creator/admin can insert |
| `categories` | Public read; admin write |
| `audit_logs` | Admin read only; no frontend writes |

### Phase 4 — Role-Based Access Control (RBAC)

Three SQL helper functions created:
```sql
public.current_user_role()  -- returns the authenticated user's role
public.is_admin()           -- true if role = 'admin'
public.is_customer_support()-- true if role IN ('admin', 'customer_support')
```

These are `SECURITY DEFINER` functions that use `auth.uid()` — they cannot be spoofed by the frontend.

Supported roles: `creator`, `investor`, `admin`, `customer_support`.

### Phase 5 — Edge Function Security

#### `buy-fc-tokens` (Critical fix)
- **Before:** Accepted `userId` from request body — attacker could credit FC to any account.
- **After:** User ID is derived **exclusively** from the verified JWT via `auth.getUser()`. The `userId` field in the request body is completely ignored.

#### `analyze_project`
- **Before:** No authentication at all.
- **After:** Requires valid JWT + `role = 'admin'` check via the database.

#### `analyze-kyc`
- **Before:** No authentication at all. Exposed full KYC records.
- **After:** Requires valid JWT + `role IN ('admin', 'customer_support')`. KYC descriptions sent to AI are stripped of email and address fields.

#### All Edge Functions
- Error responses no longer include stack traces, SQL error messages, internal details, or treasury wallet addresses.
- `invest-in-campaign`: Added audit log entry for every successful investment.
- `withdraw-fc-to-sol`: Removed treasury wallet address and balance from error responses; added audit log.
- `update-user-role`: No longer returns the full user object — only `id` and `role`.

### Phase 6 — Wallet Protection
- Removed `walletApi.topUp()` — it directly updated `users.preferences.wallet_balance` from the frontend, bypassing all business logic.
- Removed `walletApi.invest()` — it directly inserted investments and modified wallet balance from the frontend.
- `walletApi.getBalance()` now calls the `get-wallet` Edge Function (JWT-verified) which reads from the `wallets` table.
- All wallet balance changes now happen exclusively inside Edge Functions using the service role key, which bypasses RLS for legitimate server-side writes while RLS still blocks direct frontend writes.

### Phase 7 — AI Service Security
- The FastAPI service (`server/ai_service/app/main.py`) now requires an `x-ai-service-secret` header on all `/analyze-project` and `/analyze-batch` endpoints.
- The secret is compared using `secrets.compare_digest()` (constant-time comparison to prevent timing attacks).
- CORS restricted to Supabase origins only — the browser cannot call the AI service directly.
- Edge Functions `analyze_project` and `analyze-kyc` pass the secret from `Deno.env.get('AI_SERVICE_SECRET')` — never from the frontend.

### Phase 8 — Audit Logs
New table: `audit_logs`

```sql
id            bigserial PRIMARY KEY
actor_user_id uuid (nullable — system actions)
action        text NOT NULL
target_type   text
target_id     text
metadata      jsonb
ip_address    text
user_agent    text
created_at    timestamptz DEFAULT now()
```

RLS: only `admin` can read. No frontend writes.

Actions logged:
- `BUY_FC` — when user buys FC tokens
- `INVESTMENT_CREATED` — when user invests in a campaign
- `WITHDRAWAL_COMPLETED` — when creator withdraws FC to SOL
- `RISK_ANALYSIS_TRIGGERED` — when admin triggers campaign risk analysis
- `KYC_ANALYSIS_TRIGGERED` — when admin/support triggers KYC AI analysis

### Phase 9 — Frontend Route Guards
- `ProtectedRoute` now actually enforces `requireRole` prop — previously it accepted the prop but never checked it.
- `/admin` route uses `<ProtectedRoute requireRole="admin">`.
- `AdminPanel.jsx` independently re-checks `profile?.role !== 'admin'` and redirects.
- **Important:** Frontend guards are UI convenience only. The real security is RLS + Edge Function auth checks.

---

## 3. RLS Policy Summary

All sensitive tables have RLS enabled. The key invariant:

> **A user can only see and modify their own data. Balance changes only happen server-side.**

---

## 4. Operations That Are Now Server-Side Only

| Operation | Where it happens |
|-----------|-----------------|
| FC token purchase | `buy-fc-tokens` Edge Function (verifies Solana tx or USD payment) |
| Investment | `invest-in-campaign` Edge Function (checks campaign active, balance, locks FC) |
| Withdrawal | `withdraw-fc-to-sol` Edge Function (checks balance, executes Solana tx) |
| Campaign approval/rejection | `adminApi` → direct DB (protected by RLS admin policies) |
| KYC approval/rejection | `update-kyc` Edge Function (requires admin/support role) |
| Risk analysis | `analyze_project` Edge Function (requires admin role) |
| KYC AI analysis | `analyze-kyc` Edge Function (requires admin/support role) |
| Wallet balance read | `get-wallet` Edge Function |

---

## 5. How Roles Work

Roles are stored in `users.role` column. Supported values:
- `null` — new user, must select role
- `creator` — can create campaigns, withdraw
- `investor` — can invest in campaigns
- `admin` — full access, can approve/reject campaigns/KYC, trigger analysis
- `customer_support` — can view/approve KYC, view verifications

Role assignment:
- Users self-select `creator` or `investor` via `update-user-role` Edge Function.
- `admin` and `customer_support` can only be set by another admin directly in the DB or via admin tools.
- The RLS policy on `users` prevents self-promotion: a user cannot change their own `role` column from the frontend.

---

## 6. How Wallet Updates Are Protected

```
Frontend → Edge Function (JWT verified) → Service Role DB write
                                       ↑
                            Frontend cannot directly write to wallets table
                            (RLS: no INSERT/UPDATE policies for authenticated role)
```

The `wallets` table has RLS enabled with only a `SELECT` policy for the owning user. All `INSERT` and `UPDATE` operations bypass RLS via the service role key, which is only available inside Edge Functions.

---

## 7. How AI Service Calls Are Protected

```
Browser → Supabase Edge Function (JWT + admin role check)
                   ↓
         AI Service (FastAPI on Render)
         ← requires x-ai-service-secret header
         ← secret comes from Deno.env, never the browser
```

The browser never contacts the AI service directly. The AI service rejects any request without the correct `x-ai-service-secret` header (HTTP 403). The secret is stored as a Supabase secret and a Render environment variable — never in the frontend bundle.

---

## 8. How Audit Logs Work

Sensitive Edge Functions insert a row into `audit_logs` after completing their operation:

```typescript
await supabase.from('audit_logs').insert({
  actor_user_id: user.id,  // always from verified JWT
  action: 'INVESTMENT_CREATED',
  target_type: 'campaign',
  target_id: campaignId,
  metadata: { amount_fc: amountNum, investment_id: investment.id },
});
```

Only admin can query audit logs (RLS). This provides a tamper-evident trail for the professor to review.

---

## 9. What Still Appears in the Browser Network Tab (and Why That Is Normal)

| What you see | Why it's normal |
|---|---|
| Requests to `*.supabase.co` | Standard Supabase API calls |
| The anon key in request headers | The anon key is public by design; it identifies the project, not a user. RLS enforces what the anon key can access |
| JWT (access token) in Authorization header | This is how web authentication works. The token is short-lived (1 hour) and cryptographically signed |
| Request URLs including table names | Normal REST/PostgREST API; the server enforces RLS so only authorized rows are returned |
| Response bodies with user's own data | The user is entitled to see their own data |

**What you will NOT see:**
- Service role key
- Other users' wallet balances
- Other users' KYC data
- AI service secret
- Treasury private key
- Full stack traces from server errors

---

## 10. How to Demo Security to the Professor

### Demo 1: RLS blocks cross-user data access
1. Log in as User A, note User A's wallet ID.
2. In browser console, run:
   ```js
   const { data } = await supabase.from('wallets').select('*');
   console.log(data);
   ```
3. **Expected:** Only User A's wallet row is returned (or empty if RLS is strict).

### Demo 2: Direct wallet update is blocked
1. In browser console:
   ```js
   const { error } = await supabase
     .from('wallets')
     .update({ balance_fc: 999999 })
     .eq('user_id', '<any-user-id>');
   console.log(error);
   ```
2. **Expected:** RLS policy violation error — the update is rejected.

### Demo 3: `buy-fc-tokens` cannot be abused
1. Call the Edge Function with a different userId in the body:
   ```js
   fetch('.../functions/v1/buy-fc-tokens', {
     method: 'POST',
     headers: { Authorization: 'Bearer <your-token>' },
     body: JSON.stringify({ userId: 'victim-user-id', amountFc: 1000, txSignature: 'fake', purchaseType: 'usd' })
   });
   ```
2. **Expected:** FC is credited to the **caller's** account (from JWT), not to `victim-user-id`. The `userId` in the body is ignored.

### Demo 4: Unauthorized `analyze_project` call
1. Call `analyze_project` as a non-admin user.
2. **Expected:** HTTP 403 `"Forbidden: only admins can trigger risk analysis"`.

### Demo 5: AI service rejects direct calls
1. Call the Render AI service URL directly without the secret header.
2. **Expected:** HTTP 403 `"Forbidden: invalid service secret."`.

### Demo 6: Audit logs are admin-only
1. In browser console as a regular user:
   ```js
   const { data, error } = await supabase.from('audit_logs').select('*');
   console.log(data, error);
   ```
2. **Expected:** Empty result or RLS error — the user cannot read audit logs.

---

## Environment Variables Required for Full Security

### Supabase Edge Function Secrets (set via `supabase secrets set`)
```
SUPABASE_URL              # auto-set by Supabase
SUPABASE_ANON_KEY         # auto-set by Supabase
SUPABASE_SERVICE_ROLE_KEY # auto-set by Supabase
AI_SERVICE_URL            # https://your-render-url.onrender.com
AI_SERVICE_SECRET         # strong random secret (min 32 chars)
TREASURY_PRIVATE_KEY_JSON # JSON array of treasury keypair bytes (for withdrawals)
SOLANA_NETWORK            # devnet or mainnet-beta
DEMO_MODE                 # true for FYP demo (skips on-chain Solana verification)
                          # false or unset for production (requires confirmed on-chain tx)
```

### Render AI Service Environment Variables
```
AI_SERVICE_SECRET         # same value as above
ALLOWED_ORIGINS           # comma-separated Supabase project origins
```

### Frontend `.env.local`
```
VITE_SUPABASE_URL         # safe to expose
VITE_SUPABASE_ANON_KEY    # safe to expose
```

---

## 11. Final Deployment Steps

Complete these steps in order before the project demo.

### Step 1 — Apply the SQL Migration
```bash
supabase db push
# or from the Supabase dashboard: SQL Editor → paste the migration file and run it
```
Verify in the Supabase dashboard under **Authentication → Policies** that RLS is enabled on:
`users`, `wallets`, `campaigns`, `investments`, `transactions`, `user_verifications`, `audit_logs`
and any of the optional tables that exist in your schema.

### Step 2 — Set Edge Function Secrets
```bash
supabase secrets set AI_SERVICE_SECRET=<your-secret>
supabase secrets set AI_SERVICE_URL=https://your-render-service.onrender.com
supabase secrets set TREASURY_PRIVATE_KEY_JSON='[1,2,3,...]'
supabase secrets set SOLANA_NETWORK=devnet
supabase secrets set DEMO_MODE=true        # set to false for production
```

### Step 3 — Deploy Edge Functions
```bash
supabase functions deploy buy-fc-tokens
supabase functions deploy invest-in-campaign
supabase functions deploy withdraw-fc-to-sol
supabase functions deploy analyze_project
supabase functions deploy analyze-kyc
supabase functions deploy release-milestone-funds
supabase functions deploy get-wallet
supabase functions deploy get-transactions
supabase functions deploy get-user-investments
supabase functions deploy update-user-role
```

### Step 4 — Deploy AI Service (Render)
Set environment variables in the Render dashboard:
- `AI_SERVICE_SECRET` — same value used in Step 2
- `ALLOWED_ORIGINS` — your Supabase project URL (e.g. `https://xyz.supabase.co`)

Redeploy the Render service after setting variables.

### Step 5 — Build and Deploy Frontend
```bash
cd app/client
npm run build
# Deploy the dist/ folder to your hosting provider
```
Ensure `.env.production` contains only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Step 6 — Smoke Test
1. Register a new user, select `investor` role — confirm profile created.
2. Buy FC tokens (demo mode) — confirm wallet balance increases.
3. Browse campaigns — confirm only active/approved campaigns visible.
4. Log in as admin — confirm `/admin` route accessible; confirm non-admin is redirected.
5. Admin triggers risk analysis on a campaign — confirm HTTP 200 and score returned.
6. Check `audit_logs` as admin — confirm entries recorded for BUY_FC.

---

## 12. Eight Demo Tests for the Professor

### Test 1: RLS blocks cross-user wallet access
```js
// In browser console, logged in as any user
const { data } = await supabase.from('wallets').select('*');
console.log(data.length); // Expected: 1 (only own wallet)
```

### Test 2: Direct wallet update is blocked
```js
const { error } = await supabase
  .from('wallets')
  .update({ balance_fc: 999999 })
  .eq('user_id', '<any-user-id>');
console.log(error.code); // Expected: 'PGRST301' or 'insufficient_privilege'
```

### Test 3: buy-fc-tokens ignores userId in body
```js
// Pass a victim's userId — FC should go to YOUR account, not theirs
const resp = await fetch('<SUPABASE_URL>/functions/v1/buy-fc-tokens', {
  method: 'POST',
  headers: { Authorization: 'Bearer <your-jwt>', 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: '<victim-id>', amountFc: 100, txSignature: 'demo-test-sig-001', purchaseType: 'usd' })
});
const json = await resp.json();
// Expected: json.status === 'success' and FC credited to YOUR wallet, not victim's
```

### Test 4: Duplicate txSignature rejected
```js
// Use the same txSignature twice
const body = JSON.stringify({ amountFc: 50, txSignature: 'demo-sig-reuse-test', purchaseType: 'usd' });
const headers = { Authorization: 'Bearer <your-jwt>', 'Content-Type': 'application/json' };
const r1 = await fetch('.../buy-fc-tokens', { method: 'POST', headers, body });
const r2 = await fetch('.../buy-fc-tokens', { method: 'POST', headers, body });
console.log(await r1.json()); // Expected: success
console.log(await r2.json()); // Expected: { error: 'Transaction signature has already been used' }
```

### Test 5: Non-admin cannot trigger risk analysis
```js
// Logged in as investor or creator
const resp = await fetch('<SUPABASE_URL>/functions/v1/analyze_project', {
  method: 'POST',
  headers: { Authorization: 'Bearer <non-admin-jwt>', 'Content-Type': 'application/json' },
  body: JSON.stringify({ campaignId: '<any-id>' })
});
console.log(resp.status); // Expected: 403
```

### Test 6: AI service rejects calls without secret header
```js
// Call Render URL directly without the x-ai-service-secret header
const resp = await fetch('https://your-render-service.onrender.com/analyze-project', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ description: 'test', wallet_age_days: 10, past_investments: 0 })
});
console.log(resp.status); // Expected: 403
```

### Test 7: Admin cannot read audit logs as regular user
```js
// In browser console as investor or creator
const { data, error } = await supabase.from('audit_logs').select('*');
console.log(data, error);
// Expected: data = [] (empty — RLS blocks it) or error with permission denied
```

### Test 8: Role self-promotion blocked
```js
// Logged in as investor, attempt to promote self to admin
const { error } = await supabase
  .from('users')
  .update({ role: 'admin' })
  .eq('id', '<your-own-user-id>');
console.log(error); // Expected: RLS WITH CHECK violation — update rejected
```
