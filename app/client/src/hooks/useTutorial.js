import { useEffect, useCallback } from 'react';
import { useTutorialContext } from '../contexts/TutorialContext';

/**
 * Custom hook for managing tutorial state and side effects
 * Handles keyboard navigation (Escape to skip) and scroll behavior
 */
export function useTutorial() {
  const tutorialContext = useTutorialContext();
  const { isActive, skipTutorial } = tutorialContext;

  // Handle Escape key to skip tutorial
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        skipTutorial();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, skipTutorial]);

  // Handle scroll - keep tutorial overlay in sync
  useEffect(() => {
    if (!isActive) return;

    let scrollTimeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      // Trigger a re-render of the overlay by dispatching a resize event
      scrollTimeout = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [isActive]);

  return tutorialContext;
}

/**
 * Hook for getting a ref that integrates with the tutorial system
 * Usage: const ref = useTutorialTarget('wallet-button');
 */
export function useTutorialTarget(stepId) {
  const { steps, currentStepIndex } = useTutorialContext();
  const isCurrentStep = steps[currentStepIndex]?.id === stepId;

  return {
    isCurrentStep,
  };
}
