import React, { useState } from 'react';
import { milestoneUpdateApi } from '../lib/api';

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
    <div className="card">
      <h3 className="card-title">📝 Post Milestone Update</h3>
      
      <form onSubmit={handleSubmit}>
        {/* Milestone Selector */}
        <div className="mb-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Milestone *
          </label>
          <select
            value={selectedMilestoneId}
            onChange={(e) => setSelectedMilestoneId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={submitting}
            required
          >
            <option value="">-- Choose Milestone --</option>
            {activeMilestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                Milestone {milestone.index}: {milestone.name}
              </option>
            ))}
          </select>
        </div>

        {/* Title (Optional) */}
        <div className="mb-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title (Optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Prototype Testing Complete"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={submitting}
            maxLength={200}
          />
        </div>

        {/* Content */}
        <div className="mb-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Update Content *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe your progress, achievements, challenges, and next steps..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows="6"
            disabled={submitting}
            required
          />
          <div className="text-xs text-gray-500 mt-1">
            {content.length} / 2000 characters
          </div>
        </div>

        {/* File Upload */}
        <div className="mb-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attach Media (Optional)
          </label>
          <input
            type="file"
            onChange={handleFileChange}
            accept="image/*,video/*"
            multiple
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={submitting}
          />
          <div className="text-xs text-gray-500 mt-1">
            Images & videos supported. Max 5 files, 10MB each.
          </div>
          {files.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700">Selected files:</p>
              <ul className="text-sm text-gray-600 list-disc list-inside">
                {files.map((file, idx) => (
                  <li key={idx}>{file.name} ({(file.size / 1024).toFixed(0)} KB)</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Progress Message */}
        {uploadProgress && (
          <div className={`mb-md p-3 rounded-lg ${
            uploadProgress.includes('success') 
              ? 'bg-green-100 text-green-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {uploadProgress}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !content.trim() || !selectedMilestoneId}
          >
            {submitting ? 'Posting...' : '📤 Post Update'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MilestoneUpdateForm;
