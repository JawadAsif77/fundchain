import React, { useState } from 'react';
import { milestoneUpdateApi } from '../lib/api';
import '../styles/milestone-updates.css';

const MilestoneUpdateForm = ({ campaignId, milestones, onSuccess }) => {
  const [selectedMilestoneId, setSelectedMilestoneId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const activeMilestones = milestones.filter(m => m.status !== 'completed');

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    // Limit to 5 files
    if (selectedFiles.length > 5) {
      alert('Maximum 5 files allowed');
      return;
    }
    // Check file sizes (max 10MB each)
    const oversized = selectedFiles.filter(f => f.size > 10 * 1024 * 1024);
    if (oversized.length > 0) {
      alert('Some files exceed 10MB limit');
      return;
    }
    setFiles(selectedFiles);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedMilestoneId) {
      alert('Please select a milestone');
      return;
    }
    
    if (!content.trim()) {
      alert('Please enter update content');
      return;
    }

    try {
      setSubmitting(true);
      setUploadProgress('Uploading media...');
      
      await milestoneUpdateApi.createUpdate(
        campaignId,
        selectedMilestoneId,
        title.trim() || 'Milestone Progress Update',
        content.trim(),
        files
      );
      
      setUploadProgress('Update posted successfully!');
      
      // Reset form
      setSelectedMilestoneId('');
      setTitle('');
      setContent('');
      setFiles([]);
      
      if (onSuccess) onSuccess();
      
      setTimeout(() => setUploadProgress(''), 2000);
    } catch (err) {
      console.error('Failed to post update:', err);
      alert(err.message || 'Failed to post update');
      setUploadProgress('');
    } finally {
      setSubmitting(false);
    }
  };

  if (activeMilestones.length === 0) {
    return (
      <div className="card">
        <p className="text-gray-600">All milestones are completed. No updates needed.</p>
      </div>
    );
  }

  return (
    <div className="milestone-update-form-wrapper">
      <div className="milestone-update-form-header">
        <div className="milestone-update-form-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <div>
          <h3 className="milestone-update-form-title">Post Milestone Update</h3>
          <p className="milestone-update-form-subtitle">Share your progress with investors</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="milestone-update-form">
        {/* Milestone Selector */}
        <div className="form-group">
          <label className="form-label">
            <span className="form-label-text">Select Milestone</span>
            <span className="form-label-required">*</span>
          </label>
          <div className="select-wrapper">
            <select
              value={selectedMilestoneId}
              onChange={(e) => setSelectedMilestoneId(e.target.value)}
              className="form-select"
              disabled={submitting}
              required
            >
              <option value="">Choose a milestone to update...</option>
              {activeMilestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  Milestone {milestone.index}: {milestone.name}
                </option>
              ))}
            </select>
            <svg className="select-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Title (Optional) */}
        <div className="form-group">
          <label className="form-label">
            <span className="form-label-text">Update Title</span>
            <span className="form-label-optional">Optional</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Prototype Testing Complete, Phase 1 Finished..."
            className="form-input"
            disabled={submitting}
            maxLength={200}
          />
          <div className="form-hint">
            A catchy title helps investors quickly understand your progress
          </div>
        </div>

        {/* Content */}
        <div className="form-group">
          <label className="form-label">
            <span className="form-label-text">Progress Details</span>
            <span className="form-label-required">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe your achievements, challenges faced, and what's next...&#10;&#10;Tips:&#10;• Be specific about what you've accomplished&#10;• Share any metrics or results&#10;• Mention challenges and how you're addressing them&#10;• Outline your next steps"
            className="form-textarea"
            disabled={submitting}
            required
          />
          <div className="form-counter">
            <span className={content.length > 1800 ? 'text-orange-600' : 'text-gray-500'}>
              {content.length}
            </span>
            <span className="text-gray-400"> / 2000</span>
          </div>
        </div>

        {/* File Upload */}
        <div className="form-group">
          <label className="form-label">
            <span className="form-label-text">Attach Photos & Videos</span>
            <span className="form-label-optional">Optional</span>
          </label>
          
          <div className="file-upload-area">
            <input
              type="file"
              id="file-upload"
              onChange={handleFileChange}
              accept="image/*,video/*"
              multiple
              className="file-input-hidden"
              disabled={submitting}
            />
            <label htmlFor="file-upload" className="file-upload-label">
              <div className="file-upload-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="file-upload-text">
                <span className="file-upload-primary">Click to upload</span>
                <span className="file-upload-secondary">or drag and drop</span>
              </div>
              <div className="file-upload-hint">
                PNG, JPG, GIF, MP4, WebM up to 10MB each (max 5 files)
              </div>
            </label>
          </div>

          {files.length > 0 && (
            <div className="file-list">
              <div className="file-list-header">
                <span className="file-list-title">Selected Files ({files.length})</span>
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  className="file-list-clear"
                  disabled={submitting}
                >
                  Clear all
                </button>
              </div>
              <div className="file-list-items">
                {files.map((file, idx) => (
                  <div key={idx} className="file-list-item">
                    <div className="file-icon">
                      {file.type.startsWith('image/') ? '🖼️' : '🎬'}
                    </div>
                    <div className="file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                      className="file-remove"
                      disabled={submitting}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Progress Message */}
        {uploadProgress && (
          <div className={`progress-alert ${
            uploadProgress.includes('success') 
              ? 'progress-alert-success' 
              : 'progress-alert-info'
          }`}>
            <div className="progress-alert-icon">
              {uploadProgress.includes('success') ? '✅' : '⏳'}
            </div>
            <div className="progress-alert-text">{uploadProgress}</div>
          </div>
        )}

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setSelectedMilestoneId('');
              setTitle('');
              setContent('');
              setFiles([]);
            }}
            disabled={submitting}
          >
            Clear Form
          </button>
          <button
            type="submit"
            className="btn-primary-submit"
            disabled={submitting || !content.trim() || !selectedMilestoneId}
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Posting...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Post Update
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MilestoneUpdateForm;
