# 📚 Supabase Edge Functions Reference

This document provides an overview of all Supabase Edge Functions used in the FundChain platform.

---

## 🔧 Function List

### 1. **buy-fc-tokens**
**Path:** `functions/buy-fc-tokens/index.ts`

**Purpose:** Credit FC tokens to user wallet after SOL payment

**HTTP Method:** `POST`

**Request Body:**
```typescript
{
  userId: string;        // User ID from auth
  amountSol: number;     // Amount of SOL sent
  txSignature: string;   // Solana transaction signature
}
```

**Response:**
```typescript
{
  success: boolean;
  newBalance: number;
  amountFc: number;
  txSignature: string;
}
```

**Logic:**
1. Validates userId, amountSol, txSignature
2. Calculates FC amount (1 SOL = 100 FC)
3. Gets or creates user wallet
4. Updates wallet balance
5. Records transaction in transactions table
6. Returns new balance and transaction details

**Used By:** Wallet page, SOL → FC swap functionality

---

### 2. **buy-fc-with-sol**
**Path:** `functions/buy-fc-with-sol/index.ts`

**Purpose:** Process SOL payment and mint FC tokens (unified funding flow)

**HTTP Method:** `POST`

**Request Body:**
```typescript
{
  userId: string;
  amountUsd: number;
  amountSol: number;
  txSignature: string;
  userWalletAddress?: string;
  fcAmount?: number;
}
```

**Response:**
```typescript
{
  success: boolean;
  newBalance: number;
  txSignature: string;
}
```

**Logic:**
1. Validates request parameters
2. Converts USD to FC tokens
3. Updates user wallet balance
4. Creates transaction record with SOL details
5. Returns confirmation

**Used By:** AddFundsPhantomModal component

---

### 3. **create-user-wallet**
**Path:** `functions/create-user-wallet/index.ts`

**Purpose:** Create wallet for new users automatically

**HTTP Method:** `POST`

**Request Body:**
```typescript
{
  userId: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  wallet: {
    user_id: string;
    balance_fc: number;
    locked_fc: number;
    created_at: string;
  }
}
```

**Logic:**
1. Checks if wallet exists for user
2. If not, creates new wallet with 0 balance
3. Returns wallet data

**Used By:** User registration flow, automatic wallet creation trigger

---

### 4. **credit-fc**
**Path:** `functions/credit-fc/index.ts`

**Purpose:** Credit FC tokens to user wallet (admin/system operation)

**HTTP Method:** `POST`

**Request Body:**
```typescript
{
  userId: string;
  amount: number;
  reason?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  newBalance: number;
}
```

**Logic:**
1. Validates userId and amount
2. Updates wallet balance
3. Records transaction with reason
4. Returns new balance

**Used By:** Admin operations, promotional credits, refunds

---

### 5. **exchange-usd-to-fc**
**Path:** `functions/exchange-usd-to-fc/index.ts`

**Purpose:** Calculate FC amount for given USD amount (preview calculation)

**HTTP Method:** `POST`

**Request Body:**
```typescript
{
  amountUsd: number;
}
```

**Response:**
```typescript
{
  status: string;
  fc: number;
  rate: number;
}
```

**Logic:**
1. Takes USD amount
2. Applies conversion rate (1 USD = 1 FC)
3. Returns calculated FC amount

**Used By:** Wallet page, investment preview calculations

---

### 6. **get-transactions**
**Path:** `functions/get-transactions/index.ts`

**Purpose:** Retrieve transaction history for a user

**HTTP Method:** `GET` / `POST`

**Request Body/Query:**
```typescript
{
  userId: string;
  limit?: number;
  offset?: number;
}
```

**Response:**
```typescript
{
  status: string;
  transactions: Array<{
    id: string;
    user_id: string;
    type: string;
    amount_fc: number;
    metadata: object;
    created_at: string;
  }>;
}
```

**Logic:**
1. Fetches transactions for user
2. Orders by created_at descending
3. Applies pagination if provided
4. Returns transaction list

**Used By:** Wallet page transaction history, Portfolio page

---

### 7. **get-user-investments**
**Path:** `functions/get-user-investments/index.ts`

**Purpose:** Retrieve all investments made by a user

**HTTP Method:** `GET` / `POST`

**Request Body/Query:**
```typescript
{
  userId: string;
}
```

**Response:**
```typescript
{
  status: string;
  investments: Array<{
    id: string;
    campaign_id: string;
    investor_id: string;
    amount: number;
    status: string;
    invested_at: string;
    campaign?: object;
  }>;
}
```

**Logic:**
1. Fetches investments from investments table
2. Joins with campaigns table for details
3. Returns complete investment data

**Used By:** Portfolio page, Dashboard, Analytics

---

### 8. **get-wallet**
**Path:** `functions/get-wallet/index.ts`

**Purpose:** Retrieve wallet information for a user

**HTTP Method:** `GET` / `POST`

**Request Body/Query:**
```typescript
{
  userId: string;
}
```

**Response:**
```typescript
{
  status: string;
  wallet: {
    user_id: string;
    balance_fc: number;
    locked_fc: number;
    created_at: string;
    updated_at: string;
  }
}
```

**Logic:**
1. Fetches wallet data for user
2. Returns balance and locked amounts
3. Creates wallet if doesn't exist

**Used By:** Header balance display, Wallet page, Auth context

---

### 9. **invest-in-campaign**
**Path:** `functions/invest-in-campaign/index.ts`

**Purpose:** Process investment in a campaign

**HTTP Method:** `POST`

