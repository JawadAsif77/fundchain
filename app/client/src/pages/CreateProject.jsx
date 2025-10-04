import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProjectWithMilestones, generateSlug, validateMilestones } from '../lib/api.js';
import { useAuth } from '../store/AuthContext.jsx';

const CreateProject = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Project form data
  const [projectData, setProjectData] = useState({
    title: '',
    slug: '',
    summary: '',
    description: '',
    category: '',
    goalAmount: '',
    deadline: '',
    imageUrl: ''
  });

  // Milestones data
  const [milestones, setMilestones] = useState([
    { name: '', description: '', payoutPercentage: '' }
  ]);

  const handleProjectChange = (field, value) => {
    setProjectData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-generate slug from title
      if (field === 'title') {
        updated.slug = generateSlug(value);
      }
      
      return updated;
    });
  };

  const handleMilestoneChange = (index, field, value) => {
    setMilestones(prev => 
      prev.map((milestone, i) => 
        i === index ? { ...milestone, [field]: value } : milestone
      )
    );
  };

  const addMilestone = () => {
    if (milestones.length < 10) {
      setMilestones(prev => [...prev, { name: '', description: '', payoutPercentage: '' }]);
    }
  };

  const removeMilestone = (index) => {
    if (milestones.length > 1) {
      setMilestones(prev => prev.filter((_, i) => i !== index));
    }
  };

  const validateStep1 = () => {
    return projectData.title && 
           projectData.summary && 
           projectData.description && 
           projectData.category && 
           projectData.goalAmount && 
           projectData.deadline;
  };

  const validateStep2 = () => {
    const validMilestones = milestones.every(m => m.name && m.description && m.payoutPercentage);
    const { isValid, error } = validateMilestones(milestones);
    if (!isValid && !error) return false;
    if (!isValid && error) {
      setError(error);
    }
    return validMilestones && isValid;
  };

  const nextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
      setError('');
    } else if (currentStep === 1) {
      setError('Please fill in all project details');
    }
  };

  const prevStep = () => {
    setCurrentStep(1);
    setError('');
  };

  const handleSubmit = async () => {
    if (!validateStep2()) {
      setError('Please complete all milestones and ensure percentages add up to 100%');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await createProjectWithMilestones(
        {
          ...projectData,
          goalAmount: parseFloat(projectData.goalAmount)
        },
        milestones.map(m => ({
          ...m,
          payoutPercentage: parseFloat(m.payoutPercentage)
        }))
      );

      if (result.success) {
        navigate('/dashboard', { state: { campaignSubmitted: true } });
      } else {
        setError(result.error || 'Failed to create project');
      }
    } catch (err) {
      console.error('Project creation error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    'Technology',
    'Healthcare',
    'Education',
    'Environment',
    'Finance',
    'Entertainment',
    'Food & Beverage',
    'Fashion',
    'Travel',
    'Real Estate',
    'Other'
  ];

  const renderProjectDetails = () => (
    <div>
      <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px' }}>
        Project Details
      </h3>

      <div style={{ display: 'grid', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
            Project Title *
          </label>
          <input
            type="text"
            value={projectData.title}
            onChange={(e) => handleProjectChange('title', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
            placeholder="Your project title"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
            URL Slug (auto-generated)
          </label>
          <input
            type="text"
            value={projectData.slug}
            readOnly
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: '#f9fafb',
              color: '#6b7280'
            }}
            placeholder="auto-generated-from-title"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
            Category *
          </label>
          <select
            value={projectData.category}
            onChange={(e) => handleProjectChange('category', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            <option value="">Select a category</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
              Funding Goal (USD) *
            </label>
            <input
              type="number"
              min="1000"
              value={projectData.goalAmount}
              onChange={(e) => handleProjectChange('goalAmount', e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              placeholder="50000"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
              Campaign Deadline *
            </label>
            <input
              type="date"
              value={projectData.deadline}
              onChange={(e) => handleProjectChange('deadline', e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
            Project Summary *
          </label>
          <textarea
            value={projectData.summary}
            onChange={(e) => handleProjectChange('summary', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              minHeight: '100px',
              resize: 'vertical'
            }}
            placeholder="Brief description of your project (2-3 sentences)"
            maxLength="300"
          />
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            {projectData.summary.length}/300 characters
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
            Detailed Description *
          </label>
          <textarea
            value={projectData.description}
            onChange={(e) => handleProjectChange('description', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              minHeight: '200px',
              resize: 'vertical'
            }}
            placeholder="Detailed description of your project, goals, and vision..."
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
            Project Image URL
          </label>
          <input
            type="url"
            value={projectData.imageUrl}
            onChange={(e) => handleProjectChange('imageUrl', e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
            placeholder="https://example.com/project-image.jpg"
          />
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Optional: Image upload functionality coming soon
          </div>
        </div>
      </div>
    </div>
  );

  const renderMilestones = () => {
    const totalPercentage = milestones.reduce((sum, m) => sum + parseFloat(m.payoutPercentage || 0), 0);
    const isValidPercentage = Math.abs(totalPercentage - 100) < 0.01;

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '600' }}>
            Project Milestones
          </h3>
          {milestones.length < 10 && (
            <button
              type="button"
              onClick={addMilestone}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Add Milestone
            </button>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '12px 16px',
            backgroundColor: isValidPercentage ? '#f0f9ff' : '#fef2f2',
            border: `1px solid ${isValidPercentage ? '#0ea5e9' : '#ef4444'}`,
            borderRadius: '6px'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>
              Total Percentage: {totalPercentage.toFixed(1)}%
            </span>
            <span style={{ 
              fontSize: '12px', 
              color: isValidPercentage ? '#0f766e' : '#dc2626',
              fontWeight: '500'
            }}>
              {isValidPercentage ? '✓ Valid' : '✗ Must equal 100%'}
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '20px' }}>
          {milestones.map((milestone, index) => (
            <div key={index} style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '500' }}>
                  Milestone {index + 1}
                </h4>
                {milestones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMilestone(index)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                    Milestone Name *
                  </label>
                  <input
                    type="text"
                    value={milestone.name}
                    onChange={(e) => handleMilestoneChange(index, 'name', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '13px'
                    }}
                    placeholder="e.g., Product Development Phase"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                    Description *
                  </label>
                  <textarea
                    value={milestone.description}
                    onChange={(e) => handleMilestoneChange(index, 'description', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '13px',
                      minHeight: '80px',
                      resize: 'vertical'
                    }}
                    placeholder="Describe what will be achieved in this milestone"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                    Payout Percentage *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={milestone.payoutPercentage}
                      onChange={(e) => handleMilestoneChange(index, 'payoutPercentage', e.target.value)}
                      style={{
                        width: '120px',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                      placeholder="25.0"
                    />
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>%</span>
                    {milestone.payoutPercentage && projectData.goalAmount && (
                      <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                        (${((parseFloat(milestone.payoutPercentage) / 100) * parseFloat(projectData.goalAmount || 0)).toFixed(0)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
            Create New Project
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Launch your project and start raising funds from investors
          </p>
        </div>

        {/* Step Indicator */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: '40px',
          gap: '16px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '20px',
            backgroundColor: currentStep >= 1 ? '#3b82f6' : '#e5e7eb',
            color: currentStep >= 1 ? 'white' : '#9ca3af'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>1. Project Details</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '20px',
            backgroundColor: currentStep >= 2 ? '#3b82f6' : '#e5e7eb',
            color: currentStep >= 2 ? 'white' : '#9ca3af'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>2. Milestones</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            color: '#dc2626',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Step Content */}
        <div style={{ marginBottom: '32px' }}>
          {currentStep === 1 ? renderProjectDetails() : renderMilestones()}
        </div>

        {/* Navigation Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          {currentStep === 1 ? (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={prevStep}
              style={{
                padding: '12px 24px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Previous
            </button>
          )}

          {currentStep === 1 ? (
            <button
              type="button"
              onClick={nextStep}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Next: Milestones
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading && (
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #ffffff',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
              )}
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          )}
        </div>
      </div>

      {/* CSS for animations */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default CreateProject;