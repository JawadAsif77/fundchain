# FundChain — Secure Business Investment Platform

FundChain is a Final Year Project: a full-stack crowdfunding and investment platform connecting entrepreneurs with investors through secure, milestone-based funding backed by Supabase, Solana, and an AI/ML risk analysis layer.

**Live:** [fundchain.vercel.app](https://fundchain.vercel.app) &nbsp;|&nbsp; **Repo:** [github.com/JawadAsif77/fundchain](https://github.com/JawadAsif77/fundchain)

---

## Features

### Investor
- Browse and invest in KYC-verified campaigns using FC tokens or SOL
- Portfolio dashboard with investment history and milestone tracking
- Personalised campaign recommendations (collaborative + content-based)
- AI-powered RAG chatbot for platform guidance

### Creator
- Launch milestone-based fundraising campaigns
- KYC identity verification (document upload + AI analysis)
- Receive milestone fund releases approved by admin
- Withdraw FC tokens to SOL via Phantom wallet

### Admin / Customer Support
- Campaign approval, risk analysis (ML scam score + plagiarism + wallet risk)
- KYC approval workflow with AI-assisted analysis
- Audit log of all sensitive operations
- Role-based admin panel

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, Framer Motion, React Router |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| Serverless | Supabase Edge Functions (Deno/TypeScript) |
| AI/ML service | FastAPI on Render — scam detection, plagiarism, wallet risk |
| AI features | OpenRouter API — RAG chatbot, recommendations, KYC analysis |
| Blockchain | Solana devnet, Phantom wallet, @solana/web3.js |
| Deployment | Vercel (frontend), Supabase Cloud (backend), Render (AI service) |

---

## AI / ML Modules

### Risk Analysis (FastAPI — `server/ai_service/`)
- **ML scam detection** — trained classifier on project descriptions
- **Plagiarism scoring** — SequenceMatcher across existing campaigns
- **Wallet risk** — age + history heuristics
- **Composite score** — weighted combination (60% ML · 25% plagiarism · 15% wallet)
- Protected by `x-ai-service-secret` header; only callable from Edge Functions

### RAG Chatbot
- Document embeddings stored in `doc_embeddings` (pgvector)
- Semantic search via Supabase RPC + OpenRouter LLM response
- Answers FundChain-specific questions using in-platform knowledge base

### Recommendation System
- Hybrid collaborative + content-based filtering
- Tracks `recommendation_events` for user interaction signals
- Served via `recommendations` Edge Function

---

## Security Hardening

Full detail: [`docs/security/SECURITY_IMPLEMENTATION.md`](docs/security/SECURITY_IMPLEMENTATION.md)

| Layer | What is enforced |
|---|---|
| **RLS** | Row-Level Security on every sensitive table; no cross-user data leaks |
| **RBAC** | `SECURITY DEFINER` SQL helpers (`is_admin()`, `is_customer_support()`, `current_user_role()`) |
| **Edge Functions** | JWT-verified; user ID always derived from token, never from request body |
| **Wallet protection** | No direct balance writes from frontend; all changes via service-role Edge Functions |
| **AI service** | `x-ai-service-secret` shared secret (constant-time compare); CORS restricted to Supabase |
| **Audit logs** | `audit_logs` table records BUY_FC, INVESTMENT_CREATED, WITHDRAWAL, RISK_ANALYSIS, KYC_ANALYSIS |
| **Frontend guards** | `ProtectedRoute` enforces `requireRole`; admin panel re-checks role independently |
| **DEMO_MODE** | `buy-fc-tokens` supports simulated Solana tx for FYP demo; duplicate signature replay prevented in both modes |

---

## Project Structure

```
fundchain/
├── app/client/          # React/Vite frontend
│   └── src/
│       ├── components/  # UI components
│       ├── pages/       # Route pages
│       ├── services/    # API service layer
│       ├── store/       # Auth context
│       ├── hooks/       # Custom hooks (escrow, etc.)
│       └── lib/         # Supabase client, constants
├── server/
│   └── ai_service/      # FastAPI ML service (Render)
├── supabase/
│   ├── functions/       # Edge Functions (Deno)
│   └── migrations/      # SQL migrations (apply in order)
├── blockchain/          # Solana program / scripts
├── scripts/             # Utility scripts
└── docs/
    ├── security/        # Security implementation guide
    ├── setup/           # Auth and quick-start guides
    ├── ai/              # RAG and ML documentation
    ├── solana/          # Solana integration docs
    ├── kyc/             # KYC flow documentation
    ├── campaigns/       # Campaign feature docs
    ├── schema/          # SQL snippets and schema references
    ├── reports/         # Project reports and scope document
    └── archive/         # Older notes
```

---

## Getting Started (Development)

### Prerequisites
- Node.js 18+, npm
- Supabase project with Edge Functions enabled
- Render account for AI service deployment
- Phantom wallet browser extension (for Solana demo)

### Frontend
```bash
cd app/client
cp .env.example .env.local   # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev                  # http://localhost:5173
```

### AI Service
```bash
cd server/ai_service
pip install -r requirements.txt
AI_SERVICE_SECRET=<secret> uvicorn app.main:app --port 8001
```

### Edge Functions (Supabase CLI)
```bash
supabase functions deploy buy-fc-tokens
supabase secrets set DEMO_MODE=true AI_SERVICE_SECRET=<secret> ...
```

### Database Migration
Apply `supabase/migrations/20260518000001_security_rls_rbac_audit.sql` in the Supabase SQL Editor.  
See [`docs/security/SECURITY_IMPLEMENTATION.md`](docs/security/SECURITY_IMPLEMENTATION.md) → Section 11 for full deployment steps.

---

## Roles

| Role | Key capabilities |
|---|---|
| `investor` | Browse campaigns, invest FC, view portfolio, use chatbot |
| `creator` | Create campaigns, complete KYC, track milestones, withdraw |
| `admin` | Approve campaigns/KYC, trigger AI risk analysis, view audit logs |
| `customer_support` | View and approve KYC submissions |

Roles are stored as a `user_role` enum in `public.users`. Self-promotion is blocked by RLS WITH CHECK. Only an existing admin can elevate another user.

---

## Team

| Role | Member |
|---|---|
| Project Lead — Full Stack & AI/ML | Jawad Asif ([@JawadAsif77](https://github.com/JawadAsif77)) |
| UI/UX Designer — Research & Analysis | Mahnoor Haider |
| DevOps — Database Core | M. Aashir |

---

## License

MIT — see [LICENSE](LICENSE) for details.
