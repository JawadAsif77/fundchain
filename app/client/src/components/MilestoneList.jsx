import React, { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { milestoneVotingApi, milestoneApi, milestoneUpdateApi } from '../lib/api';
import { useEscrowActions } from '../hooks/useEscrowActions';

// debug flag: true in Vite development mode
const debug = typeof import.meta !== 'undefined' && !!import.meta.env && !!import.meta.env.DEV;

const MilestoneList = ({ milestones, campaignId, showVoting = false, campaignGoal = null, isCreator: isCreatorProp, isAdmin: isAdminProp }) => {
  const { userId, profile } = useAuth();
  // allow parent to override role flags; otherwise infer from profile
  const isAdmin = typeof isAdminProp !== 'undefined' ? isAdminProp : profile?.role === 'admin';
  const isCreator = typeof isCreatorProp !== 'undefined' ? isCreatorProp : profile?.role === 'creator';
  const { releaseMilestone, releaseLoading } = useEscrowActions();
  const [userVotes, setUserVotes] = useState({});
  const [voteStats, setVoteStats] = useState({});
  const [canVote, setCanVote] = useState(false);
  const [votingMilestone, setVotingMilestone] = useState(null);
  const [localMilestones, setLocalMilestones] = useState(milestones || []);

  useEffect(() => {
    setLocalMilestones(milestones || []);
  }, [milestones]);

  useEffect(() => {
    if (showVoting && userId && campaignId) {
      loadVotingData();
    }
  }, [showVoting, userId, campaignId, localMilestones]);

  const loadVotingData = async () => {
    try {
      // Check if user can vote
      const canVoteResult = await milestoneVotingApi.canUserVote(campaignId, userId);
      setCanVote(canVoteResult);

      // Load user's votes and stats for each milestone
      const votes = {};
      const stats = {};
      
      for (const milestone of localMilestones || []) {
        const userVote = await milestoneVotingApi.getUserVote(milestone.id, userId);
        const milestoneStats = await milestoneVotingApi.getVoteStats(milestone.id);
        votes[milestone.id] = userVote;
        stats[milestone.id] = milestoneStats;
      }
      
      setUserVotes(votes);
      setVoteStats(stats);
    } catch (err) {
      console.error('Error loading voting data:', err);
    }
  };

  const handleVote = async (milestoneId, vote) => {
    setVotingMilestone(milestoneId);
    try {
      await milestoneVotingApi.submitVote(milestoneId, campaignId, vote);
      await loadVotingData();
      alert(vote ? 'Milestone approved!' : 'Milestone rejected!');
    } catch (err) {
      alert(err.message || 'Failed to submit vote');
    } finally {
      setVotingMilestone(null);
    }
  };

  const handleAdminStartVoting = async (milestoneId) => {
    try {
      await milestoneApi.adminStartVoting(milestoneId);
      setLocalMilestones((prev) =>
        (prev || []).map((m) =>
          m.id === milestoneId ? { ...m, targetDate: new Date().toISOString() } : m
        )
      );
      await loadVotingData();
      alert('Voting started for milestone. Investors can now vote.');
    } catch (err) {
      console.error('Failed to start voting:', err);
      alert('Failed to start voting: ' + (err.message || String(err)));
    }
  };

  const handleAdminRelease = async (milestoneId, amount) => {
    if (!campaignId) return;
    try {
      // Check approval consensus
      const stats = voteStats[milestoneId];
      if (stats && stats.consensus !== 'approved') {
        alert('Cannot release: milestone not approved by investors');
        return;
      }

      const hasUpdates = await milestoneUpdateApi.milestoneHasUpdates(campaignId);
      // prefer to call release via escrow hook which calls edge function
      await releaseMilestone({ campaignId, milestoneId, amountFc: amount, notes: 'Released by admin' });
      setLocalMilestones((prev) =>
        (prev || []).map((m) =>
          m.id === milestoneId ? { ...m, status: 'completed' } : m
        )
      );
      alert('Milestone released successfully');
      // reload voting data and optionally refetch milestones externally
      await loadVotingData();
    } catch (err) {
      console.error('Release failed:', err);
      alert('Release failed: ' + (err.message || String(err)));
    }
  };
  const getStatusBadgeClass = (status) => {
    return `badge status-${status}`;
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in-progress': return 'In Progress';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const formatPayoutPct = (pct) => {
    return `${pct}%`;
  };

  if (!localMilestones || localMilestones.length === 0) {
    return (
      <div className="empty-state">
        <h3>No Milestones</h3>
        <p>No milestones have been defined for this campaign yet.</p>
      </div>
    );
  }

  return (
    <div className="milestone-list">
      <h3 className="mb-lg">Project Milestones</h3>
      {debug && console.debug('[MilestoneList] localMilestones:', localMilestones)}
      {debug && (() => {
        try {
          const pending = (localMilestones || []).filter(m => m.status !== 'completed');
          const firstPending = pending.length > 0 ? pending[0] : null;
          console.debug('[MilestoneList] firstPending:', firstPending);
          (localMilestones || []).forEach(m => {
            const targetDate = m.targetDate ? new Date(m.targetDate) : null;
            const hasVotingStarted = !!targetDate && new Date() >= targetDate;
            console.debug('[MilestoneList] milestone', m.id, 'status', m.status, 'targetDate', m.targetDate, 'hasVotingStarted', hasVotingStarted, 'isFirstPending', firstPending && firstPending.id === m.id);
          });
        } catch (e) { console.warn('MilestoneList debug error', e); }
        return null;
      })()}
      <div className="grid gap-md">
        {localMilestones.map((milestone) => {
          const userVote = userVotes[milestone.id];
          const stats = voteStats[milestone.id];
          const hasVoted = !!userVote;
          const targetDate = milestone.targetDate ? new Date(milestone.targetDate) : null;

          // Determine which milestone is eligible for voting:
          // - Only the first non-completed milestone may be voted on
          // - Voting only opens after the milestone's targetDate (if provided)
          // - Previous milestones must be approved/completed before allowing voting on later milestones
          const pendingMilestones = (localMilestones || []).filter(m => m.status !== 'completed');
          const firstPending = pendingMilestones.length > 0 ? pendingMilestones[0] : null;
          const previousApproved = (() => {
            if (!firstPending) return false;
            const idx = (localMilestones || []).findIndex(m => m.id === firstPending.id);
            if (idx <= 0) return true;
            // All milestones before idx must have consensus approved or status completed
            for (let i = 0; i < idx; i++) {
              const mid = localMilestones[i];
              const s = voteStats[mid.id];
              const isApproved = mid.status === 'completed' || (s && s.consensus === 'approved');
              if (!isApproved) return false;
            }
            return true;
          })();

          // Voting is admin-controlled: it opens when targetDate has been set and reached.
          const hasVotingStarted = !!targetDate && new Date() >= targetDate;
          const votingOpen = (
            firstPending && milestone.id === firstPending.id &&
            previousApproved &&
            hasVotingStarted
          );
          
          return (
            <div key={milestone.id} className="card">
              <div className="flex items-start justify-between gap-md">
                <div className="flex-1">
                  <div className="flex items-center gap-sm mb-sm">
                    <span className="badge badge-secondary">
                      Milestone {milestone.index}
                    </span>
                    <span className={getStatusBadgeClass(milestone.status)}>
                      {getStatusLabel(milestone.status)}
                    </span>
                    {stats && stats.consensus !== 'pending' && (
                      <span className={`badge ${stats.consensus === 'approved' ? 'badge-success' : 'badge-danger'}`}>
                        {stats.consensus === 'approved' ? '✓ Approved by Investors' : '✗ Rejected by Investors'}
                      </span>
                    )}
                    {(isAdmin || isCreator) && (
                      <div style={{ marginLeft: '12px' }}>
                        {/* Admin controls: start voting now */}
                        {!votingOpen && milestone.status !== 'completed' && firstPending && milestone.id === firstPending.id && (
                          <button
                            onClick={() => handleAdminStartVoting(milestone.id)}
                            style={{ marginLeft: '8px', padding: '6px 10px', borderRadius: '6px', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}
                          >
                            Start Voting Now
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <h4 className="card-title">{milestone.name}</h4>

                  {targetDate && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                      Voting opens on {targetDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  )}
                  
                  {/* Voting Statistics */}
                  {showVoting && stats && stats.totalVotes > 0 && (
                    <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                        <strong>Vote Results:</strong> {stats.totalVotes} total votes
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ flex: 1, height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${stats.approvalPercentage}%`, 
                            height: '100%', 
                            backgroundColor: '#10b981',
                            transition: 'width 0.3s'
                          }}></div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
                        <span>✓ Approve: {stats.approvalPercentage}% ({stats.approvalCount})</span>
                        <span>✗ Reject: {stats.rejectionPercentage}% ({stats.rejectionCount})</span>
                      </div>
                    </div>
                  )}

                  {/* Voting Buttons */}
                  {showVoting && canVote && !hasVoted && milestone.status === 'pending' && votingOpen && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={() => handleVote(milestone.id, true)}
                        disabled={votingMilestone === milestone.id}
                        style={{ flex: 1 }}
                      >
                        {votingMilestone === milestone.id ? 'Voting...' : '✓ Approve'}
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleVote(milestone.id, false)}
                        disabled={votingMilestone === milestone.id}
                        style={{ flex: 1 }}
                      >
                        {votingMilestone === milestone.id ? 'Voting...' : '✗ Reject'}
                      </button>
                    </div>
                  )}

                  {showVoting && !votingOpen && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      backgroundColor: '#eef2ff',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#3730a3'
                    }}>
                      Voting is not open yet.
                    </div>
                  )}

                  {/* Admin: Release button when approved */}
                  {isAdmin && stats && stats.consensus === 'approved' && milestone.status !== 'completed' && (
                    <div style={{ marginTop: '12px' }}>
                      <button
                        onClick={() => {
                          const amount = milestone.target_amount || (campaignGoal ? Math.round((campaignGoal * (milestone.payoutPct || 0)) / 100) : 0);
                          handleAdminRelease(milestone.id, amount);
                        }}
                        disabled={releaseLoading}
                        style={{ padding: '8px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        {releaseLoading ? 'Releasing...' : 'Release Funds (Admin)'}
                      </button>
                    </div>
                  )}

                  {/* User's Vote Display */}
                  {showVoting && hasVoted && (
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '8px 12px', 
                      backgroundColor: userVote.vote ? '#d1fae5' : '#fee2e2',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: userVote.vote ? '#065f46' : '#991b1b'
                    }}>
                      Your vote: {userVote.vote ? '✓ Approved' : '✗ Rejected'}
                    </div>
                  )}

                  {/* Not eligible to vote message */}
                  {showVoting && !canVote && userId && (
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '8px 12px', 
                      backgroundColor: '#fef3c7',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#92400e'
                    }}>
                      Only investors can vote on milestones
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted">Payout</div>
                  <div className="font-semibold text-lg">
                    {formatPayoutPct(milestone.payoutPct)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-lg p-md bg-gray-50 rounded">
        <h4 className="mb-sm">Milestone Progress</h4>
        <div className="text-sm text-muted">
          <div className="flex justify-between mb-xs">
            <span>Completed:</span>
            <span>{localMilestones.filter(m => m.status === 'completed').length} of {localMilestones.length}</span>
          </div>
          <div className="flex justify-between mb-xs">
            <span>In Progress:</span>
            <span>{localMilestones.filter(m => m.status === 'in-progress').length}</span>
          </div>
          <div className="flex justify-between">
            <span>Pending:</span>
            <span>{localMilestones.filter(m => m.status === 'pending').length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MilestoneList;