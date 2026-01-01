/**
 * Prompt templates for chat AI
 * Provides structured prompts with safety guidelines and context integration
 */

interface InternalContext {
  campaign?: any;
  riskAnalysis?: any;
  recommendationReasons?: any;
  fundingStats?: any;
  userProfile?: any;
}

interface ExternalKnowledge {
  question: string;
  answer: string;
  similarity?: number;
}

/**
 * Get the base system prompt with safety guidelines
 */
export function getSystemPrompt(): string {
  return `You are FundChain AI, an intelligent assistant for a blockchain-based crowdfunding platform.

Your role: Help users understand campaigns, investments, blockchain technology, and fundraising. Provide clear, accurate, and educational information.

CRITICAL SAFETY RULES - ALWAYS FOLLOW:

1. No Financial Guarantees:
- Never guarantee returns, profits, or investment outcomes
- Never promise campaign success
- Never claim investments are "risk-free" or "guaranteed safe"
- Use phrases: "may", "could", "potentially", "based on current data"

2. Always Mention Risk:
- Every investment carries risk - acknowledge this
- Always mention risk levels when discussing campaigns
- Past performance doesn't guarantee future results
- Users could lose their invested capital

3. Explain Your Reasoning:
- When providing advice, explain WHY
- Show factors and data points that inform your guidance
- Be transparent about algorithm logic
- Admit when information is limited or uncertain

4. General Guidelines:
- Be concise and clear
- Be friendly and professional
- If you don't know, admit it honestly
- Encourage users to do their own research (DYOR)
- Suggest consulting financial advisors for major decisions
- Never pressure users to invest

Response style: Keep answers focused and to-the-point. Use bullet points for clarity. Include relevant data and metrics when available.

Your purpose: Educate and inform, not make investment decisions for users.`;
}

/**
 * Get context-enhanced prompt combining internal data, explanations, and external knowledge
 */
export function getContextPrompt(
  internalContext?: InternalContext,
  explanation?: string,
  externalKnowledge?: ExternalKnowledge[]
): string {
  const contextParts: string[] = [];

  // Add internal context (campaign data, user profile, etc.)
  if (internalContext && Object.keys(internalContext).length > 0) {
    contextParts.push(`**INTERNAL PLATFORM DATA:**\n`);

    if (internalContext.campaign) {
      const campaign = internalContext.campaign;
      contextParts.push(`Campaign: ${campaign.title}
- Category: ${campaign.category}
- Location: ${campaign.location}
- Status: ${campaign.status}
- Funding: ${campaign.current_funding?.toLocaleString() || 0} / ${campaign.funding_goal?.toLocaleString() || 0} FC (${((campaign.current_funding / campaign.funding_goal) * 100).toFixed(1)}%)
- Investors: ${campaign.investor_count || 0}
- Creator: ${campaign.creator_name || 'Unknown'}${campaign.days_remaining ? `\n- Days Remaining: ${campaign.days_remaining}` : ''}`);
    }

    if (internalContext.riskAnalysis) {
      const risk = internalContext.riskAnalysis;
      contextParts.push(`\nRisk Assessment:
- Risk Level: **${risk.risk_level}**
- Risk Score: ${risk.final_risk_score}/100
- Note: Always mention this risk level when discussing the campaign`);
    }

    if (internalContext.recommendationReasons) {
      const rec = internalContext.recommendationReasons;
      contextParts.push(`\nRecommendation Details:
- Match Score: ${rec.score.toFixed(1)}%
- Reasons: ${rec.reasons?.join(', ') || 'Not available'}
- Tags: ${rec.reason_tags?.join(', ') || 'Not available'}`);
    }

    if (internalContext.fundingStats) {
      const stats = internalContext.fundingStats;
      contextParts.push(`\nFunding Statistics:
- Total Raised: ${stats.total_raised?.toLocaleString() || 0} FC
- Progress: ${stats.funding_progress?.toFixed(1) || 0}%
- Recent Activity: ${stats.recent_investments?.length || 0} recent investments`);
    }

    if (internalContext.userProfile) {
      const profile = internalContext.userProfile;
      contextParts.push(`\nUser Profile:
- Preferred Categories: ${profile.preferred_categories?.join(', ') || 'None set'}
- Preferred Regions: ${profile.preferred_regions?.join(', ') || 'None set'}
- Risk Tolerance: ${profile.risk_tolerance || 'Not set'}
- Total Invested: ${profile.total_invested?.toLocaleString() || 0} FC`);
    }
  }

  // Add explanation if provided
  if (explanation) {
    contextParts.push(`\n**AI ANALYSIS & EXPLANATION:**\n${explanation}`);
  }

  // Add external knowledge if provided
  if (externalKnowledge && externalKnowledge.length > 0) {
    contextParts.push(`\n**RELEVANT KNOWLEDGE BASE:**\n`);
    externalKnowledge.forEach((entry, index) => {
      contextParts.push(`[Knowledge ${index + 1}]
Q: ${entry.question}
A: ${entry.answer}\n`);
    });
    contextParts.push(`Use this knowledge to provide accurate, educational answers about crypto, investment, and funding concepts.`);
  }

  if (contextParts.length === 0) {
    return '';
  }

  return `${contextParts.join('\n')}\n\nINSTRUCTIONS:
Use this context to answer accurately. Remember:
- Reference specific data when relevant
- Mention risk levels for investments
- Explain your reasoning
- Never guarantee outcomes`;
}

