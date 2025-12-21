import React, { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { milestoneVotingApi } from '../lib/api';

const MilestoneList = ({ milestones, campaignId, showVoting = false }) => {
  const { userId } = useAuth();
  const [userVotes, setUserVotes] = useState({});
  const [voteStats, setVoteStats] = useState({});
  const [canVote, setCanVote] = useState(false);
  const [votingMilestone, setVotingMilestone] = useState(null);

  useEffect(() => {
    if (showVoting && userId && campaignId) {
      loadVotingData();
    }
  }, [showVoting, userId, campaignId, milestones]);

  const loadVotingData = async () => {
    try {
      // Check if user can vote
      const canVoteResult = await milestoneVotingApi.canUserVote(campaignId, userId);
      setCanVote(canVoteResult);

      // Load user's votes and stats for each milestone
      const votes = {};
      const stats = {};
      
      for (const milestone of milestones || []) {
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

  if (!milestones || milestones.length === 0) {
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
      <div className="grid gap-md">
        {milestones.map((milestone) => {
          const userVote = userVotes[milestone.id];
          const stats = voteStats[milestone.id];
          const hasVoted = !!userVote;
          
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
                  </div>
                  <h4 className="card-title">{milestone.name}</h4>
                  
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
                  {showVoting && canVote && !hasVoted && milestone.status === 'pending' && (
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
            <span>{milestones.filter(m => m.status === 'completed').length} of {milestones.length}</span>
          </div>
          <div className="flex justify-between mb-xs">
            <span>In Progress:</span>
            <span>{milestones.filter(m => m.status === 'in-progress').length}</span>
          </div>
          <div className="flex justify-between">
            <span>Pending:</span>
            <span>{milestones.filter(m => m.status === 'pending').length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MilestoneList;