**Request Body:**
```typescript
{
  userId: string;
  campaignId: string;
  amount: number;
}
```

**Response:**
```typescript
{
  success: boolean;
  investment: {
    id: string;
    campaign_id: string;
    investor_id: string;
    amount: number;
    status: string;
  };
  newBalance: number;
}
```

**Logic:**
1. Validates user wallet has sufficient balance
2. Locks FC amount in wallet
3. Creates investment record
4. Updates campaign raised amount
5. Creates transaction record
6. Updates campaign_investments and campaign_investors tables
7. Returns investment details

**Used By:** Campaign page investment box, investment flow

---

## 🔑 Environment Variables Required

All functions use these common environment variables:

```bash
SUPABASE_URL                 # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY    # Service role key for admin operations
```

---

## 📊 Database Tables Used

### Primary Tables:
- `wallets` - User FC token balances
- `transactions` - All financial transactions
- `investments` - Campaign investments
- `campaigns` - Fundraising campaigns
- `campaign_investments` - Investment aggregation
- `campaign_investors` - Investor tracking
- `fund_transactions` - SOL payment records

---

## 🔐 Security Notes

1. **Service Role Key:** All functions use service role key to bypass RLS for controlled operations
2. **Validation:** Each function validates input parameters
3. **CORS:** All functions include CORS headers for web access
4. **Transaction Safety:** Use atomic operations where possible
5. **Error Handling:** Comprehensive error logging and user-friendly messages

---

## 🚀 Deployment

Functions are automatically deployed to Supabase when pushed to the repository.

**Manual deployment:**
```bash
supabase functions deploy [function-name]
```

**Deploy all functions:**
```bash
supabase functions deploy
```

---

## 📝 Testing

---

### 10. **release-milestone-funds**
**Path:** `functions/release-milestone-funds/index.ts`

**Purpose:** Admin releases FC from campaign escrow to campaign creator when milestone is approved

**HTTP Method:** `POST`

**Request Body:**
```typescript
{
  adminId: string;        // Admin user ID
  campaignId: string;     // Campaign ID
  milestoneId: string;    // Milestone to mark complete
  amountFc: number;       // FC amount to release
  notes?: string;         // Optional release notes
}
```

**Response:**
```typescript
{
  success: boolean;
  campaignWallet: {
    escrow_balance_fc: number;
    released_fc: number;
  };
  creatorWallet: {
    balance_fc: number;
    locked_fc: number;
  };
  milestone: {
    id: string;
    is_completed: boolean;
    completion_date: string;
  };
}
```

**Logic:**
1. Validates admin role (user.role = 'admin')
2. Verifies campaign exists and is not 'failed' or 'cancelled'
3. Verifies milestone belongs to campaign
4. Checks campaign_wallets has sufficient escrow_balance_fc
5. Gets or creates creator wallet
6. Updates campaign_wallets (decrease escrow, increase released)
7. Updates platform_wallet (decrease locked_fc)
8. Updates creator wallet (increase balance_fc)
9. Updates milestone (is_completed = true, completion_date)
10. Records token_transactions and transactions
11. Returns updated wallet and milestone data

**Used By:** Admin panel, milestone management

---

### 11. **refund-campaign-investors**
**Path:** `functions/refund-campaign-investors/index.ts`

**Purpose:** Admin triggers bulk refund of all confirmed investments when campaign fails

**HTTP Method:** `POST`

**Request Body:**
```typescript
{
  adminId: string;        // Admin user ID
  campaignId: string;     // Campaign ID to refund
  reason?: string;        // Optional refund reason
}
```

**Response:**
```typescript
{
  success: boolean;
  refundedCount: number;  // Number of investments refunded
  totalRefund: number;    // Total FC refunded
  message?: string;       // Status message
}
```

**Logic:**
1. Validates admin role (user.role = 'admin')
2. Verifies campaign exists and is not already 'failed' or 'cancelled'
3. Fetches all confirmed investments for campaign
4. Calculates total refund amount
5. Verifies campaign_wallets has sufficient escrow_balance_fc
6. For each investment:
   - Updates investor wallet (decrease locked_fc, increase balance_fc)
   - Updates investment (status = 'refunded', refund details)
   - Records token_transactions and transactions
7. Updates campaign_wallets (decrease escrow_balance_fc)
8. Updates platform_wallet (decrease locked_fc)
9. Updates campaign (status = 'failed')
10. Returns refund summary

**Used By:** Admin panel, campaign failure handling

---

## 🛠️ Local Development

**Local testing with Supabase CLI:**
```bash
supabase functions serve [function-name]
```

**Invoke locally:**
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/[function-name]' \
  --header 'Authorization: Bearer [ANON_KEY]' \
  --header 'Content-Type: application/json' \
  --data '{"key":"value"}'
```

---

## 🔄 Recent Updates

### December 2024 - Escrow & Milestone Management
- Added `release-milestone-funds` function for admin milestone approvals
- Added `refund-campaign-investors` function for bulk campaign refunds
- Enhanced escrow balance tracking across platform, campaign, and user wallets

### December 2024 - Solana Integration
- Added `buy-fc-tokens` function for SOL → FC conversion
- Updated `buy-fc-with-sol` for unified funding flow
- Enhanced transaction recording with blockchain signatures
- Added support for devnet testing

---

## 📞 Support

For function-related issues, check:
- Supabase Dashboard → Edge Functions → Logs
- Function-specific error messages in responses
- Database trigger logs for transaction issues

---

*Last Updated: December 11, 2025*
