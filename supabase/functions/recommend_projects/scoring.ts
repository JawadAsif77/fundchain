export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export const RECOMMENDATION_WEIGHTS = {
	risk: 0.4,
	category: 0.25,
	region: 0.15,
	popularity: 0.2
}

// Helper: Get risk level numeric value for comparisons.
export function getRiskValue(level: RiskLevel | null): number {
	if (!level) return 1 // Default to MEDIUM
	if (level === 'LOW') return 0
	if (level === 'MEDIUM') return 1
	return 2 // HIGH
}

// Helper: Check if campaign passes risk filter.
export function passesRiskFilter(
	campaignRisk: RiskLevel | null,
	userTolerance: RiskLevel,
	maxRiskFilter?: RiskLevel
): boolean {
	// Apply user-specified max risk filter if provided.
	const effectiveMaxRisk = maxRiskFilter || userTolerance

	// If no risk level, allow it (will get penalty in scoring).
	if (!campaignRisk) return true

	const campaignValue = getRiskValue(campaignRisk)
	const maxValue = getRiskValue(effectiveMaxRisk)

	return campaignValue <= maxValue
}

/**
 * Score based on risk alignment (0-1).
 * Returns 1 if project risk <= max risk, decreases for higher risk.
 */
export function scoreRisk(projectRisk: RiskLevel | null, maxRisk: RiskLevel): number {
	if (!projectRisk) return 0.5 // Neutral score for unanalyzed projects

	const projectValue = getRiskValue(projectRisk)
	const maxValue = getRiskValue(maxRisk)

	if (projectValue <= maxValue) return 1.0
	if (projectValue === maxValue + 1) return 0.3
	return 0.0
}

/**
 * Score based on category match (0-1).
 * Returns 1 if category matches user preferences, 0 otherwise.
 */
export function scoreCategory(projectCategory: string, preferredCategories: string[]): number {
	if (preferredCategories.length === 0) return 0.5 // Neutral if no preferences
	return preferredCategories.includes(projectCategory) ? 1.0 : 0.0
}

/**
 * Score based on region match (0-1).
 * Returns 1 if region matches, 0.5 if no region specified, 0 otherwise.
 */
export function scoreRegion(projectRegion: string | null, userRegion: string[]): number {
	if (!projectRegion) return 0.5 // Neutral if no region specified
	if (userRegion.length === 0) return 0.5 // Neutral if user has no region preference
	return userRegion.includes(projectRegion) ? 1.0 : 0.0
}

/**
 * Score based on popularity metrics (0-1).
 * Combines investor count and funding ratio.
 */
export function scorePopularity(investorCount: number, fundingRatio: number): number {
	// Normalize investor count (assume 50+ investors is max popularity).
	const investorScore = Math.min(investorCount / 50, 1.0)

	// Funding ratio score (prefer 20-80% funded).
	let fundingScore = 0
	if (fundingRatio >= 0.2 && fundingRatio <= 0.8) {
		fundingScore = 1.0
	} else if (fundingRatio > 0.8) {
		fundingScore = 0.5 // Nearly funded
	} else if (fundingRatio > 0.1) {
		fundingScore = 0.7 // Some traction
	} else {
		fundingScore = 0.3 // Very early
	}

	// Combine both metrics (weighted average).
	return (investorScore * 0.4) + (fundingScore * 0.6)
}
