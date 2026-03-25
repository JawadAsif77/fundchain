import type { RiskLevel } from './scoring.ts'

export interface ExplainInputs {
	categoryScore: number
	regionScore: number
	riskScore: number
	popularityScore: number
	fundingRatio: number
	campaignCategoryName?: string
	campaignLocation: string | null
	campaignRiskLevel: RiskLevel | null
	investorCount: number
}

const REASON_TAGS = {
	lowRisk: 'Low risk profile',
	mediumRisk: 'Medium risk profile',
	regionMatch: 'Located in your preferred region',
	categoryMatch: 'Matches your investment interests',
	popularProject: 'Popular among investors'
}

export function buildRecommendationExplanation(inputs: ExplainInputs): {
	reasons: string[]
	reason_tags: string[]
} {
	const {
		categoryScore,
		regionScore,
		riskScore,
		popularityScore,
		fundingRatio,
		campaignCategoryName,
		campaignLocation,
		campaignRiskLevel,
		investorCount,
	} = inputs

	// Generate human-readable reasons.
	const reasons: string[] = []
	if (categoryScore === 1.0) {
		reasons.push(`Matches your interest in ${campaignCategoryName || 'this category'}`)
	}
	if (regionScore === 1.0) {
		reasons.push(`Located in your preferred region: ${campaignLocation}`)
	}
	if (riskScore === 1.0) {
		reasons.push(`Risk level (${campaignRiskLevel}) matches your tolerance`)
	}
	if (fundingRatio > 0.2 && fundingRatio < 0.8) {
		reasons.push(`${Math.floor(fundingRatio * 100)}% funded - gaining traction`)
	}
	if ((investorCount || 0) > 10) {
		reasons.push(`Popular with ${investorCount} investors`)
	}

	// Generate reason tags (limit to 3).
	const reason_tags: string[] = []

	// Add risk tag.
	if (campaignRiskLevel === 'LOW') {
		reason_tags.push(REASON_TAGS.lowRisk)
	} else if (campaignRiskLevel === 'MEDIUM') {
		reason_tags.push(REASON_TAGS.mediumRisk)
	}

	// Add category match tag.
	if (categoryScore === 1.0 && reason_tags.length < 3) {
		reason_tags.push(REASON_TAGS.categoryMatch)
	}

	// Add region match tag.
	if (regionScore === 1.0 && reason_tags.length < 3) {
		reason_tags.push(REASON_TAGS.regionMatch)
	}

	// Add popularity tag.
	if (popularityScore > 0.6 && reason_tags.length < 3) {
		reason_tags.push(REASON_TAGS.popularProject)
	}

	return { reasons, reason_tags }
}
