/**
 * Intent detection for chat AI
 * Determines the type of user query based on keyword matching
 */

export type Intent = 
  | 'EXTERNAL_KNOWLEDGE'
  | 'CAMPAIGN_ANALYSIS'
  | 'RISK_EXPLANATION'
  | 'RECOMMENDATION_REASON'
  | 'HYBRID';

// Keyword patterns for each intent type
const INTENT_KEYWORDS = {
  EXTERNAL_KNOWLEDGE: [
    'what is', 'define', 'explain', 'how does', 'what are',
    'crypto', 'cryptocurrency', 'blockchain', 'bitcoin', 'ethereum',
    'token', 'coin', 'defi', 'wallet', 'smart contract',
    'investment', 'investing', 'portfolio', 'diversification',
    'startup', 'funding', 'venture capital', 'ico', 'seed round',
    'series a', 'equity', 'valuation', 'cap table', 'term sheet',
    'staking', 'yield', 'gas fee', 'proof of stake', 'proof of work',
    'dao', 'airdrop', 'whitepaper', 'tokenomics', 'kyc', 'aml'
  ],
  
  CAMPAIGN_ANALYSIS: [
    'campaign', 'project', 'analyze', 'analysis', 'evaluate',
    'assessment', 'review', 'performance', 'progress',
    'funding goal', 'raised', 'investors', 'deadline',
    'milestone', 'status', 'creator', 'business model',
    'market', 'competition', 'team', 'traction'
  ],
  
  RISK_EXPLANATION: [
    'risk', 'risky', 'safe', 'safety', 'security',
    'danger', 'vulnerable', 'threat', 'scam', 'fraud',
    'risk level', 'risk score', 'risk assessment', 'risk analysis',
    'low risk', 'medium risk', 'high risk', 'risk tolerance',
    'protect', 'secure', 'trust', 'verify', 'guarantee'
  ],
  
  RECOMMENDATION_REASON: [
    'recommend', 'recommendation', 'suggested', 'why recommend',
    'why suggested', 'why this', 'match', 'matching',
    'personalized', 'for me', 'my interests', 'similar to',
    'based on', 'reason', 'because', 'why show', 'why see'
  ]
};

/**
 * Detect the intent of a user message
 * Returns HYBRID if multiple intents are detected
 */
export function detectIntent(message: string): Intent {
  if (!message || typeof message !== 'string') {
    return 'EXTERNAL_KNOWLEDGE'; // Default fallback
  }

  const lowerMessage = message.toLowerCase().trim();
  
  // Count matches for each intent
  const intentMatches: Record<string, number> = {
    EXTERNAL_KNOWLEDGE: 0,
    CAMPAIGN_ANALYSIS: 0,
    RISK_EXPLANATION: 0,
    RECOMMENDATION_REASON: 0
  };

  // Check for keyword matches
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        intentMatches[intent]++;
      }
    }
  }

  // Count how many intents have matches
  const matchedIntents = Object.entries(intentMatches)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]); // Sort by match count descending

  // No matches - default to EXTERNAL_KNOWLEDGE
  if (matchedIntents.length === 0) {
    console.log('No intent matches found, defaulting to EXTERNAL_KNOWLEDGE');
    return 'EXTERNAL_KNOWLEDGE';
  }

  // Multiple intents with similar match counts - return HYBRID
  if (matchedIntents.length > 1) {
    const topScore = matchedIntents[0][1];
    const secondScore = matchedIntents[1][1];
    
    // If top two intents are close in score (within 50%), consider it HYBRID
    if (secondScore >= topScore * 0.5) {
      console.log(`Multiple intents detected: ${matchedIntents.map(([i, c]) => `${i}(${c})`).join(', ')} - returning HYBRID`);
      return 'HYBRID';
    }
  }

  // Return the intent with the highest match count
  const detectedIntent = matchedIntents[0][0] as Intent;
  console.log(`Detected intent: ${detectedIntent} (${matchedIntents[0][1]} matches)`);
  return detectedIntent;
}

/**
 * Get a human-readable description of an intent
 */
export function getIntentDescription(intent: Intent): string {
  const descriptions: Record<Intent, string> = {
    EXTERNAL_KNOWLEDGE: 'General knowledge about crypto, investments, or startups',
    CAMPAIGN_ANALYSIS: 'Analysis of specific campaigns or projects',
    RISK_EXPLANATION: 'Risk assessment and security concerns',
    RECOMMENDATION_REASON: 'Explanation of recommendations and personalization',
    HYBRID: 'Multiple types of information needed'
  };
  
  return descriptions[intent];
}
