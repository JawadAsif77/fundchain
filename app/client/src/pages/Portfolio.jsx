import React, { useEffect, useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { getUserInvestments } from '../services/investmentService';
import { useNavigate } from 'react-router-dom';

const Portfolio = () => {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userId) {
      loadInvestments();
    }
  }, [userId]);

  const loadInvestments = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await getUserInvestments(userId);
      
      if (result.status === 'success') {
        setInvestments(result.investments || []);
      } else {
        setError('Failed to load investments');
      }
    } catch (err) {
      console.error('Failed to load investments:', err);
      setError('Failed to load investments');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalInvested = () => {
    return investments.reduce((total, inv) => total + (inv.amount_fc || 0), 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading portfolio...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ marginBottom: '30px', color: '#333' }}>📊 My Portfolio</h1>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee',
          color: '#c33',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Summary Card */}
      <div style={{
        backgroundColor: '#fff',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '40px',
        border: '2px solid #29C7AC'
      }}>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Total Invested</div>
        <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#29C7AC' }}>
          {calculateTotalInvested().toLocaleString()} FC
        </div>
        <div style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>
          Across {investments.length} campaign{investments.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Investments List */}
      <div>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>My Investments</h2>

        {investments.length === 0 ? (
          <div style={{
            backgroundColor: '#fff',
            padding: '60px 30px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💼</div>
            <h3 style={{ marginBottom: '12px', color: '#666' }}>No Investments Yet</h3>
            <p style={{ color: '#999', marginBottom: '24px' }}>
              Start investing in campaigns to build your portfolio
            </p>
            <button
              onClick={() => navigate('/explore')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#29C7AC',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Explore Campaigns
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {investments.map((investment) => (
              <div
                key={investment.campaign_id + investment.created_at}
                style={{
                  backgroundColor: '#fff',
                  padding: '24px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: '20px',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
                onClick={() => navigate(`/campaign/${investment.campaign_id}`)}
              >
                {/* Campaign Image */}
                {investment.campaigns?.image_url && (
                  <img
                    src={investment.campaigns.image_url}
                    alt={investment.campaigns.title}
                    style={{
                      width: '100px',
                      height: '100px',
                      objectFit: 'cover',
                      borderRadius: '8px'
                    }}
                  />
                )}

                {/* Campaign Info */}
                <div>
                  <h3 style={{ marginBottom: '8px', color: '#333', fontSize: '18px' }}>
                    {investment.campaigns?.title || 'Campaign'}
                  </h3>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                    Invested: <strong style={{ color: '#29C7AC' }}>{investment.amount_fc} FC</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    Date: {formatDate(investment.created_at)}
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  <span style={{
                    padding: '8px 16px',
                    backgroundColor: '#e8f5e9',
                    color: '#2e7d32',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      {investments.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <button
            onClick={loadInvestments}
            style={{
              padding: '12px 24px',
              backgroundColor: '#f0f0f0',
              color: '#666',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh Portfolio
          </button>
        </div>
      )}
    </div>
  );
};

export default Portfolio;
