-- Create doc_embeddings table for RAG (Retrieval Augmented Generation)
CREATE TABLE IF NOT EXISTS doc_embeddings (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL,  -- text-embedding-3-small uses 1536 dimensions
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search (hnsw is faster and more accurate than ivfflat)
CREATE INDEX IF NOT EXISTS doc_embeddings_embedding_idx 
ON doc_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create match_documents RPC function for vector search (returns metadata for source citations)
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM doc_embeddings
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Grant permissions (adjust based on your security needs)
GRANT SELECT ON doc_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION match_documents TO authenticated;
GRANT ALL ON doc_embeddings TO service_role;
