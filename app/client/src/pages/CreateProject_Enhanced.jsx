import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createProjectWithMilestones, generateSlug, validateMilestones } from '../lib/api.js';
import { useAuth } from '../store/AuthContext.jsx';
import { validateRequired, validateDecimal, sanitizeInput } from '../utils/validation';
import { supabase } from '../lib/supabase.js';
import '../styles/create-project.css';

const CreateProject = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [existingCampaignId, setExistingCampaignId] = useState(null);
  const [categories, setCategories] = useState([]);
  
  const navigate = useNavigate();
  const { campaignId } = useParams();
  const { user, profile, roleStatus } = useAuth();

  // Check KYC verification - redirect unverified creators
  useEffect(() => {
    if (profile && roleStatus) {
      const isVerified = roleStatus?.isKYCVerified || profile?.is_verified === 'yes';
      if (!isVerified) {
        navigate('/kyc', { 
          replace: true, 
          state: { message: 'Please complete KYC verification to create campaigns.' } 
        });
      }
    }
  }, [profile, roleStatus, navigate]);

  // Load categories from database
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');
      
      if (error) {
        console.error('Error loading categories:', error);
        // Fallback to hardcoded categories if table doesn't exist
        setCategories([
          { id: 'technology', name: 'Technology' },
          { id: 'healthcare', name: 'Healthcare' },
          { id: 'education', name: 'Education' },
          { id: 'environment', name: 'Environment' },
          { id: 'finance', name: 'Finance' },
          { id: 'entertainment', name: 'Entertainment' },
          { id: 'other', name: 'Other' }
        ]);
      } else {
        setCategories(data || []);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  // Load existing campaign if in edit mode
  useEffect(() => {
    if (campaignId && user) {
      loadExistingCampaign(campaignId);
    }
  }, [campaignId, user]);

  // Enhanced project form data
  const [projectData, setProjectData] = useState({
    // Basic Info
    title: '',
    slug: '',
    summary: '',
    description: '',
    category: '',
    goalAmount: '',
    deadline: '',
    
    // Visual Assets
    campaign_image_url: '',
    video_pitch_url: '',
    pitch_deck_url: '',
    whitepaper_url: '',
    
    // Team Info
    team_size: '',
    team_experience: '',
    
    // Project Details
    project_stage: '',
    target_audience: '',
    business_model: '',
    revenue_streams: '',
    competitive_advantage: '',
    
    // Financial
    use_of_funds: [{ category: '', amount: '', description: '' }],
    expected_roi: '',
    previous_funding_amount: '',
    previous_funding_source: '',
    
    // Analysis
    market_analysis: '',
    risks_and_challenges: '',
    
    // Links
    website_url: '',
    github_repository: '',
    social_media_links: {
      twitter: '',
      linkedin: '',
      facebook: '',
      instagram: ''
    },
    
    // Legal
    legal_structure: '',
    registration_number: '',
    tax_id: ''
  });

  // Milestones data
  const [milestones, setMilestones] = useState([
    { name: '', description: '', payoutPercentage: '' }
  ]);

  const loadExistingCampaign = async (id) => {
    try {
      setLoading(true);
      
      console.log('[Campaign Edit] Loading campaign:', id);
      
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .eq('creator_id', user.id)
        .eq('status', 'pending_review')
        .single();

      console.log('[Campaign Edit] Fetched campaign data:', campaign);
      console.log('[Campaign Edit] Fetch error:', error);

      if (error || !campaign) {
        setError('Campaign not found or not editable');
        navigate('/dashboard');
        return;
      }

      if (!campaign.is_updatable) {
        setError('This campaign can no longer be updated');
        navigate('/dashboard');
        return;
      }

      // Load campaign data - mapping database fields correctly
      setProjectData({
        title: campaign.title || '',
        slug: campaign.slug || '',
        summary: campaign.short_description || '',
        description: campaign.description || '',
        category: campaign.category_id || campaign.category || '',
        goalAmount: campaign.funding_goal?.toString() || '',
        deadline: campaign.end_date ? campaign.end_date.split('T')[0] : '',
        
        // Visual Assets - check both old and new field names
        campaign_image_url: campaign.campaign_image_url || campaign.image_url || '',
        video_pitch_url: campaign.video_pitch_url || campaign.video_url || '',
        pitch_deck_url: campaign.pitch_deck_url || '',
        whitepaper_url: campaign.whitepaper_url || '',
        
        // Team Info
        team_size: campaign.team_size?.toString() || '',
        team_experience: campaign.team_experience || '',
        
        // Project Details
        project_stage: campaign.project_stage || '',
        target_audience: campaign.target_audience || '',
        business_model: campaign.business_model || '',
        revenue_streams: campaign.revenue_streams || '',
        competitive_advantage: campaign.competitive_advantage || '',
        
        // Financial
        use_of_funds: (campaign.use_of_funds && Array.isArray(campaign.use_of_funds) && campaign.use_of_funds.length > 0) 
          ? campaign.use_of_funds 
          : [{ category: '', amount: '', description: '' }],
        expected_roi: campaign.expected_roi || '',
        previous_funding_amount: campaign.previous_funding_amount?.toString() || '',
        previous_funding_source: campaign.previous_funding_source || '',
        
        // Analysis
        market_analysis: campaign.market_analysis || '',
        risks_and_challenges: campaign.risks_and_challenges || '',
        
        // Links
        website_url: campaign.website_url || '',
        github_repository: campaign.github_repository || '',
        social_media_links: (campaign.social_media_links && typeof campaign.social_media_links === 'object') 
          ? {
              twitter: campaign.social_media_links.twitter || '',
              linkedin: campaign.social_media_links.linkedin || '',
              facebook: campaign.social_media_links.facebook || '',
              instagram: campaign.social_media_links.instagram || ''
            }
          : { twitter: '', linkedin: '', facebook: '', instagram: '' },
        
        // Legal
        legal_structure: campaign.legal_structure || '',
        registration_number: campaign.registration_number || '',
        tax_id: campaign.tax_id || ''
      });

      // Load milestones - check both possible field names
      const { data: milestonesData } = await supabase
        .from('milestones')
        .select('*')
        .eq('campaign_id', id)
        .order('order_index', { ascending: true });

      if (milestonesData && milestonesData.length > 0) {
        setMilestones(milestonesData.map(m => ({
          name: m.title || m.name || '',  // DB field might be 'title'
          description: m.description || '',
          payoutPercentage: m.payout_percentage?.toString() || 
                           (m.target_amount && campaign.funding_goal 
                             ? ((m.target_amount / campaign.funding_goal) * 100).toFixed(2)
                             : '')
        })));
      }

      console.log('[Campaign Edit] Milestones loaded:', milestonesData);
      console.log('[Campaign Edit] Processed milestones:', milestones);

      setIsUpdating(true);
      setExistingCampaignId(id);
      
      console.log('[Campaign Edit] Final projectData state:', projectData);
      
    } catch (err) {
      console.error('[Campaign Edit] Error loading campaign:', err);
      setError('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectChange = (field, value) => {
    // Apply input filtering
    let filteredValue = value;
    if (field === 'goalAmount' || field === 'previous_funding_amount') {
      filteredValue = sanitizeInput.decimal(value);
    }
    
    setProjectData(prev => {
      const updated = { ...prev, [field]: filteredValue };
      
      // Auto-generate slug from title
      if (field === 'title' && !isUpdating) {
        updated.slug = generateSlug(filteredValue);
      }
      
      return updated;
    });
    
    // Clear validation error when user types
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSocialMediaChange = (platform, value) => {
    setProjectData(prev => ({
      ...prev,
      social_media_links: {
        ...prev.social_media_links,
        [platform]: value
      }
    }));
  };

  const handleUseFundsChange = (index, field, value) => {
    const updated = [...projectData.use_of_funds];
    updated[index] = { ...updated[index], [field]: value };
    setProjectData(prev => ({ ...prev, use_of_funds: updated }));
  };

  const addUseFundsRow = () => {
    setProjectData(prev => ({
      ...prev,
      use_of_funds: [...prev.use_of_funds, { category: '', amount: '', description: '' }]
    }));
  };

  const removeUseFundsRow = (index) => {
    if (projectData.use_of_funds.length > 1) {
      setProjectData(prev => ({
        ...prev,
        use_of_funds: prev.use_of_funds.filter((_, i) => i !== index)
      }));
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/campaign_${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('campaign-images')
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('campaign-images')
        .getPublicUrl(fileName);
      
      setProjectData(prev => ({
        ...prev,
        campaign_image_url: publicUrl
      }));
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileUpload = async (file, field) => {
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${field}_${Date.now()}.${fileExt}`;
      
      const { data, error} = await supabase.storage
        .from('campaign-documents')
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('campaign-documents')
        .getPublicUrl(fileName);
      
      setProjectData(prev => ({
        ...prev,
        [field]: publicUrl
      }));
    } catch (err) {
      console.error(`Error uploading ${field}:`, err);
      setError(`Failed to upload file. Please try again.`);
    }
  };

  const validateStep = (step) => {
    const errors = {};

    switch (step) {
      case 1: // Basic Information
        if (!projectData.title || projectData.title.trim().length < 5) {
          errors.title = 'Title must be at least 5 characters';
        } else if (projectData.title.length > 100) {
          errors.title = 'Title must be less than 100 characters';
        }

        if (!projectData.category) {
          errors.category = 'Please select a category';
        }

        if (!projectData.summary || projectData.summary.trim().length < 20) {
          errors.summary = 'Summary must be at least 20 characters';
        } else if (projectData.summary.length > 300) {
          errors.summary = 'Summary must be less than 300 characters';
        }

        if (!projectData.description || projectData.description.trim().length < 100) {
          errors.description = 'Description must be at least 100 characters';
        } else if (projectData.description.length > 5000) {
          errors.description = 'Description must be less than 5000 characters';
        }

        if (!projectData.campaign_image_url) {
          errors.campaign_image = 'Please upload a campaign image';
        }
        break;

      case 2: // Project Details
        if (!projectData.project_stage) {
          errors.project_stage = 'Please select project stage';
        }

        if (!projectData.target_audience || projectData.target_audience.trim().length < 20) {
          errors.target_audience = 'Target audience must be at least 20 characters';
        }

        if (!projectData.business_model || projectData.business_model.trim().length < 20) {
          errors.business_model = 'Business model must be at least 20 characters';
        }

        if (!projectData.competitive_advantage || projectData.competitive_advantage.trim().length < 20) {
          errors.competitive_advantage = 'Competitive advantage must be at least 20 characters';
        }

        if (!projectData.market_analysis || projectData.market_analysis.trim().length < 50) {
          errors.market_analysis = 'Market analysis must be at least 50 characters';
        }
        break;

      case 3: // Financial Information
        if (!projectData.goalAmount || parseFloat(projectData.goalAmount) < 1000) {
          errors.goalAmount = 'Minimum funding goal is 1,000 FC tokens';
        }

        if (!projectData.deadline) {
          errors.deadline = 'Please select a deadline';
        } else {
          const deadlineDate = new Date(projectData.deadline);
          const today = new Date();
          const minDate = new Date(today.setDate(today.getDate() + 7));
          
          if (deadlineDate <= minDate) {
            errors.deadline = 'Deadline must be at least 7 days from today';
          }
        }

        // Validate use of funds
        const totalPercentage = projectData.use_of_funds.reduce((sum, item) => {
          return sum + (parseFloat(item.amount) || 0);
        }, 0);

        if (totalPercentage !== 100) {
          errors.use_of_funds = 'Use of funds must total 100%';
        }

        projectData.use_of_funds.forEach((item, index) => {
          if (!item.category || !item.amount || !item.description) {
            errors[`use_of_funds_${index}`] = 'All use of funds fields are required';
          }
        });

        if (!projectData.expected_roi || projectData.expected_roi.trim().length < 10) {
          errors.expected_roi = 'Expected ROI must be at least 10 characters';
        }
        break;

      case 4: // Team & Experience
        if (!projectData.team_size || parseInt(projectData.team_size) < 1) {
          errors.team_size = 'Team size must be at least 1';
        }

        if (!projectData.team_experience || projectData.team_experience.trim().length < 50) {
          errors.team_experience = 'Team experience must be at least 50 characters';
        }

        if (!projectData.risks_and_challenges || projectData.risks_and_challenges.trim().length < 50) {
          errors.risks_and_challenges = 'Risks and challenges must be at least 50 characters';
        }
        break;

      case 5: // Milestones
        const milestoneValidation = validateMilestones(milestones);
        if (!milestoneValidation.isValid) {
          errors.milestones = milestoneValidation.error;
        }
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 6));
      setError('');
      window.scrollTo(0, 0);
    } else {
      setError('Please fix all validation errors before proceeding');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError('');
    window.scrollTo(0, 0);
  };

  const handleMilestoneChange = (index, field, value) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const addMilestone = () => {
    setMilestones([...milestones, { name: '', description: '', payoutPercentage: '' }]);
  };

  const removeMilestone = (index) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    // Validate all steps
    for (let i = 1; i <= 5; i++) {
      if (!validateStep(i)) {
        setError(`Please complete step ${i} correctly`);
        setCurrentStep(i);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const campaignData = {
        // Core required fields
        title: projectData.title,
        slug: projectData.slug,
        short_description: projectData.summary,
        description: projectData.description,
        funding_goal: parseFloat(projectData.goalAmount),
        goalAmount: parseFloat(projectData.goalAmount), // For createProjectWithMilestones API function
        end_date: projectData.deadline,
        creator_id: user.id,
        status: 'pending_review',  // Submit for admin review
        category_id: projectData.category || null,  // Category UUID
        
        // Media fields (dual mapping for compatibility)
        image_url: projectData.campaign_image_url || null,
        video_url: projectData.video_pitch_url || null,
        campaign_image_url: projectData.campaign_image_url || null,
        video_pitch_url: projectData.video_pitch_url || null,
        pitch_deck_url: projectData.pitch_deck_url || null,
        whitepaper_url: projectData.whitepaper_url || null,
        
        // Team Information
        team_size: projectData.team_size ? parseInt(projectData.team_size) : null,
        team_experience: projectData.team_experience || null,
        
        // Project Details
        project_stage: projectData.project_stage || null,
        target_audience: projectData.target_audience || null,
        business_model: projectData.business_model || null,
        revenue_streams: projectData.revenue_streams || null,
        competitive_advantage: projectData.competitive_advantage || null,
        
        // Financial Planning
        use_of_funds: (projectData.use_of_funds && projectData.use_of_funds.length > 0) ? projectData.use_of_funds : [],
        expected_roi: projectData.expected_roi || null,
        previous_funding_amount: projectData.previous_funding_amount ? parseFloat(projectData.previous_funding_amount) : null,
        previous_funding_source: projectData.previous_funding_source || null,
        
        // Market & Risk Analysis
        market_analysis: projectData.market_analysis || null,
        risks_and_challenges: projectData.risks_and_challenges || null,
        
        // External Links
        website_url: projectData.website_url || null,
        github_repository: projectData.github_repository || null,
        social_media_links: Object.keys(projectData.social_media_links || {}).some(k => projectData.social_media_links[k]) ? projectData.social_media_links : {},
        
        // Legal Information
        legal_structure: projectData.legal_structure || null,
        registration_number: projectData.registration_number || null,
        tax_id: projectData.tax_id || null
      };

      if (isUpdating && existingCampaignId) {
        // Update existing campaign - include ALL fields from database schema
        const updateData = {
          // Core fields
          title: projectData.title,
          slug: projectData.slug,
          short_description: projectData.summary,
          description: projectData.description,
          funding_goal: parseFloat(projectData.goalAmount),
          end_date: projectData.deadline,
          category_id: projectData.category || null,
          
          // Media (dual mapping)
          image_url: projectData.campaign_image_url || null,
          video_url: projectData.video_pitch_url || null,
          campaign_image_url: projectData.campaign_image_url || null,
          video_pitch_url: projectData.video_pitch_url || null,
          pitch_deck_url: projectData.pitch_deck_url || null,
          whitepaper_url: projectData.whitepaper_url || null,
          
          // Team
          team_size: projectData.team_size ? parseInt(projectData.team_size) : null,
          team_experience: projectData.team_experience || null,
          
          // Project Details
          project_stage: projectData.project_stage || null,
          target_audience: projectData.target_audience || null,
          business_model: projectData.business_model || null,
          revenue_streams: projectData.revenue_streams || null,
          competitive_advantage: projectData.competitive_advantage || null,
          
          // Financial
          use_of_funds: (projectData.use_of_funds && projectData.use_of_funds.length > 0) ? projectData.use_of_funds : [],
          expected_roi: projectData.expected_roi || null,
          previous_funding_amount: projectData.previous_funding_amount ? parseFloat(projectData.previous_funding_amount) : null,
          previous_funding_source: projectData.previous_funding_source || null,
          
          // Analysis
          market_analysis: projectData.market_analysis || null,
          risks_and_challenges: projectData.risks_and_challenges || null,
          
          // Links
          website_url: projectData.website_url || null,
          github_repository: projectData.github_repository || null,
          social_media_links: Object.keys(projectData.social_media_links || {}).some(k => projectData.social_media_links[k]) ? projectData.social_media_links : {},
          
          // Legal
          legal_structure: projectData.legal_structure || null,
          registration_number: projectData.registration_number || null,
          tax_id: projectData.tax_id || null,
          
          // Metadata
          last_updated_at: new Date().toISOString()
        };

        const { error: updateError } = await supabase
          .from('campaigns')
          .update(updateData)
          .eq('id', existingCampaignId);

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }

        // Delete existing milestones and insert new ones
        await supabase
          .from('milestones')
          .delete()
          .eq('campaign_id', existingCampaignId);

        const milestonesData = milestones.map((m, index) => ({
          campaign_id: existingCampaignId,
          title: m.name,
          description: m.description,
          target_amount: (parseFloat(projectData.goalAmount) * (parseFloat(m.payoutPercentage) / 100)),
          order_index: index,
          is_completed: false
        }));

        const { error: milestonesError } = await supabase
          .from('milestones')
          .insert(milestonesData);

        if (milestonesError) {
          console.error('Milestones error:', milestonesError);
          throw milestonesError;
        }

        alert('Campaign updated successfully! Our team will review your changes.');
        navigate('/dashboard');
      } else {
        // Create new campaign
        const result = await createProjectWithMilestones(campaignData, milestones);

        if (result.success) {
          navigate('/dashboard', { state: { campaignSubmitted: true } });
        } else {
          setError(result.error || 'Failed to create project');
        }
      }
    } catch (err) {
      console.error('Campaign submission error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isUpdating) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading campaign data...</div>
      </div>
    );
  }

  return (
    <div className="create-project-container">
      <div className="create-project-card">
        {isUpdating && (
          <div className="update-banner">
            <span>✏️</span>
            <div>
              <strong>Updating Campaign</strong>
              <p>You can update your campaign details while it's under review</p>
            </div>
          </div>
        )}

        <div className="project-header">
          <h1>{isUpdating ? 'Update Campaign' : 'Create New Campaign'}</h1>
          <p>{isUpdating ? 'Modify your campaign details below' : 'Fill in the details to launch your fundraising campaign'}</p>
        </div>

        {/* Step Indicator */}
        <div className="step-indicator">
          {['Basic Info', 'Project Details', 'Financial', 'Team', 'Milestones', 'Review'].map((label, index) => (
            <div key={index} className={`step ${currentStep >= index + 1 ? 'active' : ''} ${currentStep > index + 1 ? 'completed' : ''}`}>
              <div className="step-number">
                {currentStep > index + 1 ? '✓' : index + 1}
              </div>
              <div className="step-label">{label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <div className="form-content">
          {currentStep === 1 && renderBasicInfo()}
          {currentStep === 2 && renderProjectDetails()}
          {currentStep === 3 && renderFinancialInfo()}
          {currentStep === 4 && renderTeamInfo()}
          {currentStep === 5 && renderMilestones()}
          {currentStep === 6 && renderReview()}
        </div>

        <div className="form-navigation">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="btn-secondary"
          >
            Previous
          </button>

          <div className="step-info">
            Step {currentStep} of 6
          </div>

          {currentStep < 6 ? (
            <button
              onClick={nextStep}
              className="btn-primary"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (isUpdating ? 'Updating...' : 'Submitting...') : (isUpdating ? 'Update Campaign' : 'Submit for Review')}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Render functions for each step
  function renderBasicInfo() {
    return (
      <div className="form-section">
        <h3>Basic Information</h3>
        
        {/* Campaign Image Upload */}
        <div className="form-group">
          <label>Campaign Banner Image *</label>
          <div className="image-upload-container">
            {projectData.campaign_image_url ? (
              <div className="image-preview">
                <img src={projectData.campaign_image_url} alt="Campaign banner" />
                <button
                  type="button"
                  onClick={() => setProjectData(prev => ({ ...prev, campaign_image_url: '' }))}
                  className="remove-image-btn"
                >
                  ✕ Remove
                </button>
              </div>
            ) : (
              <div className="image-upload-box">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files[0])}
                  disabled={uploadingImage}
                  id="campaign-image"
                  style={{ display: 'none' }}
                />
                <label htmlFor="campaign-image" className="upload-label">
                  {uploadingImage ? '⏳ Uploading...' : '📤 Click to upload campaign banner'}
                  <span className="upload-hint">Recommended: 1200x600px, Max 10MB</span>
                </label>
              </div>
            )}
            {validationErrors.campaign_image && (
              <span className="error">{validationErrors.campaign_image}</span>
            )}
          </div>
        </div>

        {/* Rest of basic info fields... */}
        <div className="form-group">
          <label>Project Title *</label>
          <input
            type="text"
            value={projectData.title}
            onChange={(e) => handleProjectChange('title', e.target.value)}
            maxLength={100}
            placeholder="Enter your project title"
          />
          <span className="char-count">{projectData.title.length}/100</span>
          {validationErrors.title && <span className="error">{validationErrors.title}</span>}
        </div>

        <div className="form-group">
          <label>URL Slug (auto-generated)</label>
          <input
            type="text"
            value={projectData.slug}
            readOnly
            className="readonly-input"
            placeholder="auto-generated-from-title"
          />
        </div>

        <div className="form-group">
          <label>Category *</label>
          <select
            value={projectData.category}
            onChange={(e) => handleProjectChange('category', e.target.value)}
          >
            <option value="">Select a category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          {validationErrors.category && <span className="error">{validationErrors.category}</span>}
        </div>

        <div className="form-group">
          <label>Short Summary *</label>
          <textarea
            value={projectData.summary}
            onChange={(e) => handleProjectChange('summary', e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Brief description of your project (20-300 characters)"
          />
          <span className="char-count">{projectData.summary.length}/300</span>
          {validationErrors.summary && <span className="error">{validationErrors.summary}</span>}
        </div>

        <div className="form-group">
          <label>Detailed Description *</label>
          <textarea
            value={projectData.description}
            onChange={(e) => handleProjectChange('description', e.target.value)}
            maxLength={5000}
            rows={10}
            placeholder="Provide a comprehensive description of your project (minimum 100 characters)"
          />
          <span className="char-count">{projectData.description.length}/5000</span>
          {validationErrors.description && <span className="error">{validationErrors.description}</span>}
        </div>

        <div className="form-group">
          <label>Video Pitch URL (Optional)</label>
          <input
            type="url"
            value={projectData.video_pitch_url}
            onChange={(e) => handleProjectChange('video_pitch_url', e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
          />
          <span className="hint">YouTube, Vimeo, or Loom video link</span>
        </div>
      </div>
    );
  }

  function renderProjectDetails() {
    return (
      <div className="form-section">
        <h3>Project Details</h3>

        <div className="form-group">
          <label>Project Stage *</label>
          <select
            value={projectData.project_stage}
            onChange={(e) => handleProjectChange('project_stage', e.target.value)}
          >
            <option value="">Select project stage</option>
            <option value="idea">Idea</option>
            <option value="prototype">Prototype</option>
            <option value="mvp">MVP (Minimum Viable Product)</option>
            <option value="launched">Launched</option>
            <option value="scaling">Scaling</option>
          </select>
          {validationErrors.project_stage && <span className="error">{validationErrors.project_stage}</span>}
        </div>

        <div className="form-group">
          <label>Target Audience *</label>
          <textarea
            value={projectData.target_audience}
            onChange={(e) => handleProjectChange('target_audience', e.target.value)}
            rows={4}
            placeholder="Describe your target users/customers (minimum 20 characters)"
          />
          {validationErrors.target_audience && <span className="error">{validationErrors.target_audience}</span>}
        </div>

        <div className="form-group">
          <label>Business Model *</label>
          <textarea
            value={projectData.business_model}
            onChange={(e) => handleProjectChange('business_model', e.target.value)}
            rows={4}
            placeholder="Explain how your business will make money (minimum 20 characters)"
          />
          {validationErrors.business_model && <span className="error">{validationErrors.business_model}</span>}
        </div>

        <div className="form-group">
          <label>Revenue Streams (Optional)</label>
          <textarea
            value={projectData.revenue_streams}
            onChange={(e) => handleProjectChange('revenue_streams', e.target.value)}
            rows={3}
            placeholder="List your different revenue sources"
          />
        </div>

        <div className="form-group">
          <label>Competitive Advantage *</label>
          <textarea
            value={projectData.competitive_advantage}
            onChange={(e) => handleProjectChange('competitive_advantage', e.target.value)}
            rows={4}
            placeholder="What makes your project unique? (minimum 20 characters)"
          />
          {validationErrors.competitive_advantage && <span className="error">{validationErrors.competitive_advantage}</span>}
        </div>

        <div className="form-group">
          <label>Market Analysis *</label>
          <textarea
            value={projectData.market_analysis}
            onChange={(e) => handleProjectChange('market_analysis', e.target.value)}
            rows={6}
            placeholder="Describe the market size, opportunity, and trends (minimum 50 characters)"
          />
          {validationErrors.market_analysis && <span className="error">{validationErrors.market_analysis}</span>}
        </div>

        <div className="form-group">
          <label>Website URL (Optional)</label>
          <input
            type="url"
            value={projectData.website_url}
            onChange={(e) => handleProjectChange('website_url', e.target.value)}
            placeholder="https://yourproject.com"
          />
        </div>

        <div className="form-group">
          <label>GitHub Repository (Optional)</label>
          <input
            type="url"
            value={projectData.github_repository}
            onChange={(e) => handleProjectChange('github_repository', e.target.value)}
            placeholder="https://github.com/username/repo"
          />
        </div>

        <div className="form-section-title">Social Media Links (Optional)</div>
        <div className="form-row">
          <div className="form-group">
            <label>Twitter/X</label>
            <input
              type="url"
              value={projectData.social_media_links.twitter}
              onChange={(e) => handleSocialMediaChange('twitter', e.target.value)}
              placeholder="https://twitter.com/username"
            />
          </div>
          <div className="form-group">
            <label>LinkedIn</label>
            <input
              type="url"
              value={projectData.social_media_links.linkedin}
              onChange={(e) => handleSocialMediaChange('linkedin', e.target.value)}
              placeholder="https://linkedin.com/company/name"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderFinancialInfo() {
    return (
      <div className="form-section">
        <h3>Financial Information</h3>

        <div className="form-row">
          <div className="form-group">
            <label>Funding Goal (FC Tokens) *</label>
            <input
              type="text"
              value={projectData.goalAmount}
              onChange={(e) => handleProjectChange('goalAmount', e.target.value)}
              placeholder="Minimum 1,000"
            />
            {validationErrors.goalAmount && <span className="error">{validationErrors.goalAmount}</span>}
          </div>

          <div className="form-group">
            <label>Campaign Deadline *</label>
            <input
              type="date"
              value={projectData.deadline}
              onChange={(e) => handleProjectChange('deadline', e.target.value)}
              min={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            />
            {validationErrors.deadline && <span className="error">{validationErrors.deadline}</span>}
          </div>
        </div>

        <div className="form-section-title">
          <label>Use of Funds Breakdown * (Must total 100%)</label>
        </div>
        {projectData.use_of_funds.map((item, index) => (
          <div key={index} className="use-funds-row">
            <div className="form-group">
              <input
                type="text"
                value={item.category}
                onChange={(e) => handleUseFundsChange(index, 'category', e.target.value)}
                placeholder="Category (e.g., Development)"
              />
            </div>
            <div className="form-group">
              <input
                type="number"
                value={item.amount}
                onChange={(e) => handleUseFundsChange(index, 'amount', e.target.value)}
                placeholder="% of funds"
                min="0"
                max="100"
              />
            </div>
            <div className="form-group">
              <input
                type="text"
                value={item.description}
                onChange={(e) => handleUseFundsChange(index, 'description', e.target.value)}
                placeholder="Description"
              />
            </div>
            {projectData.use_of_funds.length > 1 && (
              <button
                type="button"
                onClick={() => removeUseFundsRow(index)}
                className="remove-btn"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addUseFundsRow} className="add-btn">
          + Add Item
        </button>
        {validationErrors.use_of_funds && <span className="error">{validationErrors.use_of_funds}</span>}

        <div className="form-group">
          <label>Expected ROI Timeline *</label>
          <textarea
            value={projectData.expected_roi}
            onChange={(e) => handleProjectChange('expected_roi', e.target.value)}
            rows={3}
            placeholder="When and how will investors see returns? (minimum 10 characters)"
          />
          {validationErrors.expected_roi && <span className="error">{validationErrors.expected_roi}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Previous Funding Amount (Optional)</label>
            <input
              type="text"
              value={projectData.previous_funding_amount}
              onChange={(e) => handleProjectChange('previous_funding_amount', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label>Previous Funding Source (Optional)</label>
            <input
              type="text"
              value={projectData.previous_funding_source}
              onChange={(e) => handleProjectChange('previous_funding_source', e.target.value)}
              placeholder="e.g., Angel investors, VC, Bootstrap"
            />
          </div>
        </div>

        <div className="form-section-title">Legal Information (Optional)</div>
        <div className="form-row">
          <div className="form-group">
            <label>Legal Structure</label>
            <input
              type="text"
              value={projectData.legal_structure}
              onChange={(e) => handleProjectChange('legal_structure', e.target.value)}
              placeholder="e.g., LLC, Corporation, Partnership"
            />
          </div>
          <div className="form-group">
            <label>Registration Number</label>
            <input
              type="text"
              value={projectData.registration_number}
              onChange={(e) => handleProjectChange('registration_number', e.target.value)}
              placeholder="Business registration number"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Tax ID (Optional)</label>
          <input
            type="text"
            value={projectData.tax_id}
            onChange={(e) => handleProjectChange('tax_id', e.target.value)}
            placeholder="Tax identification number"
          />
        </div>

        <div className="form-section-title">Supporting Documents (Optional)</div>
        <div className="form-group">
          <label>Pitch Deck</label>
          <input
            type="file"
            accept=".pdf,.ppt,.pptx"
            onChange={(e) => handleFileUpload(e.target.files[0], 'pitch_deck_url')}
          />
          {projectData.pitch_deck_url && <span className="file-uploaded">✓ Uploaded</span>}
        </div>

        <div className="form-group">
          <label>Whitepaper</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => handleFileUpload(e.target.files[0], 'whitepaper_url')}
          />
          {projectData.whitepaper_url && <span className="file-uploaded">✓ Uploaded</span>}
        </div>
      </div>
    );
  }

  function renderTeamInfo() {
    return (
      <div className="form-section">
        <h3>Team & Experience</h3>

        <div className="form-group">
          <label>Team Size *</label>
          <input
            type="number"
            value={projectData.team_size}
            onChange={(e) => handleProjectChange('team_size', e.target.value)}
            min="1"
            placeholder="Number of team members"
          />
          {validationErrors.team_size && <span className="error">{validationErrors.team_size}</span>}
        </div>

        <div className="form-group">
          <label>Team Experience & Expertise *</label>
          <textarea
            value={projectData.team_experience}
            onChange={(e) => handleProjectChange('team_experience', e.target.value)}
            rows={6}
            placeholder="Describe your team's relevant experience, skills, and achievements (minimum 50 characters)"
          />
          {validationErrors.team_experience && <span className="error">{validationErrors.team_experience}</span>}
        </div>

        <div className="form-group">
          <label>Risks & Challenges *</label>
          <textarea
            value={projectData.risks_and_challenges}
            onChange={(e) => handleProjectChange('risks_and_challenges', e.target.value)}
            rows={6}
            placeholder="What are the potential risks and how will you address them? (minimum 50 characters)"
          />
          {validationErrors.risks_and_challenges && <span className="error">{validationErrors.risks_and_challenges}</span>}
        </div>
      </div>
    );
  }

  function renderMilestones() {
    return (
      <div className="form-section">
        <h3>Project Milestones</h3>
        <p className="section-description">
          Define key milestones for your project. Funds will be released as you complete each milestone.
        </p>

        {milestones.map((milestone, index) => (
          <div key={index} className="milestone-card">
            <div className="milestone-header">
              <h4>Milestone {index + 1}</h4>
              {milestones.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMilestone(index)}
                  className="remove-btn"
                >
                  ✕ Remove
                </button>
              )}
            </div>

            <div className="form-group">
              <label>Milestone Name *</label>
              <input
                type="text"
                value={milestone.name}
                onChange={(e) => handleMilestoneChange(index, 'name', e.target.value)}
                placeholder="e.g., Product Development Phase 1"
              />
            </div>

            <div className="form-group">
              <label>Description *</label>
              <textarea
                value={milestone.description}
                onChange={(e) => handleMilestoneChange(index, 'description', e.target.value)}
                rows={3}
                placeholder="Describe what will be achieved in this milestone"
              />
            </div>

            <div className="form-group">
              <label>Payout Percentage * (%)</label>
              <input
                type="number"
                value={milestone.payoutPercentage}
                onChange={(e) => handleMilestoneChange(index, 'payoutPercentage', e.target.value)}
                min="0"
                max="100"
                placeholder="% of total funds"
              />
            </div>
          </div>
        ))}

        <button type="button" onClick={addMilestone} className="add-milestone-btn">
          + Add Milestone
        </button>

        {validationErrors.milestones && (
          <div className="alert alert-error">
            {validationErrors.milestones}
          </div>
        )}

        <div className="milestone-summary">
          <strong>Total Payout:</strong> {milestones.reduce((sum, m) => sum + (parseFloat(m.payoutPercentage) || 0), 0)}%
          {milestones.reduce((sum, m) => sum + (parseFloat(m.payoutPercentage) || 0), 0) !== 100 && (
            <span className="error"> (Must equal 100%)</span>
          )}
        </div>
      </div>
    );
  }

  function renderReview() {
    return (
      <div className="form-section">
        <h3>Review Your Campaign</h3>
        <p className="section-description">
          Please review all information before submitting. You can go back to edit any section.
        </p>

        <div className="review-section">
          <h4>Basic Information</h4>
          {projectData.campaign_image_url && (
            <img src={projectData.campaign_image_url} alt="Campaign" className="review-image" />
          )}
          <p><strong>Title:</strong> {projectData.title}</p>
          <p><strong>Category:</strong> {categories.find(c => c.id === projectData.category)?.name || projectData.category}</p>
          <p><strong>Summary:</strong> {projectData.summary}</p>
          <button onClick={() => setCurrentStep(1)} className="edit-btn">Edit</button>
        </div>

        <div className="review-section">
          <h4>Project Details</h4>
          <p><strong>Stage:</strong> {projectData.project_stage}</p>
          <p><strong>Target Audience:</strong> {projectData.target_audience.substring(0, 100)}...</p>
          <button onClick={() => setCurrentStep(2)} className="edit-btn">Edit</button>
        </div>

        <div className="review-section">
          <h4>Financial Information</h4>
          <p><strong>Goal:</strong> {projectData.goalAmount} FC Tokens</p>
          <p><strong>Deadline:</strong> {projectData.deadline}</p>
          <p><strong>Use of Funds:</strong> {projectData.use_of_funds.length} items</p>
          <button onClick={() => setCurrentStep(3)} className="edit-btn">Edit</button>
        </div>

        <div className="review-section">
          <h4>Team</h4>
          <p><strong>Team Size:</strong> {projectData.team_size} members</p>
          <button onClick={() => setCurrentStep(4)} className="edit-btn">Edit</button>
        </div>

        <div className="review-section">
          <h4>Milestones</h4>
          <p><strong>Total Milestones:</strong> {milestones.length}</p>
          <p><strong>Total Payout:</strong> {milestones.reduce((sum, m) => sum + (parseFloat(m.payoutPercentage) || 0), 0)}%</p>
          <button onClick={() => setCurrentStep(5)} className="edit-btn">Edit</button>
        </div>

        <div className="final-note">
          <p>✅ By submitting, you confirm that all information provided is accurate and complete.</p>
          <p>⏳ Your campaign will be reviewed by our team within 24-48 hours.</p>
        </div>
      </div>
    );
  }
};

export default CreateProject;
