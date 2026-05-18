import { useNavigate } from 'react-router-dom';
import RiskBadge from '../components/RiskBadge'
import { supabase } from '../lib/supabase';
import { safeLogger } from '../utils/safeLogger';
import { useAuth } from '../store/AuthContext';

const CampaignCard = ({ campaign }) => {
  const navigate = useNavigate();
  const { userId } = useAuth();

  // ==============================
  // Risk display logic (manual override aware)
  // ==============================
  const displayedRiskLevel =
  campaign.manual_risk_level || campaign.risk_level;

  const displayedRiskScore =
  campaign.manual_risk_level ? null : campaign.final_risk_score;

  const handleClick = () => {
    // Fire & forget: Log click event (don't block navigation)
    if (userId && campaign.id) {
      supabase
        .from('recommendation_events')
        .insert({
          user_id: userId,
          campaign_id: campaign.id,
          event_type: 'click',
          source: 'campaign_card'
        })
        .then(({ error }) => {
          if (error) {
            safeLogger.warn('Failed to log click event');
          }
        })
        .catch(() => {
          safeLogger.warn('Click event logging error');
        });
    }

    // Navigate immediately (don't wait for logging)
    navigate(`/campaign/${campaign.slug}`);
  };

  const formatCurrency = (amount) => {
    const numAmount = Number(amount) || 0;
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount)} FC`;
  };

  const calculateProgress = () => {
    const goal = Number(campaign.goalAmount) || 0;
    const raised = Number(campaign.raisedAmount) || 0;
    
    if (goal === 0) {
      return 0;
    }
    
    const progress = Math.min((raised / goal) * 100, 100);
    return progress;
  };

  const getStatusBadgeClass = (status) => `status status--${String(status || '').toLowerCase()}`;

  const formatDeadline = (deadlineISO) => {
    if (!deadlineISO) {
      return 'No deadline';
    }
    
    try {
      const deadline = new Date(deadlineISO);
      const now = new Date();
      
      if (isNaN(deadline.getTime())) {
        return 'Invalid date';
      }
      
      const diffTime = deadline - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return 'Expired';
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return '1 day left';
      return `${diffDays} days left`;
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <div 
      className="card card--interactive campaign-card" 
      onClick={handleClick}
    >
      {/* Campaign Image */}
      <div className="campaign-image">
        {campaign.image_url ? (
          <img 
            src={campaign.image_url} 
            alt={campaign.title}
            onError={(e) => {
              // Fallback to placeholder if image fails to load
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-muted); font-size: var(--text-sm);">No Image</div>';
            }}
          />
        ) : (
          <div className="campaign-image__placeholder">
            No Image
          </div>
        )}
      </div>

      {/* Campaign Meta */}
      <div className="campaign-meta">
        <span className="badge badge--primary">{campaign.category}</span>
        {campaign.status && (
          <span className={getStatusBadgeClass(campaign.status)}>
            {campaign.status}
          </span>
        )}
      </div>

      {/* Campaign Content */}
      <div className="campaign-content">
        <h3 className="campaign-title">
          {campaign.title}
        </h3>

        <RiskBadge
          level={displayedRiskLevel}
          score={displayedRiskScore}
        />

        <p className="campaign-summary">
          {campaign.summary}
        </p>
      </div>

      {/* Campaign Stats */}
      <div className="campaign-stats">
        <div className="stat-item">
          <span className="stat-label">Goal</span>
          <span className="stat-value">
            {formatCurrency(campaign.goalAmount)}
          </span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">Raised</span>
          <span className="stat-value">
            {formatCurrency(campaign.raisedAmount)}
          </span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">Deadline</span>
          <span className="stat-value">
            {formatDeadline(campaign.deadlineISO)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress">
        <span style={{ width: `${calculateProgress()}%` }}></span>
      </div>
      
      <div className="progress-info">
        <span>{Math.round(calculateProgress())}% funded</span>
        <span>{campaign.region}</span>
      </div>
    </div>
  );
};

export default CampaignCard;