import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.22.0';

interface KnowledgeEntry {
  question: string;
  answer: string;
  embedding?: number[];
}

interface EmbeddingResult extends KnowledgeEntry {
  embedding: number[];
  similarity?: number;
}

/**
 * Training logic with built-in delay for Free Tier
 */
export async function prepareEmbeddings(): Promise<EmbeddingResult[]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const genAI = new GoogleGenerativeAI(apiKey!);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  const knowledgeFilePath = new URL('./external_knowledge.json', import.meta.url);
  const { knowledge_base } = JSON.parse(await Deno.readTextFile(knowledgeFilePath));

  const results: EmbeddingResult[] = [];
  for (const entry of knowledge_base) {
    try {
      const res = await model.embedContent(entry.answer);
      results.push({ ...entry, embedding: res.embedding.values });
      
      // WAIT 1 SECOND between each item to avoid Free Tier 429 error
      await new Promise(r => setTimeout(r, 1000)); 
    } catch (_e) {
      console.warn("Skipping one knowledge item due to rate limit...");
    }
  }
  return results;
}

export async function findRelevantKnowledge(query: string, embeddings: EmbeddingResult[]): Promise<EmbeddingResult[]> {
  if (!embeddings || embeddings.length === 0) return [];
  
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const genAI = new GoogleGenerativeAI(apiKey!);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  try {
    const res = await model.embedContent(query);
    const queryVector = res.embedding.values;

    return embeddings
      .map(entry => ({
        ...entry,
        similarity: cosineSimilarity(queryVector, entry.embedding)
      }))
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, 3);
  } catch (_e) {
    return [];
  }
}

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}