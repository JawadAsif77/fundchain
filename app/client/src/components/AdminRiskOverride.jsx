import React, { useState } from 'react';
import { adminApi } from '../lib/api';

const AdminRiskOverride = ({ campaign, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(campaign.manual_risk_level || '');

  const handleOverride = async () => {
    if (!selectedLevel) {
      alert('Please select a risk level');
      return;
    }
    
    setLoading(true);
    try {
      const result = await adminApi.setManualRiskLevel(campaign.id, selectedLevel);
      
      if (result.success) {
        alert('✅ Manual risk level set successfully');
        if (onUpdate) onUpdate(result.data);
      } else {
        alert(`❌ Failed: ${result.error}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Clear manual override and return to AI analysis?')) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await adminApi.clearManualRiskLevel(campaign.id);
      
      if (result.success) {
        alert('✅ Manual override cleared. Using AI analysis.');
        if (onUpdate) onUpdate(result.data);
      } else {
        alert(`❌ Failed: ${result.error}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: '2rem', padding: '1.5rem', border: '2px solid #ff6b35' }}>
      <h4 style={{ color: '#ff6b35', marginBottom: '1rem' }}>
        🛡️ Admin: Manual Risk Override
      </h4>
      
      <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>AI Risk Analysis:</strong>{' '}
          {campaign.risk_level ? (
            <>
              <span style={{ textTransform: 'capitalize' }}>{campaign.risk_level}</span>
              {campaign.final_risk_score && ` (${campaign.final_risk_score}%)`}
            </>
          ) : (
            'Not analyzed yet'
          )}
        </p>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Manual Override:</strong>{' '}
          <span style={{ color: campaign.manual_risk_level ? '#ff6b35' : '#666' }}>
            {campaign.manual_risk_level ? (
              <span style={{ textTransform: 'capitalize' }}>{campaign.manual_risk_level}</span>
            ) : (
              'None (using AI analysis)'
            )}
          </span>
        </p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Set Manual Risk Level:
        </label>
        <select 
          value={selectedLevel} 
          onChange={(e) => setSelectedLevel(e.target.value)}
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '0.75rem', 
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '1rem'
          }}
        >
          <option value="">-- Select Risk Level --</option>
          <option value="low">🟢 Low Risk</option>
          <option value="medium">🟡 Medium Risk</option>
          <option value="high">🔴 High Risk</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button 
          onClick={handleOverride} 
          disabled={!selectedLevel || loading}
          className="btn btn-primary"
          style={{ 
            flex: 1, 
            minWidth: '150px',
            opacity: (!selectedLevel || loading) ? 0.5 : 1,
            cursor: (!selectedLevel || loading) ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ Saving...' : '✓ Override Risk Level'}
        </button>
        
        {campaign.manual_risk_level && (
          <button 
            onClick={handleClear} 
            disabled={loading}
            className="btn btn-secondary"
            style={{ 
              flex: 1, 
              minWidth: '150px',
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '⏳ Clearing...' : '↺ Clear Override'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminRiskOverride;
