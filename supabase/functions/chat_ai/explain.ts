/**
 * Generate human-readable explanations based on internal context
 */

interface InternalContext {
  campaign?: {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    status: string;
    funding_goal: number;
    current_funding: number;
    investor_count: number;
    creator_name?: string;
    deadline?: string;
    days_remaining?: number;
  };
  riskAnalysis?: {
    risk_level: string;
    final_risk_score: number;
    risk_factors: any;
    analysis_date?: string;
  };
  recommendationReasons?: {
    score: number;
    reasons: string[];
    reason_tags: string[];
  };
  fundingStats?: {
    total_raised: number;
    funding_progress: number;
    days_remaining?: number;
    recent_investments?: Array<{
      amount: number;
      date: string;
    }>;
  };
  userProfile?: {
    preferred_categories: string[];
    preferred_regions: string[];
    risk_tolerance: string;
    total_invested: number;
  };
}

interface ExplanationResult {
  riskExplanation?: string;
  recommendationExplanation?: string;
  aiFactorsExplanation?: string;
  fullExplanation: string;
}

/**
 * Generate comprehensive explanation based on internal context
 */
export function generateExplanation(internalContext: InternalContext): ExplanationResult {
  const result: ExplanationResult = {
    fullExplanation: ''
  };

  const explanationParts: string[] = [];

  // Generate risk explanation
  if (internalContext.riskAnalysis) {
    const riskExplanation = explainRiskLevel(internalContext);
    result.riskExplanation = riskExplanation;
    explanationParts.push(riskExplanation);
  }

  // Generate recommendation explanation
  if (internalContext.recommendationReasons) {
    const recommendationExplanation = explainRecommendation(internalContext);
    result.recommendationExplanation = recommendationExplanation;
    explanationParts.push(recommendationExplanation);
  }

  // Generate AI factors explanation
  const aiFactorsExplanation = explainAIFactors(internalContext);
  result.aiFactorsExplanation = aiFactorsExplanation;
  explanationParts.push(aiFactorsExplanation);

  // Combine all parts
  result.fullExplanation = explanationParts.filter(Boolean).join('\n\n');

  return result;
}

/**
 * Explain why the risk level is low/medium/high
 */
function explainRiskLevel(context: InternalContext): string {
  if (!context.riskAnalysis || !context.campaign) {
    return '';
  }

  const { risk_level, final_risk_score, risk_factors } = context.riskAnalysis;
  const campaign = context.campaign;

  let explanation = `**Risk Assessment: ${risk_level}**\n\n`;

  // Risk score interpretation
  if (final_risk_score <= 30) {
    explanation += `This campaign has a low risk score of ${final_risk_score}/100, indicating it's a relatively safe investment. `;
  } else if (final_risk_score <= 60) {
    explanation += `This campaign has a medium risk score of ${final_risk_score}/100, indicating moderate risk with balanced potential. `;
  } else {
    explanation += `This campaign has a high risk score of ${final_risk_score}/100, indicating significant risk factors to consider. `;
  }

  // Funding progress impact on risk
  const fundingProgress = campaign.funding_goal > 0 
    ? (campaign.current_funding / campaign.funding_goal) * 100 
    : 0;

  if (fundingProgress > 50) {
    explanation += `The campaign has achieved ${fundingProgress.toFixed(1)}% of its funding goal, showing strong market validation. `;
  } else if (fundingProgress > 20) {
    explanation += `With ${fundingProgress.toFixed(1)}% funding achieved, the campaign is gaining traction. `;
  } else if (fundingProgress > 0) {
    explanation += `The campaign is in early stages with ${fundingProgress.toFixed(1)}% funding, which carries higher uncertainty. `;
  }

  // Investor count impact
  if (campaign.investor_count > 50) {
    explanation += `${campaign.investor_count} investors have backed this project, demonstrating broad community confidence. `;
  } else if (campaign.investor_count > 10) {
    explanation += `${campaign.investor_count} investors have shown interest, providing moderate social proof. `;
  } else if (campaign.investor_count > 0) {
    explanation += `${campaign.investor_count} investors have backed this campaign so far. `;
  }

  // Risk factors analysis
  if (risk_factors && typeof risk_factors === 'object') {
    const factorKeys = Object.keys(risk_factors);
    if (factorKeys.length > 0) {
      explanation += `\n\nKey risk factors considered: `;
      const factorDescriptions = factorKeys
        .slice(0, 3)
        .map(key => {
          const value = risk_factors[key];
          if (typeof value === 'number') {
            return `${key} (${value})`;
          }
          return key;
        });
      explanation += factorDescriptions.join(', ') + '.';
    }
  }

  // Days remaining consideration
  if (campaign.days_remaining !== null && campaign.days_remaining !== undefined) {
    if (campaign.days_remaining < 7) {
      explanation += ` Time is running out with only ${campaign.days_remaining} days left - this adds urgency to investment decisions.`;
    } else if (campaign.days_remaining < 30) {
      explanation += ` With ${campaign.days_remaining} days remaining, there's still time to evaluate this opportunity.`;
    }
  }

  return explanation;
}

/**
 * Explain why this campaign was recommended
 */
