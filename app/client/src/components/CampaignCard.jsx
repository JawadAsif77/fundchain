import { useNavigate } from 'react-router-dom';
import RiskBadge from '../components/RiskBadge'

const CampaignCard = ({ campaign }) => {
  const navigate = useNavigate();

  // ==============================
  // Risk display logic (manual override aware)
  // ==============================
  const displayedRiskLevel =
  campaign.manual_risk_level || campaign.risk_level;

  const displayedRiskScore =
  campaign.manual_risk_level ? null : campaign.final_risk_score;

  // Add debugging for campaign data
  console.log('🎯 CampaignCard: Received campaign data:', campaign);
  console.log('🎯 CampaignCard: goalAmount:', campaign.goalAmount, 'type:', typeof campaign.goalAmount);
  console.log('🎯 CampaignCard: raisedAmount:', campaign.raisedAmount, 'type:', typeof campaign.raisedAmount);

  const handleClick = () => {
    navigate(`/campaign/${campaign.slug}`);
  };

  const formatCurrency = (amount) => {
    const numAmount = Number(amount) || 0;
    console.log('🎯 CampaignCard: formatCurrency input:', amount, 'converted:', numAmount);
    return `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount)} FC`;
  };

  const calculateProgress = () => {
    const goal = Number(campaign.goalAmount) || 0;
    const raised = Number(campaign.raisedAmount) || 0;
    
    console.log('🎯 CampaignCard: calculateProgress - goal:', goal, 'raised:', raised);
    
    if (goal === 0) {
      console.warn('🎯 CampaignCard: Goal amount is 0, cannot calculate progress');
      return 0;
    }
    
    const progress = Math.min((raised / goal) * 100, 100);
    console.log('🎯 CampaignCard: calculateProgress result:', progress);
    return progress;
  };

  const getStatusBadgeClass = (status) => `status status--${String(status || '').toLowerCase()}`;

  const formatDeadline = (deadlineISO) => {
    if (!deadlineISO) {
      console.warn('🎯 CampaignCard: No deadline provided');
      return 'No deadline';
    }
    
    try {
      const deadline = new Date(deadlineISO);
      const now = new Date();
      
      if (isNaN(deadline.getTime())) {
        console.warn('🎯 CampaignCard: Invalid deadline date:', deadlineISO);
        return 'Invalid date';
      }
      
      const diffTime = deadline - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      console.log('🎯 CampaignCard: formatDeadline - deadline:', deadline, 'diffDays:', diffDays);
      
      if (diffDays < 0) return 'Expired';
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return '1 day left';
      return `${diffDays} days left`;
    } catch (error) {
      console.error('🎯 CampaignCard: Error formatting deadline:', error);
      return 'Invalid date';
    }
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

        <RiskBadge
        level={displayedRiskLevel}
        score={displayedRiskScore}
        />

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