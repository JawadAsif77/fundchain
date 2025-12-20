import React from 'react';

/**
 * EscrowFlow - Visual component showing FC token flow through escrow system
 * User Wallet → Locked FC → Campaign Escrow → Creator Wallet
 */
const EscrowFlow = ({ 
  userBalance = 0, 
  userLocked = 0, 
  campaignEscrow = 0, 
  creatorBalance = 0,
  animated = false 
}) => {
  const boxStyle = {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '2px solid #e5e7eb',
    textAlign: 'center',
    minWidth: '150px'
  };

  const arrowStyle = {
    fontSize: '32px',
    color: '#29C7AC',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    animation: animated ? 'pulse 2s ease-in-out infinite' : 'none'
  };

  return (
    <div style={{ padding: '20px 0' }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
          }
        `}
      </style>
      
      <h3 style={{ 
        fontSize: '20px', 
        fontWeight: 'bold', 
        marginBottom: '24px',
        color: '#111827',
        textAlign: 'center'
      }}>
        💰 Escrow Flow Visualization
      </h3>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '0px'
      }}>
        {/* User Wallet */}
        <div style={boxStyle}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>👤</div>
          <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px', color: '#111827' }}>
            User Wallet
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#29C7AC', marginBottom: '4px' }}>
            {userBalance.toLocaleString()} FC
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Available Balance</div>
        </div>

        {/* Arrow 1 */}
        <div style={arrowStyle}>→</div>

        {/* Locked FC */}
        <div style={{...boxStyle, borderColor: '#f59e0b', backgroundColor: '#fffbeb'}}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
          <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px', color: '#111827' }}>
            Locked FC
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '4px' }}>
            {userLocked.toLocaleString()} FC
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Invested Amount</div>
        </div>

        {/* Arrow 2 */}
        <div style={arrowStyle}>→</div>

        {/* Campaign Escrow */}
        <div style={{...boxStyle, borderColor: '#3b82f6', backgroundColor: '#eff6ff'}}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏦</div>
          <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px', color: '#111827' }}>
            Campaign Escrow
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '4px' }}>
            {campaignEscrow.toLocaleString()} FC
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Held in Escrow</div>
        </div>

        {/* Arrow 3 */}
        <div style={arrowStyle}>→</div>

        {/* Creator Wallet */}
        <div style={{...boxStyle, borderColor: '#10b981', backgroundColor: '#f0fdf4'}}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎯</div>
          <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px', color: '#111827' }}>
            Creator Wallet
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginBottom: '4px' }}>
            {creatorBalance.toLocaleString()} FC
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Released Funds</div>
        </div>
      </div>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        textAlign: 'center'
      }}>
        <p style={{ 
          margin: 0, 
          fontSize: '14px', 
          color: '#6b7280',
          lineHeight: '1.6'
        }}>
          <strong style={{ color: '#111827' }}>How it works:</strong> When investors fund campaigns, their FC is locked and held in escrow. 
          As milestones are completed and approved by admins, funds are released to the creator's wallet.
        </p>
      </div>
    </div>
  );
};

export default EscrowFlow;
