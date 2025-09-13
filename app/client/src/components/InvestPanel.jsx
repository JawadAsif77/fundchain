import React, { useState } from 'react';
import { useAuth } from '../store/AuthContext';

const InvestPanel = ({ campaign }) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState(campaign.minInvest || 1000);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleAmountChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setAmount(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    
    // PHASE 2: Replace with actual investment API call to Supabase
    setTimeout(() => {
      setIsSubmitting(false);
      alert('Investment functionality will be connected to database in Phase 2!');
    }, 1000);
  };

  const isValidAmount = amount >= campaign.minInvest && amount <= campaign.maxInvest;
  const isDisabled = !user || !isValidAmount || campaign.status !== 'live';

  const getDisabledReason = () => {
    if (!user) return 'Please log in to invest';
    if (campaign.status !== 'live') return 'Campaign is not accepting investments';
    if (amount < campaign.minInvest) return `Minimum investment is ${formatCurrency(campaign.minInvest)}`;
    if (amount > campaign.maxInvest) return `Maximum investment is ${formatCurrency(campaign.maxInvest)}`;
    return 'DB connection coming in Phase 2';
  };

  return (
    <div className="invest-form">
      <h3 className="card-title">Invest in This Campaign</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="amount" className="form-label required">
            Investment Amount
          </label>
          <div className="input-group">
            <div className="input-group-prepend">$</div>
            <input
              type="number"
              id="amount"
              className="form-input amount-input"
              value={amount}
              onChange={handleAmountChange}
              min={campaign.minInvest}
              max={campaign.maxInvest}
              step="100"
              disabled={!user || campaign.status !== 'live'}
            />
          </div>
          <div className="investment-limits">
            <span>Min: {formatCurrency(campaign.minInvest)}</span>
            <span>Max: {formatCurrency(campaign.maxInvest)}</span>
          </div>
          {!isValidAmount && (
            <span className="form-error">
              {amount < campaign.minInvest 
                ? `Minimum investment is ${formatCurrency(campaign.minInvest)}`
                : `Maximum investment is ${formatCurrency(campaign.maxInvest)}`
              }
            </span>
          )}
        </div>

        <div className="form-group">
          <div className="card bg-gray-50">
            <h4 className="text-sm font-semibold mb-sm">Investment Summary</h4>
            <div className="stat-item">
              <span className="stat-label">Your Investment:</span>
              <span className="stat-value">{formatCurrency(amount)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Campaign Goal:</span>
              <span className="stat-value">{formatCurrency(campaign.goalAmount)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Current Progress:</span>
              <span className="stat-value">
                {((campaign.raisedAmount / campaign.goalAmount) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="form-actions full-width">
          <button
            type="submit"
            className="btn-primary btn-lg"
            disabled={isDisabled || isSubmitting}
            title={isDisabled ? getDisabledReason() : ''}
          >
            {isSubmitting ? (
              <>
                <span className="loader"></span>
                Processing...
              </>
            ) : (
              `Invest ${formatCurrency(amount)}`
            )}
          </button>
          
          {isDisabled && (
            <div className="text-center">
              <span className="form-help text-warning">
                {getDisabledReason()}
              </span>
            </div>
          )}
        </div>
      </form>

      <div className="mt-lg p-md bg-info text-white rounded text-sm">
        <strong>Phase 2 Note:</strong> Investment processing will be connected to Supabase database 
        in the next phase. This is currently a frontend-only demo.
      </div>
    </div>
  );
};

export default InvestPanel;