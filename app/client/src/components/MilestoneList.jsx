import React from 'react';

const MilestoneList = ({ milestones }) => {
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
        {milestones.map((milestone) => (
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
                </div>
                <h4 className="card-title">{milestone.name}</h4>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted">Payout</div>
                <div className="font-semibold text-lg">
                  {formatPayoutPct(milestone.payoutPct)}
                </div>
              </div>
            </div>
          </div>
        ))}
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