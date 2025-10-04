import React from 'react';
import { useNavigate } from 'react-router-dom';

const CampaignCard = ({ campaign }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/campaign/${campaign.slug}`);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculateProgress = () => {
    return Math.min((campaign.raisedAmount / campaign.goalAmount) * 100, 100);
  };

  const getRiskBadgeClass = (riskScore) => {
    if (riskScore <= 30) return 'badge badge--risk-low';
    if (riskScore <= 60) return 'badge badge--risk-medium';
    return 'badge badge--risk-high';
  };

  const getRiskLabel = (riskScore) => {
    if (riskScore <= 30) return 'Low Risk';
    if (riskScore <= 60) return 'Medium Risk';
    return 'High Risk';
  };

  const getStatusBadgeClass = (status) => `status status--${String(status || '').toLowerCase()}`;

  const formatDeadline = (deadlineISO) => {
    const deadline = new Date(deadlineISO);
    const now = new Date();
    const diffTime = deadline - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day left';
    return `${diffDays} days left`;
  };

  return (
    <div 
      className="card card--interactive" 
      onClick={handleClick}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Campaign Image */}
      <div style={{
        width: '100%',
        height: '200px',
        backgroundColor: 'var(--color-bg-elev)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 'var(--space-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-muted)',
        fontSize: 'var(--text-sm)'
      }}>
        Project Image
      </div>

      {/* Campaign Meta */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-2)',
        flexWrap: 'wrap'
      }}>
        <span className="badge badge--primary">{campaign.category}</span>
        <span className={getRiskBadgeClass(campaign.riskScore)}>
          {getRiskLabel(campaign.riskScore)}
        </span>
        {campaign.status && (
          <span className={getStatusBadgeClass(campaign.status)}>
            {campaign.status}
          </span>
        )}
      </div>

      {/* Campaign Content */}
      <div style={{ flex: 1, marginBottom: 'var(--space-3)' }}>
        <h3 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--color-text)',
          marginBottom: 'var(--space-2)',
          lineHeight: 'var(--leading-snug)'
        }}>
          {campaign.title}
        </h3>
        
        <p style={{
          color: 'var(--color-muted)',
          fontSize: 'var(--text-sm)',
          lineHeight: 'var(--leading-relaxed)',
          marginBottom: 'var(--space-3)'
        }}>
          {campaign.summary}
        </p>
      </div>

      {/* Campaign Stats */}
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-1)',
          fontSize: 'var(--text-sm)'
        }}>
          <span style={{ color: 'var(--color-muted)' }}>Goal</span>
          <span style={{ 
            fontWeight: 'var(--font-semibold)', 
            color: 'var(--color-text)' 
          }}>
            {formatCurrency(campaign.goalAmount)}
          </span>
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-1)',
          fontSize: 'var(--text-sm)'
        }}>
          <span style={{ color: 'var(--color-muted)' }}>Raised</span>
          <span style={{ 
            fontWeight: 'var(--font-semibold)', 
            color: 'var(--color-text)' 
          }}>
            {formatCurrency(campaign.raisedAmount)}
          </span>
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-2)',
          fontSize: 'var(--text-sm)'
        }}>
          <span style={{ color: 'var(--color-muted)' }}>Deadline</span>
          <span style={{ 
            fontWeight: 'var(--font-semibold)', 
            color: 'var(--color-text)' 
          }}>
            {formatDeadline(campaign.deadlineISO)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress">
        <span style={{ width: `${calculateProgress()}%` }}></span>
      </div>
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 'var(--text-sm)',
        color: 'var(--color-muted)',
        marginTop: 'var(--space-1)'
      }}>
        <span>{Math.round(calculateProgress())}% funded</span>
        <span>{campaign.region}</span>
      </div>
    </div>
  );
};

export default CampaignCard;