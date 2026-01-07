# RAG (Retrieval Augmented Generation) Setup for FundChain Chatbot

This guide explains how to set up vector search to make your chatbot answer questions from your documentation.

## Architecture

```
User Question
    ↓
Generate Embedding (OpenAI)
    ↓
Vector Search (Supabase)
    ↓
Retrieve Relevant Docs
    ↓
Add to System Prompt
    ↓
Send to LLM (OpenRouter)
    ↓
AI Response
```

## Step 1: Set Up Database Table

Run this SQL in your Supabase SQL Editor:

```bash
# From project root
cat supabase/doc_embeddings_table.sql
```

This creates:
- `doc_embeddings` table with vector column
- `match_documents` RPC function for similarity search
- Indexes for fast vector search

## Step 2: Add OpenAI API Key

Add to your `.env.local`:

```env
OPENAI_API_KEY=sk-...your-key...
```

Get your key from: https://platform.openai.com/api-keys

## Step 3: Install Script Dependencies

```bash
cd scripts
npm install
```

## Step 4: Index Your Documents

```bash
# From scripts directory
npm run index-docs

# Or to clear existing embeddings first:
npm run index-docs:clear
```

The script will:
1. Read `README.md` (and any other docs you add)
2. Split into ~1000 character chunks
3. Generate embeddings using OpenAI
4. Store in `doc_embeddings` table

**Processing Time:** ~1 minute per 10KB of text

## Step 5: Add More Documents

Edit `scripts/index_docs.js` and add files to the `documents` array:

```javascript
const documents = [
  {
    path: path.join(__dirname, '../README.md'),
    name: 'README',
  },
  {
    path: path.join(__dirname, '../docs/scope-document.txt'),
    name: 'Scope Document',
  },
  // Add more files here...
];
```

**Supported formats:** `.txt`, `.md` (convert `.docx` to `.txt` first)

## Step 6: Deploy Updated Edge Function

```bash
# From project root
supabase functions deploy chat_ai
```

## How It Works

### When a user asks: "What technologies does FundChain use?"

1. **Embedding Generation:**
   ```
   Question → OpenAI Embedding API → [0.123, -0.456, ...]
   ```

2. **Vector Search:**
   ```sql
   SELECT content, similarity
   FROM match_documents([embedding], 0.5, 3)
   ```
   Returns 3 most similar document chunks

3. **Context Injection:**
   ```
   System Prompt + Retrieved Docs → LLM → Answer
   ```

4. **Response:**
   ```
   "FundChain uses React for frontend, Solana blockchain for 
   transactions, and Supabase for the database..."
   ```

## Monitoring

Check what's indexed:

```sql
SELECT 
  metadata->>'document' as document,
  COUNT(*) as chunks
FROM doc_embeddings
GROUP BY metadata->>'document';
```

Test vector search:

```sql
-- Replace with actual embedding from OpenAI API
SELECT content, 1 - (embedding <=> '[your-embedding-here]') as similarity
FROM doc_embeddings
ORDER BY embedding <=> '[your-embedding-here]'
LIMIT 5;
```

## Cost Estimates

**OpenAI Embeddings (text-embedding-3-small):**
- $0.02 per 1M tokens
- ~1000 characters = ~250 tokens
- 10KB document ≈ $0.005

**Example:** Indexing 100KB of docs = ~$0.05

## Troubleshooting

### "Missing environment variables"
- Check `.env.local` has `OPENAI_API_KEY`
- Verify Supabase keys are set

### "Vector dimension mismatch"
- Ensure using `text-embedding-3-small` (1536 dimensions)
- Don't mix with other embedding models

### "No results from vector search"
- Lower `match_threshold` (try 0.3)
- Increase `match_count` (try 5)
- Check embeddings exist: `SELECT COUNT(*) FROM doc_embeddings`

### "Rate limit exceeded"
- Script has 100ms delay between chunks
- For large docs, increase delay in `processFile()`

## Best Practices

1. **Chunk Size:** 1000 chars works well for Q&A
2. **Overlap:** 200 chars prevents context loss
3. **Reindex:** Run script when docs change
4. **Clear Old:** Use `--clear` flag to remove outdated chunks
5. **Document Types:** Focus on technical docs, FAQs, guides

## Advanced: Add PDF Support

Install dependency:
```bash
npm install pdf-parse
```

Update script:
```javascript
import pdf from 'pdf-parse';

async function processPDF(filePath, documentName) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  const chunks = chunkText(data.text);
  // ... rest of processing
}
```

## Testing Your RAG System

Ask the chatbot:
- "What is FundChain's tech stack?"
- "How does the escrow system work?"
- "What are the project milestones?"

The AI should reference your documentation!
