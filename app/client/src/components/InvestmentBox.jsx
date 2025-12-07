import React, { useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { investInCampaign } from '../services/investmentService';

const InvestmentBox = ({ campaignId, campaignStatus, onSuccess }) => {
  const { userId, wallet, refreshWallet } = useAuth();
  const [amount, setAmount] = useState('');
  const [investing, setInvesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInvest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const investAmount = parseFloat(amount);
    
    if (!investAmount || investAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (investAmount > (wallet?.balanceFc || 0)) {
      setError('Insufficient balance');
      return;
    }

    setInvesting(true);
    try {
      const result = await investInCampaign(userId, campaignId, investAmount);
      
      if (result.status === 'success') {
        setSuccess(`Successfully invested ${investAmount} FC!`);
        setAmount('');
        
        // Refresh wallet
        await refreshWallet();
        
        // Notify parent component
        if (onSuccess) {
          onSuccess(investAmount);
        }
      } else {
        setError(result.error || 'Investment failed');
      }
    } catch (err) {
      console.error('Investment failed:', err);
      setError('Failed to process investment. Please try again.');
    } finally {
      setInvesting(false);
    }
  };

  const isDisabled = investing || campaignStatus !== 'active';

  return (
    <div style={{
      backgroundColor: '#f9f9f9',
      padding: '24px',
      borderRadius: '12px',
      border: '2px solid #29C7AC',
      marginTop: '24px'
    }}>
      <h3 style={{ marginBottom: '16px', color: '#333' }}>💰 Invest in this Campaign</h3>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee',
          color: '#c33',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px',
          backgroundColor: '#efe',
          color: '#3c3',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {success}
        </div>
      )}

      <div style={{
        backgroundColor: '#fff',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Your Available Balance</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#29C7AC' }}>
          {wallet?.balanceFc?.toLocaleString() || 0} FC
        </div>
      </div>

      <form onSubmit={handleInvest}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#666' }}>
            Investment Amount (FC)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount to invest"
            min="1"
            step="1"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '16px'
            }}
            disabled={isDisabled}
          />
        </div>

        {campaignStatus !== 'active' && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fff3cd',
            color: '#856404',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            This campaign is not accepting investments
          </div>
        )}

        <button
          type="submit"
          disabled={isDisabled}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: isDisabled ? '#ccc' : '#29C7AC',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!isDisabled) e.currentTarget.style.backgroundColor = '#24b396';
          }}
          onMouseLeave={(e) => {
            if (!isDisabled) e.currentTarget.style.backgroundColor = '#29C7AC';
          }}
        >
          {investing ? 'Processing...' : 'Invest Now'}
        </button>
      </form>

      <div style={{
        marginTop: '16px',
        fontSize: '12px',
        color: '#999',
        textAlign: 'center'
      }}>
        Your investment will be locked until campaign milestones are met
      </div>
    </div>
  );
};

export default InvestmentBox;
