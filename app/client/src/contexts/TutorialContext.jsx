import React, { createContext, useState, useCallback, useEffect } from 'react';

export const TutorialContext = createContext();

/**
 * @typedef {Object} TutorialStep
 * @property {string} id - Unique step identifier
 * @property {React.RefObject<HTMLElement>} targetRef - Reference to the target element
 * @property {string} title - Step title
 * @property {string} description - Step description
 * @property {string} route - Route to navigate to when step is clicked
 * @property {'top' | 'bottom' | 'left' | 'right'} position - Tooltip position relative to target
 */

export function TutorialProvider({ children, steps = [] }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(() => {
    return localStorage.getItem('hasSeenTutorial') === 'true';
  });

  // Initialize tutorial when steps are available.
  // If login flag is set, force-run tutorial even if seen previously.
  useEffect(() => {
    const shouldForceTutorial =
      localStorage.getItem('pendingDashboardTutorial') === 'true';

    if (steps.length > 0 && (!hasSeenTutorial || shouldForceTutorial)) {
      setIsActive(true);
      sessionStorage.setItem('tutorialStepIndex', '0');
    }
  }, [hasSeenTutorial, steps.length]);

  // Restore step index from session storage on mount
  useEffect(() => {
    const savedStepIndex = sessionStorage.getItem('tutorialStepIndex');
    if (savedStepIndex !== null) {
      setCurrentStepIndex(parseInt(savedStepIndex, 10));
    }
  }, []);

  const getCurrentStep = useCallback(() => {
    return steps[currentStepIndex] || null;
  }, [steps, currentStepIndex]);

  const skipTutorial = useCallback(() => {
    setIsActive(false);
    setHasSeenTutorial(true);
    localStorage.setItem('hasSeenTutorial', 'true');
    localStorage.setItem('platformTutorialSeen', 'true');
    localStorage.removeItem('pendingDashboardTutorial');
    sessionStorage.removeItem('tutorialStepIndex');
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      const newIndex = currentStepIndex + 1;
      setCurrentStepIndex(newIndex);
      sessionStorage.setItem('tutorialStepIndex', String(newIndex));
    } else {
      // Tutorial complete
      skipTutorial();
    }
  }, [currentStepIndex, steps.length, skipTutorial]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      sessionStorage.setItem('tutorialStepIndex', String(newIndex));
    }
  }, [currentStepIndex]);

  const goToStep = useCallback(
    (stepIndex) => {
      if (stepIndex >= 0 && stepIndex < steps.length) {
        setCurrentStepIndex(stepIndex);
        sessionStorage.setItem('tutorialStepIndex', String(stepIndex));
      }
    },
    [steps.length]
  );

  const resetTutorial = useCallback(() => {
    setHasSeenTutorial(false);
    localStorage.removeItem('hasSeenTutorial');
    localStorage.removeItem('platformTutorialSeen');
    setCurrentStepIndex(0);
    sessionStorage.removeItem('tutorialStepIndex');
    setIsActive(steps.length > 0);
  }, [steps.length]);

  const value = {
    isActive,
    setIsActive,
    currentStepIndex,
    setCurrentStepIndex,
    hasSeenTutorial,
    getCurrentStep,
    nextStep,
    previousStep,
    goToStep,
    skipTutorial,
    resetTutorial,
    steps,
    totalSteps: steps.length,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorialContext() {
  const context = React.useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorialContext must be used within TutorialProvider');
  }
  return context;
}
