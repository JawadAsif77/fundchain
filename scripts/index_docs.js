/**
 * Document Ingestion Script for RAG (Retrieval Augmented Generation)
 * 
 * This script:
 * 1. Reads README.md, DOCX files, and other documentation
 * 2. Splits them into chunks (~1000 characters)
 * 3. Generates embeddings using OpenRouter API (nomic-embed-text-v1.5)
 * 4. Stores chunks and embeddings in Supabase
 * 
 * Usage:
 *   node scripts/index_docs.js
 *   node scripts/index_docs.js --clear  (clear existing embeddings first)
 * 
 * Requirements:
 *   - OPENROUTER_API_KEY in .env.local
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - npm install mammoth (for .docx support)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const OPENROUTER_API_KEY = process.env.VITE_OPENROUTER_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHUNK_SIZE = 1000; // characters per chunk
const OVERLAP = 200; // overlap between chunks

if (!OPENROUTER_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables. Check .env.local file.');
  console.error('Required: VITE_OPENROUTER_API_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Split text into chunks with overlap
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = OVERLAP) {
  if (!text || text.length === 0) return [];
  
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    
    // If we've reached the end of the text, break the loop
    if (end === text.length) break;
    
    // Move start forward by the chunk size MINUS the overlap
    start += (chunkSize - overlap);
    
    // Safety check to prevent infinite loop if overlap >= chunkSize
    if (start >= end) {
      start = end; 
    }
  }

  return chunks;
}

/**
 * Generate embedding using OpenRouter API (text-embedding-3-small - 1536 dimensions)
 */
async function generateEmbedding(text) {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://fundchain.app',
      'X-Title': 'FundChain Document Indexing',
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Read DOCX file and extract text using mammoth
 */
async function readDocxFile(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

/**
 * Read and process a file (supports .md, .txt, .docx)
 */
async function processFile(filePath, documentName, priority = 'normal') {
  console.log(`\n📄 Processing: ${documentName}`);
  
  try {
    let content;
    
    // Read file based on extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.docx') {
      console.log('  📖 Reading DOCX file...');
      content = await readDocxFile(filePath);
    } else {
      content = fs.readFileSync(filePath, 'utf-8');
    }
    
    const chunks = chunkText(content);
    
    console.log(`  ✂️  Split into ${chunks.length} chunks`);
    
    let successCount = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Generate embedding
        console.log(`  🔄 Processing chunk ${i + 1}/${chunks.length}...`);
        const embedding = await generateEmbedding(chunk);
        
        // Insert into database
        const { error } = await supabase
          .from('doc_embeddings')
          .insert({
            content: chunk,
            embedding: embedding,
            metadata: {
              document: documentName,
              priority: priority,
              chunk_index: i,
              total_chunks: chunks.length,
              indexed_at: new Date().toISOString(),
            },
          });
        
        if (error) {
          console.error(`  ❌ Failed to insert chunk ${i + 1}:`, error.message);
        } else {
          successCount++;
        }
        
        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.error(`  ❌ Error processing chunk ${i + 1}:`, err.message);
      }
    }
    
    console.log(`  ✅ Successfully indexed ${successCount}/${chunks.length} chunks from ${documentName}`);
    
  } catch (err) {
    console.error(`  ❌ Error reading file:`, err.message);
  }
}

/**
 * Clear existing embeddings (optional)
 */
async function clearExistingEmbeddings() {
  console.log('\n🗑️  Clearing existing embeddings...');
  
  const { error } = await supabase
    .from('doc_embeddings')
    .delete()
    .neq('id', 0); // Delete all
  
  if (error) {
    console.error('❌ Failed to clear embeddings:', error.message);
    return false;
  }
  
  console.log('✅ Cleared existing embeddings');
  return true;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 FundChain Documentation Indexing Script');
  console.log('==========================================\n');
  
  // Optional: Clear existing embeddings
  const clearFirst = process.argv.includes('--clear');
  if (clearFirst) {
    await clearExistingEmbeddings();
  }
  
  // Define documents to index
  const documents = [
    {
      path: path.join(__dirname, '../Golden_Knowledge.md'),
      name: 'Golden Knowledge Base',
      priority: 'high',
    },
    {
      path: path.join(__dirname, '../README.md'),
      name: 'README',
      priority: 'normal',
    },
    {
      path: path.join(__dirname, '../Scope Document.docx'),
      name: 'Scope Document',
      priority: 'normal',
    },
  ];
  
  // Process each document
  for (const doc of documents) {
    if (fs.existsSync(doc.path)) {
      await processFile(doc.path, doc.name, doc.priority || 'normal');
    } else {
      console.log(`⚠️  File not found: ${doc.path}`);
    }
  }
  
  console.log('\n✅ Indexing complete!');
  console.log('\n💡 Tip: Run with --clear flag to clear existing embeddings first');
  console.log('   Example: node scripts/index_docs.js --clear');
}

// Run the script
main().catch(console.error);