function explainRecommendation(context: InternalContext): string {
  if (!context.recommendationReasons || !context.campaign) {
    return '';
  }

  const { score, reasons, reason_tags } = context.recommendationReasons;
  const campaign = context.campaign;

  let explanation = `**Why We Recommended "${campaign.title}"**\n\n`;

  // Match score interpretation
  if (score >= 70) {
    explanation += `This campaign is an excellent match for you with a ${score.toFixed(1)}% compatibility score. `;
  } else if (score >= 50) {
    explanation += `This campaign is a good match for you with a ${score.toFixed(1)}% compatibility score. `;
  } else {
    explanation += `This campaign has a ${score.toFixed(1)}% compatibility score with your profile. `;
  }

  // Add specific reasons
  if (reasons && reasons.length > 0) {
    explanation += `Here's why:\n\n`;
    reasons.forEach((reason, index) => {
      explanation += `${index + 1}. ${reason}\n`;
    });
  }

  // User profile alignment
  if (context.userProfile) {
    const profile = context.userProfile;
    
    if (profile.preferred_categories.length > 0 && profile.preferred_categories.includes(campaign.category)) {
      explanation += `\nThis aligns with your interest in ${campaign.category} projects. `;
    }

    if (profile.preferred_regions.length > 0 && profile.preferred_regions.includes(campaign.location)) {
      explanation += `The project's location in ${campaign.location} matches your regional preferences. `;
    }

    if (profile.risk_tolerance) {
      const riskMatch = checkRiskTolerance(
        context.riskAnalysis?.risk_level || 'MEDIUM',
        profile.risk_tolerance
      );
      if (riskMatch) {
        explanation += `The risk level is appropriate for your ${profile.risk_tolerance.toLowerCase()} risk tolerance. `;
      }
    }
  }

  // Add reason tags
  if (reason_tags && reason_tags.length > 0) {
    explanation += `\n\nKey highlights: ${reason_tags.join(', ')}.`;
  }

  return explanation;
}

/**
 * Explain what factors influenced the AI's advice
 */
function explainAIFactors(context: InternalContext): string {
  let explanation = `**AI Decision Factors**\n\n`;
  
  const factors: string[] = [];

  // Campaign performance factors
  if (context.campaign) {
    factors.push(`Campaign metrics including funding progress, investor count, and deadline proximity`);
  }

  // Risk analysis factors
  if (context.riskAnalysis) {
    factors.push(`Risk assessment based on ${context.riskAnalysis.risk_level.toLowerCase()} risk level and score of ${context.riskAnalysis.final_risk_score}/100`);
  }

  // User preference factors
  if (context.userProfile) {
    const profile = context.userProfile;
    const prefFactors: string[] = [];
    
    if (profile.preferred_categories.length > 0) {
      prefFactors.push(`your category preferences (${profile.preferred_categories.length} categories)`);
    }
    if (profile.preferred_regions.length > 0) {
      prefFactors.push(`your regional preferences (${profile.preferred_regions.length} regions)`);
    }
    if (profile.risk_tolerance) {
      prefFactors.push(`your ${profile.risk_tolerance.toLowerCase()} risk tolerance`);
    }
    if (profile.total_invested > 0) {
      prefFactors.push(`your investment history (${profile.total_invested.toLocaleString()} FC invested)`);
    }

    if (prefFactors.length > 0) {
      factors.push(`Personalization based on ${prefFactors.join(', ')}`);
    }
  }

  // Funding statistics factors
  if (context.fundingStats) {
    factors.push(`Market dynamics including recent investment trends and funding momentum`);
  }

  // Recommendation algorithm factors
  if (context.recommendationReasons) {
    factors.push(`Weighted scoring algorithm considering risk (40%), category match (25%), region (15%), and popularity (20%)`);
  }

  if (factors.length > 0) {
    explanation += `Our AI considered the following factors:\n\n`;
    factors.forEach((factor, index) => {
      explanation += `${index + 1}. ${factor}\n`;
    });
  } else {
    explanation += `Limited context available for detailed analysis.`;
  }

  explanation += `\nThe recommendation system uses machine learning to balance multiple factors and provide personalized suggestions that match your investment goals and risk profile.`;

  return explanation;
}

/**
 * Check if risk level matches user's tolerance
 */
function checkRiskTolerance(campaignRisk: string, userTolerance: string): boolean {
  const riskLevels = { 'LOW': 0, 'MEDIUM': 1, 'HIGH': 2 };
  const campaignLevel = riskLevels[campaignRisk as keyof typeof riskLevels] ?? 1;
  const toleranceLevel = riskLevels[userTolerance as keyof typeof riskLevels] ?? 1;
  
  return campaignLevel <= toleranceLevel;
}

/**
 * Generate a short summary explanation (1-2 sentences)
 */
export function generateShortExplanation(context: InternalContext): string {
  if (!context.campaign) {
    return 'Unable to generate explanation without campaign context.';
  }

  let summary = `${context.campaign.title} is `;

  // Risk summary
  if (context.riskAnalysis) {
    const risk = context.riskAnalysis.risk_level.toLowerCase();
    summary += `a ${risk} risk campaign `;
  }

  // Category and location
  summary += `in the ${context.campaign.category} category`;
  if (context.campaign.location) {
    summary += ` located in ${context.campaign.location}`;
  }

  // Funding status
  const fundingProgress = context.campaign.funding_goal > 0
    ? (context.campaign.current_funding / context.campaign.funding_goal) * 100
    : 0;
  
  if (fundingProgress > 75) {
    summary += `, nearly reaching its funding goal`;
  } else if (fundingProgress > 50) {
    summary += `, with strong funding momentum`;
  }

  // Recommendation match
  if (context.recommendationReasons && context.recommendationReasons.score >= 70) {
    summary += `. It's an excellent match for your investment profile`;
  } else if (context.recommendationReasons && context.recommendationReasons.score >= 50) {
    summary += `. It's a good fit for your interests`;
  }

  summary += '.';

  return summary;
}
