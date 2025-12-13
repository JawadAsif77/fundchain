import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * TransactionHistory - Display token_transactions with filtering
 * Supports filtering by campaignId, userId, and type
 */
const TransactionHistory = ({ 
  campaignId = null, 
  userId = null, 
  type = null,
  limit = 50 
}) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTransactions();
  }, [campaignId, userId, type]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError('');

      let query = supabase
        .from('token_transactions')
        .select(`
          *,
          campaigns:campaign_id (title, slug),
          milestones:milestone_id (title),
          users:user_id (email, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setTransactions(data || []);
    } catch (err) {
      console.error('Error loading transactions:', err);
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (txType) => {
    switch (txType) {
      case 'invest_fc':
        return '📈';
      case 'release_fc':
        return '🔓';
      case 'refund_fc':
        return '↩️';
      default:
        return '💱';
    }
  };

  const getTypeColor = (txType) => {
    switch (txType) {
      case 'invest_fc':
        return '#3b82f6';
      case 'release_fc':
        return '#10b981';
      case 'refund_fc':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getTypeLabel = (txType) => {
    switch (txType) {
      case 'invest_fc':
        return 'Investment';
      case 'release_fc':
        return 'Milestone Release';
      case 'refund_fc':
        return 'Refund';
      default:
        return txType;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: '#6b7280'
      }}>
        Loading transactions...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        color: '#dc2626'
      }}>
        {error}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div style={{
        padding: '60px 20px',
        textAlign: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: '12px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
        <h3 style={{ 
          margin: '0 0 8px 0', 
          fontSize: '18px', 
          color: '#374151' 
        }}>
          No transactions yet
        </h3>
        <p style={{ 
          margin: 0, 
          fontSize: '14px', 
          color: '#6b7280' 
        }}>
          Transaction history will appear here
        </p>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: '600',
          color: '#111827'
        }}>
          📊 Transaction History
        </h3>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}>
          <thead>
            <tr style={{
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <th style={tableHeaderStyle}>Type</th>
              <th style={tableHeaderStyle}>Amount</th>
              <th style={tableHeaderStyle}>Campaign</th>
              <th style={tableHeaderStyle}>Details</th>
              <th style={tableHeaderStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr 
                key={tx.id}
                style={{
                  borderBottom: '1px solid #f3f4f6',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={tableCellStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{getTypeIcon(tx.type)}</span>
                    <div>
                      <div style={{ 
                        fontWeight: '500',
                        color: getTypeColor(tx.type)
                      }}>
                        {getTypeLabel(tx.type)}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={tableCellStyle}>
                  <span style={{
                    fontWeight: 'bold',
                    fontSize: '16px',
                    color: '#111827'
                  }}>
                    {tx.amount_fc?.toLocaleString() || 0} FC
                  </span>
                </td>
                <td style={tableCellStyle}>
                  <div style={{ maxWidth: '200px' }}>
                    <div style={{ 
                      fontWeight: '500',
                      color: '#111827',
                      marginBottom: '2px'
                    }}>
                      {tx.campaigns?.title || 'N/A'}
                    </div>
                  </div>
                </td>
                <td style={tableCellStyle}>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    {tx.type === 'release_fc' && tx.milestones && (
                      <div>
                        <strong>Milestone:</strong> {tx.milestones.title}
                      </div>
                    )}
                    {tx.type === 'refund_fc' && tx.metadata?.reason && (
                      <div>
                        <strong>Reason:</strong> {tx.metadata.reason}
                      </div>
                    )}
                    {tx.type === 'invest_fc' && (
                      <div>User Investment</div>
                    )}
                  </div>
                </td>
                <td style={tableCellStyle}>
                  <span style={{ 
                    fontSize: '14px',
                    color: '#6b7280'
                  }}>
                    {formatDate(tx.created_at)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const tableHeaderStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: '600',
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const tableCellStyle = {
  padding: '16px',
  fontSize: '14px',
  color: '#374151'
};

export default TransactionHistory;
