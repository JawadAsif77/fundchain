import React from 'react';
import { useNavigate } from 'react-router-dom';
import RecommendationReasons from './RecommendationReasons';
import RiskBadge from './RiskBadge';

const RecommendedProjectCard = ({ recommendation }) => {
  const navigate = useNavigate();
  
  if (!recommendation || !recommendation.campaign) {
    return null;
  }

  const { campaign, score, reasons, reason_tags } = recommendation;

  const handleClick = () => {
    navigate(`/campaign/${campaign.slug}`);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const fundingProgress = campaign.funding_goal > 0 
    ? (campaign.current_funding / campaign.funding_goal) * 100 
    : 0;

  return (
    <div 
      className="card hover-lift" 
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <h3 className="card-title" style={{ marginBottom: '0.5rem' }}>
            {campaign.title}
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.875rem', color: '#718096' }}>
            <span>📍 {campaign.region}</span>
            <span>📂 {campaign.category}</span>
          </div>
        </div>
        
        {/* Recommendation Score Badge */}
        <div 
          style={{ 
            backgroundColor: score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#6B7280',
            color: 'white',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            fontWeight: 'bold',
            fontSize: '0.875rem',
            textAlign: 'center',
            minWidth: '60px'
          }}
        >
          {score.toFixed(1)}
          <div style={{ fontSize: '0.625rem', fontWeight: 'normal', marginTop: '0.125rem' }}>
            Match
          </div>
        </div>
      </div>

      {/* Risk Badge */}
      {campaign.risk_level && (
        <div style={{ marginBottom: '0.75rem' }}>
          <RiskBadge risk={campaign.risk_level} />
        </div>
      )}

      {/* Funding Progress */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
          <span style={{ color: '#4A5568', fontWeight: '500' }}>
            {formatCurrency(campaign.current_funding)} raised
          </span>
          <span style={{ color: '#718096' }}>
            {fundingProgress.toFixed(1)}%
          </span>
        </div>
        <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
          <div 
            style={{ 
              width: `${Math.min(fundingProgress, 100)}%`, 
              height: '100%', 
              backgroundColor: '#10B981',
              transition: 'width 0.3s ease'
            }}
          />
        </div>
        <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.25rem' }}>
          Goal: {formatCurrency(campaign.funding_goal)}
        </div>
      </div>

      {/* Recommendation Reasons */}
      <RecommendationReasons reasons={reasons} tags={reason_tags} />
    </div>
  );
};

export default RecommendedProjectCard;
