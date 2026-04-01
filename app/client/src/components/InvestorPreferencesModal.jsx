import React, { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { saveUserPreferences } from '../services/preferencesService';
import { supabase } from '../lib/supabase';

const InvestorPreferencesModal = ({ onClose, onComplete }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1=categories, 2=regions, 3=risk
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [riskTolerance, setRiskTolerance] = useState('MEDIUM');
  const [error, setError] = useState('');

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name');
        
        if (error) throw error;
        setCategories(data || []);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
        setCategories([]);
      }
    };
    fetchCategories();
  }, []);

  const handleSelectCategory = (categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        // Limit to 3 selections
        if (prev.length >= 3) return prev;
        return [...prev, categoryId];
      }
    });
  };

  const handleSelectRegion = (region) => {
    setSelectedRegions(prev => {
      if (prev.includes(region)) {
        return prev.filter(r => r !== region);
      } else {
        // Limit to 2 selections
        if (prev.length >= 2) return prev;
        return [...prev, region];
      }
    });
  };

  const handleNext = () => {
    if (step === 1 && selectedCategories.length === 0) {
      setError('Please select at least one category');
      return;
    }
    if (step === 2 && selectedRegions.length === 0) {
      setError('Please select at least one region');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      await saveUserPreferences(user.id, {
        preferred_categories: selectedCategories,
        preferred_regions: selectedRegions,
        risk_tolerance: riskTolerance
      });
      setError('');
      onComplete?.();
    } catch (err) {
      setError(err.message || 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const commonStyles = {
    modal: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '40px',
      maxWidth: '520px',
      width: '90%',
      maxHeight: '80vh',
      overflowY: 'auto',
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '8px',
      color: '#111827'
    },
    subtitle: {
      fontSize: '14px',
      color: '#6b7280',
      marginBottom: '24px'
    },
    group: {
      marginBottom: '24px'
    },
    label: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#111827',
      marginBottom: '12px',
      display: 'block'
    },
    checkbox: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      marginBottom: '8px',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    checkboxChecked: {
      backgroundColor: '#f0f9ff',
      borderColor: '#29C7AC',
    },
    radio: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      marginBottom: '8px',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    radioChecked: {
      backgroundColor: '#f0f9ff',
      borderColor: '#29C7AC',
    },
    buttons: {
      display: 'flex',
      gap: '12px',
      marginTop: '32px',
    },
    button: {
      flex: 1,
      padding: '12px',
      borderRadius: '8px',
      border: 'none',
      fontWeight: '600',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'all 0.2s',
    },
    buttonPrimary: {
      backgroundColor: '#29C7AC',
      color: 'white',
    },
    buttonSecondary: {
      backgroundColor: '#f3f4f6',
      color: '#111827',
    },
    progress: {
      display: 'flex',
      gap: '8px',
      marginBottom: '24px',
    },
    progressDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: '#d1d5db',
      transition: 'all 0.2s',
    },
    progressDotActive: {
      backgroundColor: '#29C7AC',
      transform: 'scale(1.25)',
    },
    error: {
      fontSize: '13px',
      color: '#dc2626',
      marginBottom: '16px',
      padding: '12px',
      backgroundColor: '#fee2e2',
      borderRadius: '6px',
      border: '1px solid #fca5a5',
    }
  };

  // Sample regions
  const regions = ['North America', 'Europe', 'Asia Pacific', 'Middle East', 'Latin America'];

  return (
    <div style={commonStyles.modal}>
      <div style={commonStyles.content}>
        {/* Progress dots */}
        <div style={commonStyles.progress}>
          {[1, 2, 3].map(num => (
            <div
              key={num}
              style={{
                ...commonStyles.progressDot,
                ...(step >= num ? commonStyles.progressDotActive : {})
              }}
            />
          ))}
        </div>

        {/* Step 1: Categories */}
        {step === 1 && (
          <>
            <h2 style={commonStyles.title}>Your Investment Interests</h2>
            <p style={commonStyles.subtitle}>Select 1-3 categories you're interested in</p>

            {error && <div style={commonStyles.error}>{error}</div>}

            <div style={commonStyles.group}>
              {categories.map(cat => (
                <div
                  key={cat.id}
                  style={{
                    ...commonStyles.checkbox,
                    ...(selectedCategories.includes(cat.id) ? commonStyles.checkboxChecked : {})
                  }}
                  onClick={() => handleSelectCategory(cat.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.id)}
                    onChange={() => {}}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{cat.name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Regions */}
        {step === 2 && (
          <>
            <h2 style={commonStyles.title}>Preferred Regions</h2>
            <p style={commonStyles.subtitle}>Select 1-2 regions you focus on</p>

            {error && <div style={commonStyles.error}>{error}</div>}

            <div style={commonStyles.group}>
              {regions.map(region => (
                <div
                  key={region}
                  style={{
                    ...commonStyles.checkbox,
                    ...(selectedRegions.includes(region) ? commonStyles.checkboxChecked : {})
                  }}
                  onClick={() => handleSelectRegion(region)}
                >
                  <input
                    type="checkbox"
                    checked={selectedRegions.includes(region)}
                    onChange={() => {}}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>{region}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step 3: Risk Tolerance */}
        {step === 3 && (
          <>
            <h2 style={commonStyles.title}>Risk Tolerance</h2>
            <p style={commonStyles.subtitle}>How much risk are you comfortable with?</p>

            {error && <div style={commonStyles.error}>{error}</div>}

            <div style={commonStyles.group}>
              {['LOW', 'MEDIUM', 'HIGH'].map(level => (
                <div
                  key={level}
                  style={{
                    ...commonStyles.radio,
                    ...(riskTolerance === level ? commonStyles.radioChecked : {})
                  }}
                  onClick={() => setRiskTolerance(level)}
                >
                  <input
                    type="radio"
                    name="risk"
                    value={level}
                    checked={riskTolerance === level}
                    onChange={() => {}}
                    style={{ cursor: 'pointer' }}
                  />
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: '600', display: 'block' }}>
                      {level === 'LOW' && '🛡️ Low Risk'}
                      {level === 'MEDIUM' && '⚖️ Balanced'}
                      {level === 'HIGH' && '🚀 High Growth'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {level === 'LOW' && 'Prefer stable, established projects'}
                      {level === 'MEDIUM' && 'Mix of stability and growth potential'}
                      {level === 'HIGH' && 'Early-stage projects with higher returns'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Buttons */}
        <div style={commonStyles.buttons}>
          {step > 1 && (
            <button
              style={{ ...commonStyles.button, ...commonStyles.buttonSecondary }}
              onClick={handleBack}
              disabled={loading}
            >
              Back
            </button>
          )}
          {step < 3 && (
            <button
              style={{ ...commonStyles.button, ...commonStyles.buttonPrimary }}
              onClick={handleNext}
              disabled={loading}
            >
              Next
            </button>
          )}
          {step === 3 && (
            <button
              style={{ ...commonStyles.button, ...commonStyles.buttonPrimary }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvestorPreferencesModal;
