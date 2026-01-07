/**
 * Dataset Generation Script for Training Data
 * 
 * This script:
 * 1. Reads Golden_Knowledge.md and User_Guide.md
 * 2. Uses OpenRouter LLM to generate realistic Q&A pairs
 * 3. Outputs a .jsonl file for training/fine-tuning
 * 
 * Usage:
 *   node scripts/generate_dataset.js
 * 
 * Output:
 *   training_dataset.jsonl (50 Q&A pairs)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const OPENROUTER_API_KEY = process.env.VITE_OPENROUTER_API_KEY;
const MODEL = 'meta-llama/llama-3.1-8b-instruct'; // Fast and good for generation
const NUM_PAIRS = 20; // Reduced to ensure response doesn't get cut off
const OUTPUT_FILE = path.join(__dirname, '../training_dataset.jsonl');

if (!OPENROUTER_API_KEY) {
  console.error('❌ Missing VITE_OPENROUTER_API_KEY in .env.local');
  process.exit(1);
}

/**
 * Read documentation files
 */
function readDocFiles() {
  const goldenKnowledge = fs.readFileSync(
    path.join(__dirname, '../Golden_Knowledge.md'),
    'utf-8'
  );
  
  let userGuide = '';
  const userGuidePath = path.join(__dirname, '../User_Guide.md');
  if (fs.existsSync(userGuidePath)) {
    userGuide = fs.readFileSync(userGuidePath, 'utf-8');
  }
  
  return { goldenKnowledge, userGuide };
}

/**
 * Generate Q&A pairs using LLM
 */
async function generateQAPairs(docs, numPairs) {
  const prompt = `You are a training data generator for an AI chatbot assistant called "FC AI" for FundChain, a blockchain crowdfunding platform.

DOCUMENTATION TO BASE QUESTIONS ON:
${docs.goldenKnowledge}

${docs.userGuide ? `\nADDITIONAL USER GUIDE:\n${docs.userGuide}` : ''}

YOUR TASK:
Generate ${numPairs} realistic question-answer pairs that cover:
1. Platform features (escrow, tokenomics, risk detection)
2. How-to questions (create campaign, invest, check balance)
3. Safety concerns (is my money safe, what if creator scams)
4. Technical questions (what is FC token, how does milestone work)
5. Portfolio questions (how am I doing, should I diversify)

REQUIREMENTS:
- Questions should sound natural (like real users ask)
- Vary complexity (simple to detailed)
- Answers should be 2-3 sentences for simple questions, longer for complex ones
- Use bold formatting for key terms (e.g., **Milestone-Based Escrow**)
- Include the "Next Step" question at the VERY END of the "answer" string (do NOT create a separate key for it)
- Use simple analogies (digital safe, not smart contract)

OUTPUT FORMAT:
Return ONLY a valid JSON array. Each item must have EXACTLY two keys: "question" and "answer".
{
  "question": "user question here",
  "answer": "assistant answer here with Next Step question at the end"
}

CRITICAL JSON RULES:
- ONLY use two keys: "question" and "answer"
- Every property must be followed by a comma except the last one
- Double-check your JSON syntax before responding
- Ensure all quotes are properly closed
- NO markdown code blocks, NO explanations, ONLY the raw JSON array

Return format: [{"question": "...", "answer": "..."}, {"question": "...", "answer": "..."}]`;

  console.log('🤖 Generating Q&A pairs with LLM...');
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://fundchain.app',
      'X-Title': 'FundChain Dataset Generator',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.8, // Higher for more variety
      max_tokens: 8000
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Try to parse JSON from the response
  let pairs;
  try {
    // Remove markdown code blocks if present
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                     content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    pairs = JSON.parse(jsonStr);
  } catch (err) {
    console.error('❌ Failed to parse LLM response as JSON');
    console.log('Response:', content);
    throw err;
  }

  return pairs;
}

/**
 * Convert Q&A pairs to JSONL training format
 */
function convertToJSONL(pairs) {
  const systemPrompt = `You are FC AI, an intelligent investment assistant for FundChain, a blockchain-based business crowdfunding platform. 

TONE: Speak like a helpful, protective investment guide. Use simple analogies (call Escrow a 'digital safe') instead of technical jargon.

FORMATTING:
- Start with a 2-line summary
- Use **Bold** for key terms and numbers
- End with a "Next Step" question

PRIORITY: If a user asks about safety or security, always mention:
1. Milestone-Based Escrow (digital safe)
2. AI Risk Detection system
3. Investor voting on milestones`;

  return pairs.map(pair => {
    const trainingExample = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: pair.question },
        { role: 'assistant', content: pair.answer }
      ]
    };
    return JSON.stringify(trainingExample);
  }).join('\n');
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 FundChain Training Dataset Generator');
  console.log('======================================\n');

  try {
    // Read documentation
    console.log('📖 Reading documentation files...');
    const docs = readDocFiles();
    console.log(`✅ Loaded Golden_Knowledge.md (${docs.goldenKnowledge.length} chars)`);
    if (docs.userGuide) {
      console.log(`✅ Loaded User_Guide.md (${docs.userGuide.length} chars)`);
    }

    // Generate Q&A pairs
    const pairs = await generateQAPairs(docs, NUM_PAIRS);
    console.log(`✅ Generated ${pairs.length} Q&A pairs`);

    // Convert to JSONL
    console.log('📝 Converting to JSONL format...');
    const jsonlContent = convertToJSONL(pairs);

    // Write to file
    fs.writeFileSync(OUTPUT_FILE, jsonlContent, 'utf-8');
    console.log(`✅ Dataset saved to: ${OUTPUT_FILE}`);
    console.log(`\n📊 Stats:`);
    console.log(`   - Total pairs: ${pairs.length}`);
    console.log(`   - File size: ${(jsonlContent.length / 1024).toFixed(2)} KB`);
    console.log(`   - Format: JSONL (ready for fine-tuning)`);

    // Show sample
    console.log(`\n🔍 Sample Q&A pair:`);
    console.log(`   Q: ${pairs[0].question}`);
    console.log(`   A: ${pairs[0].answer.substring(0, 150)}...`);

    console.log(`\n✅ Done! You can now use this dataset for:`);
    console.log(`   - Fine-tuning models`);
    console.log(`   - Testing chatbot performance`);
    console.log(`   - Project documentation/reports`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);
