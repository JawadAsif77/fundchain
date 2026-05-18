# RAG Setup Guide - Updated for OpenRouter

## 🎯 Overview

Your RAG system has been updated to work with **OpenRouter only** - no OpenAI key needed!

**What Changed:**
- ✅ **Embeddings**: Now uses OpenRouter `nomic-ai/nomic-embed-text-v1.5` (768 dimensions)
- ✅ **DOCX Support**: Can read Word documents using `mammoth` library
- ✅ **Better Index**: HNSW instead of ivfflat (faster, more accurate)
- ✅ **Source Citations**: Shows which document chunks were used
- ✅ **No Extra Keys**: Uses your existing OPENROUTER_API_KEY

---

## 🚀 Quick Setup (5 Steps)

### 1️⃣ Create Database Table

```sql
-- Run in Supabase SQL Editor
-- File: supabase/doc_embeddings_table.sql
```

Creates table with VECTOR(768) and HNSW index.

### 2️⃣ Install Dependencies

```powershell
cd scripts
npm install  # Installs mammoth for DOCX support
```

### 3️⃣ Index Documents

```powershell
npm run index-docs
```

This will:
- Read `README.md`
- Read `Scope Document.docx` (using mammoth)
- Chunk into 1000-char segments
- Generate embeddings via OpenRouter
- Store in Supabase

### 4️⃣ Deploy Edge Function

```powershell
cd ..
supabase functions deploy chat_ai
```

### 5️⃣ Test It!

Open chatbot and ask:
- "What technologies does FundChain use?"
- "How does the escrow system work?"
- "What are the project limitations?"

---

## 📝 Technical Details

### Vector Dimensions: 768

- **Old**: OpenAI text-embedding-3-small (1536 dimensions)
- **New**: nomic-embed-text-v1.5 (768 dimensions)

The SQL schema and edge function have been updated to match.

### Index Type: HNSW

```sql
CREATE INDEX doc_embeddings_embedding_idx 
ON doc_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

- **Old**: ivfflat (slower, less accurate)
- **New**: HNSW (faster, better for small-medium datasets)

### Source Citations

The `match_documents` function now returns `metadata` column:

```typescript
retrievedContext = documents.map((doc) => {
  const source = doc.metadata?.document || 'Unknown Source';
  return `[Source: ${source}]\n${doc.content}`;
}).join("\n\n---\n\n");
```

Users can see which documents were referenced.

### DOCX Support

```javascript
import mammoth from 'mammoth';

async function readDocxFile(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}
```

Now works with:
- `.md` - Plain text markdown
- `.txt` - Plain text
- `.docx` - Microsoft Word documents

---

## 🔍 Monitoring

### Check Indexed Documents

```sql
SELECT 
  metadata->>'document' as source,
  COUNT(*) as chunks,
  MAX(created_at) as last_indexed
FROM doc_embeddings
GROUP BY metadata->>'document';
```

Expected:
```
 source          | chunks | last_indexed
-----------------+--------+-------------------------
 README          |     15 | 2026-01-06 10:30:00
 Scope Document  |     42 | 2026-01-06 10:31:00
```

### Test Vector Search

```sql
-- This won't work directly (need actual embedding vector)
-- But shows the query structure
SELECT 
  content,
  metadata->>'document' as source,
  similarity
FROM match_documents(
  '[0.1, 0.2, ...]'::vector(768),
  0.5,  -- threshold
  3     -- count
);
```

---

## 💰 Cost (OpenRouter)

**nomic-embed-text-v1.5:**
- Free tier: 200 requests/day
- Paid: Essentially $0 (very cheap)

**For typical usage:**
- Index 50 pages: ~100 calls = FREE
- 1000 chat queries: 1000 calls = ~$0.00

**Total**: Negligible cost, especially on free tier.

---

## 🛠️ Troubleshooting

### "File not found: Scope Document.docx"

Update path in `scripts/index_docs.js`:

```javascript
{
  path: path.join(__dirname, '../path/to/your/Scope Document.docx'),
  name: 'Scope Document',
}
```

### "OpenRouter API error"

Check:
1. API key valid: https://openrouter.ai/keys
2. Model name correct: `nomic-ai/nomic-embed-text-v1.5`
3. Free tier not exceeded (wait 24h or upgrade)

### "No documents found in search"

Lower the threshold:

```typescript
// In chat_ai/index.ts
match_threshold: 0.3,  // was 0.5
```

### "Wrong vector dimensions"

Make sure:
1. SQL uses `VECTOR(768)` ✅
2. Edge function uses `nomic-embed-text-v1.5` ✅
3. Indexed documents use same model ✅

If you had old 1536-dim embeddings:

```sql
TRUNCATE doc_embeddings;  -- Clear old data
-- Then re-run: npm run index-docs
```

---

## 📚 Add More Documents

Edit `scripts/index_docs.js`:

```javascript
const documents = [
  {
    path: path.join(__dirname, '../README.md'),
    name: 'README',
  },
  {
    path: path.join(__dirname, '../Scope Document.docx'),
    name: 'Scope Document',
  },
  // Add more:
  {
    path: path.join(__dirname, '../docs/API.md'),
    name: 'API Guide',
  },
  {
    path: path.join(__dirname, '../ARCHITECTURE.md'),
    name: 'Architecture',
  },
];
```

Then run:
```powershell
npm run index-docs  # Adds without clearing
```

Or clear first:
```powershell
npm run index-docs:clear
```

---

## ✅ Verification Checklist

- [ ] SQL table created with VECTOR(768)
- [ ] HNSW index created
- [ ] `match_documents` function returns metadata
- [ ] `npm install` in scripts/ (mammoth installed)
- [ ] Documents indexed successfully
- [ ] Edge function deployed
- [ ] Chatbot answers technical questions
- [ ] Source citations visible in context

---

## 🎉 Success Criteria

Your RAG system is working when:

1. **Chatbot gives specific answers** about FundChain architecture
2. **Answers cite sources** (e.g., "According to the Scope Document...")
3. **No generic responses** to technical questions
4. **Fast responses** (<3 seconds with vector search)

**Example Good Response:**
```
Question: "What database does FundChain use?"

Answer: "Based on the technical documentation, FundChain uses 
Supabase as its primary database. Supabase provides PostgreSQL 
with real-time subscriptions, authentication, and storage 
capabilities. The project also utilizes the pgvector extension 
for semantic search functionality."

[Source: Scope Document, README]
```

---

## 🔗 Related Files

- `supabase/functions/chat_ai/index.ts` - Edge function with RAG logic
- `supabase/doc_embeddings_table.sql` - Database schema
- `scripts/index_docs.js` - Document ingestion script
- `scripts/package.json` - Dependencies (includes mammoth)

---

## 📞 Need Help?

Common issues:
1. **No OPENROUTER_API_KEY**: Add to `.env.local`
2. **Scope Document missing**: Update path or convert to .txt
3. **No results from search**: Lower match_threshold to 0.3
4. **Old embeddings**: Run `npm run index-docs:clear`

All fixes have been applied - you're ready to go! 🚀
