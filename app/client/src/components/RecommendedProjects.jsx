import { useState, useEffect, useCallback } from 'react';
import { getRecommendedProjects, logRecommendationEvent } from '../services/recommendations';
import { useAuth } from '../store/AuthContext';
import CampaignCard from './CampaignCard';
import Loader from './Loader';

const RecommendedProjects = ({ title = "Recommended For You" }) => {
  const { profile, user, loading: authLoading } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRecommendations = useCallback(async () => {
    // Don't load if auth is still loading or user not available
    if (authLoading || !user) {
      console.log('⏳ Waiting for authentication...');
      setLoading(true);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Build filters dynamically from user profile
      const filters = {
        max_risk_level: 'LOW',
        ...(profile?.region && { region: profile.region })
      };
      const limit = 5;
      
      const data = await getRecommendedProjects(filters, limit);
      setRecommendations(data);
      
    } catch (err) {
      console.error('Error loading recommendations:', err);
      setError(err.message || 'Failed to load recommendations');
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [profile, user, authLoading]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const handleCampaignClick = async (campaignId, position) => {
    // Log the click event for analytics
    await logRecommendationEvent(campaignId, 'click', { position });
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <Loader />
        <p style={{ marginTop: '16px', color: '#718096' }}>Finding projects you&apos;ll love...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: '#FFF5F5',
        borderRadius: '12px',
        border: '1px solid #FEB2B2'
      }}>
        <p style={{ color: '#C53030', marginBottom: '16px' }}>❌ {error}</p>
        <button
          onClick={loadRecommendations}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4299E1',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (recommendations.length === 0) {
    return (
      <div style={{
        padding: '60px 40px',
        textAlign: 'center',
        backgroundColor: '#F7FAFC',
        borderRadius: '12px',
        border: '1px solid #E2E8F0'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', color: '#2D3748' }}>
          No Recommendations Yet
        </h3>
        <p style={{ color: '#718096', marginBottom: '24px' }}>
          Start investing in campaigns to get personalized recommendations based on your interests!
        </p>
        <a
          href="/explore"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#4299E1',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Explore All Campaigns
        </a>
      </div>
    );
  }

  // Success state - render recommendations
  return (
    <div style={{ width: '100%' }}>
      {/* Section Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#2D3748',
            marginBottom: '4px'
          }}>
            {title}
          </h2>
          <p style={{ color: '#718096', fontSize: '14px' }}>
            Based on your interests and investment history • Low risk only
          </p>
        </div>
        <button
          onClick={loadRecommendations}
          style={{
            padding: '8px 16px',
            backgroundColor: '#F7FAFC',
            color: '#4299E1',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
          title="Refresh recommendations"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Recommendations Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '24px'
      }}>
        {recommendations.map((rec, index) => {
          // Transform recommendation data to match CampaignCard props
          const campaign = {
            id: rec.campaign_id,
            slug: rec.slug || rec.campaign_id, // Use actual slug from API
            title: rec.title,
            summary: rec.reasons?.join(' • ') || '',
            category: rec.category,
            goalAmount: rec.funding_goal || 0,
            raisedAmount: rec.current_funding || 0,
            region: rec.region,
            status: 'active',
            riskScore: rec.final_risk_score ? Math.round(rec.final_risk_score * 100) : null
          };

          return (
            <div
              key={rec.campaign_id}
              onClick={() => handleCampaignClick(rec.campaign_id, index + 1)}
              style={{ position: 'relative' }}
            >
              {/* Recommendation Badge */}
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 10,
                backgroundColor: '#4299E1',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                ⭐ {rec.recommendation_score} pts
              </div>

              {/* Risk Badge (if available) */}
              {rec.risk_level && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  zIndex: 10,
                  backgroundColor: rec.risk_level === 'LOW' ? '#48BB78' : rec.risk_level === 'MEDIUM' ? '#ED8936' : '#F56565',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  {rec.risk_level}
                </div>
              )}

              <CampaignCard campaign={campaign} />

              {/* Recommendation Reasons */}
              {rec.reasons && rec.reasons.length > 0 && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: '#EBF8FF',
                  borderRadius: '8px',
                  border: '1px solid #BEE3F8'
                }}>
                  <p style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#2C5282',
                    marginBottom: '6px'
                  }}>
                    Why we recommend this:
                  </p>
                  <ul style={{
                    margin: 0,
                    paddingLeft: '20px',
                    fontSize: '12px',
                    color: '#2D3748'
                  }}>
                    {rec.reasons.slice(0, 3).map((reason, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* View More Link */}
      {recommendations.length >= 5 && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <a
            href="/explore"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: 'white',
              color: '#4299E1',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              border: '2px solid #4299E1',
              transition: 'all 0.2s'
            }}
          >
            View All Campaigns →
          </a>
        </div>
      )}
    </div>
  );
};

export default RecommendedProjects;