/**
 * Format user message with appropriate framing
 */
export function getUserPrompt(message: string, intent?: string): string {
  const intentContext = intent ? `[Intent: ${intent}]\n\n` : '';
  
  return `${intentContext}User Question: ${message}

Provide a helpful, accurate response following all safety guidelines. Be clear and concise. Mention risk for investments. Explain your reasoning using the context provided.`;
}

/**
 * Get intent-specific system instructions
 */
export function getIntentSpecificInstructions(intent: string): string {
  const instructions: Record<string, string> = {
    EXTERNAL_KNOWLEDGE: `Focus on education. Explain concepts clearly using the knowledge base. Use examples when helpful.`,
    
    CAMPAIGN_ANALYSIS: `Analyze campaign data objectively. Highlight strengths and weaknesses. Always mention risk level. Base analysis on provided metrics.`,
    
    RISK_EXPLANATION: `Explain risk factors clearly and thoroughly. Use specific data points. Help users understand what risk level means. Never downplay risk.`,
    
    RECOMMENDATION_REASON: `Explain recommendation algorithm transparently. Reference match factors: risk, category, region, popularity. Show how preferences influenced the recommendation. This is a suggestion, not a guarantee.`,
    
    HYBRID: `Address multiple aspects. Provide comprehensive information. Stay focused. Use clear sections if needed.`,
  };

  return instructions[intent] || instructions.EXTERNAL_KNOWLEDGE;
}

/**
 * Build complete prompt for LLM
 */
export function buildCompletePrompt(
  message: string,
  intent?: string,
  internalContext?: InternalContext,
  explanation?: string,
  externalKnowledge?: ExternalKnowledge[]
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  // System message with base instructions
  let systemContent = getSystemPrompt();
  
  // Add intent-specific instructions
  if (intent) {
    systemContent += `\n\nIntent-Specific Instructions:\n${getIntentSpecificInstructions(intent)}`;
  }

  messages.push({ role: 'system', content: systemContent });

  // Context message (if available)
  const contextPrompt = getContextPrompt(internalContext, explanation, externalKnowledge);
  if (contextPrompt) {
    messages.push({ role: 'system', content: contextPrompt });
  }

  // User message
  const userPrompt = getUserPrompt(message, intent);
  messages.push({ role: 'user', content: userPrompt });

  return messages;
}

/**
 * Get disclaimer text to append to responses
 */
export function getDisclaimerText(intent?: string): string {
  if (intent === 'CAMPAIGN_ANALYSIS' || intent === 'RISK_EXPLANATION') {
    return `\n\n---\n*Disclaimer: This analysis is based on available data and AI assessment. All investments carry risk. Please conduct your own research and consider consulting a financial advisor before making investment decisions.*`;
  }

  if (intent === 'RECOMMENDATION_REASON') {
    return `\n\n---\n*Note: Recommendations are personalized suggestions based on your profile and preferences. They do not guarantee investment success. Always review campaigns carefully before investing.*`;
  }

  return '';
}

/**
 * Validate response for safety compliance
 */
export function validateResponseSafety(response: string): { safe: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  const lowerResponse = response.toLowerCase();

  // Check for forbidden guarantee language
  const guaranteeWords = ['guarantee', 'guaranteed', 'promise', 'certain', 'definitely will', 'no risk', 'risk-free', 'sure thing', 'can\'t lose'];
  guaranteeWords.forEach(word => {
    if (lowerResponse.includes(word)) {
      warnings.push(`Response contains potentially problematic word: "${word}"`);
    }
  });

  // Check if risk is mentioned when discussing investments
  const investmentWords = ['invest', 'investment', 'funding', 'campaign', 'project'];
  const hasInvestmentContext = investmentWords.some(word => lowerResponse.includes(word));
  const hasRiskMention = lowerResponse.includes('risk') || lowerResponse.includes('careful') || lowerResponse.includes('caution');

  if (hasInvestmentContext && !hasRiskMention) {
    warnings.push('Response discusses investment but does not mention risk');
  }

  return {
    safe: warnings.length === 0,
    warnings
  };
}
