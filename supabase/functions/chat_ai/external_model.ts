import { OpenAI } from 'https://deno.land/x/openai@v4.20.1/mod.ts';

interface KnowledgeEntry {
  question: string;
  answer: string;
}

interface EmbeddingResult {
  question: string;
  answer: string;
  embedding: number[];
}

/**
 * Reads external_knowledge.json and generates embeddings for each answer
 * using OpenAI's text-embedding-3-small model
 */
export async function prepareEmbeddings(): Promise<EmbeddingResult[]> {
  try {
    // Initialize OpenAI client
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const openai = new OpenAI({ apiKey });

    // Read the external knowledge file
    const knowledgeFilePath = new URL('../../../external_knowledge.json', import.meta.url).pathname;
    const fileContent = await Deno.readTextFile(knowledgeFilePath);
    const knowledgeData = JSON.parse(fileContent);
    
    if (!knowledgeData.knowledge_base || !Array.isArray(knowledgeData.knowledge_base)) {
      throw new Error('Invalid knowledge base format');
    }

    const knowledgeBase: KnowledgeEntry[] = knowledgeData.knowledge_base;
    console.log(`Processing ${knowledgeBase.length} knowledge entries...`);

    // Generate embeddings for all answers
    const embeddingResults: EmbeddingResult[] = [];
    
    // Process in batches to avoid rate limits (batch size: 10)
    const batchSize = 10;
    for (let i = 0; i < knowledgeBase.length; i += batchSize) {
      const batch = knowledgeBase.slice(i, i + batchSize);
      
      // Create embedding requests for the batch
      const batchPromises = batch.map(async (entry) => {
        try {
          const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: entry.answer,
          });

          return {
            question: entry.question,
            answer: entry.answer,
            embedding: response.data[0].embedding,
          };
        } catch (error) {
          console.error(`Error generating embedding for: "${entry.question}"`, error);
          return null;
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Add successful results
      batchResults.forEach((result) => {
        if (result !== null) {
          embeddingResults.push(result);
        }
      });

      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(knowledgeBase.length / batchSize)}`);
      
      // Add a small delay between batches to respect rate limits
      if (i + batchSize < knowledgeBase.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Successfully generated ${embeddingResults.length} embeddings`);
    return embeddingResults;

  } catch (error) {
    console.error('Error preparing embeddings:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Search for answers using a pre-computed question embedding
 * Returns top 3 most similar knowledge base entries
 */
export function searchAnswer(
  questionEmbedding: number[],
  embeddings: EmbeddingResult[],
  topK: number = 3
): EmbeddingResult[] {
  try {
    // Calculate similarity scores for all knowledge entries
    const scoredEntries = embeddings.map((entry) => ({
      ...entry,
      similarity: cosineSimilarity(questionEmbedding, entry.embedding),
    }));

    // Sort by similarity (descending) and return top K
    const topResults = scoredEntries
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    console.log(`Found ${topResults.length} similar entries using pre-computed embedding`);
    topResults.forEach((result, idx) => {
      console.log(`  ${idx + 1}. [${result.similarity.toFixed(3)}] ${result.question}`);
    });

    return topResults;

  } catch (error) {
    console.error('Error searching answers:', error);
    throw error;
  }
}

/**
 * Find the most relevant knowledge base entries for a given query
 */
export async function findRelevantKnowledge(
  query: string,
  embeddings: EmbeddingResult[],
  topK: number = 3
): Promise<EmbeddingResult[]> {
  try {
    // Initialize OpenAI client
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const openai = new OpenAI({ apiKey });

    // Generate embedding for the query
    const queryEmbedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryVector = queryEmbedding.data[0].embedding;

    // Use searchAnswer to find results
    return searchAnswer(queryVector, embeddings, topK);

  } catch (error) {
    console.error('Error finding relevant knowledge:', error);
    throw error;
  }
}
