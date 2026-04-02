import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorialContext } from '../contexts/TutorialContext';
import TutorialTooltip from './TutorialTooltip';

/**
 * TutorialOverlay component that renders the spotlight effect and overlay
 * Uses clip-path for the cutout effect
 */
export default function TutorialOverlay() {
  const { isActive, currentStepIndex, steps, nextStep } = useTutorialContext();
  const overlayRef = useRef(null);
  const [targetRect, setTargetRect] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const currentStep = steps[currentStepIndex] || null;

  // Recalculate target position
  const updateTargetRect = useCallback(() => {
    if (!currentStep?.targetRef?.current) {
      setIsReady(false);
      return;
    }

    const element = currentStep.targetRef.current;
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    const isHidden =
      rect.width < 2 ||
      rect.height < 2 ||
      computedStyle.display === 'none' ||
      computedStyle.visibility === 'hidden' ||
      computedStyle.opacity === '0';

    if (isHidden) {
      setIsReady(false);
      return;
    }

    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    });
    setIsReady(true);
  }, [currentStep?.targetRef]);

  // Automatically advance when the target is missing/hidden so the sequence never stalls.
  useEffect(() => {
    if (!isActive || !currentStep) return;

    const element = currentStep?.targetRef?.current;
    if (!element) {
      const timer = setTimeout(() => {
        nextStep();
      }, 120);
      return () => clearTimeout(timer);
    }

    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    const isHidden =
      rect.width < 2 ||
      rect.height < 2 ||
      computedStyle.display === 'none' ||
      computedStyle.visibility === 'hidden' ||
      computedStyle.opacity === '0';

    if (isHidden) {
      const timer = setTimeout(() => {
        nextStep();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isActive, currentStepIndex, currentStep, nextStep]);

  // Update on mount and when step changes
  useEffect(() => {
    updateTargetRect();
    const timer = setTimeout(updateTargetRect, 100); // Allow for DOM to settle

    return () => clearTimeout(timer);
  }, [currentStepIndex, updateTargetRect]);

  // Recalculate on resize
  useEffect(() => {
    window.addEventListener('resize', updateTargetRect);
    return () => window.removeEventListener('resize', updateTargetRect);
  }, [updateTargetRect]);

  // Prevent scrolling when tutorial is active
  useEffect(() => {
    if (isActive) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [isActive]);

  if (!isActive || !currentStep || !isReady || !targetRect) {
    return null;
  }

  // Calculate clip-path for spotlight cutout
  // Add 12px padding around the element
  const padding = 12;
  const spotlightTop = targetRect.top - padding;
  const spotlightLeft = targetRect.left - padding;
  const spotlightWidth = targetRect.width + padding * 2;
  const spotlightHeight = targetRect.height + padding * 2;

  // Viewport dimensions
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Create clip-path: rectangle with hole in the middle
  const clipPathValue = `
    polygon(
      0% 0%,
      0% 100%,
      100% 100%,
      100% 0%,
      0% 0%,
      ${(spotlightLeft / vw) * 100}% ${(spotlightTop / vh) * 100}%,
      ${(spotlightLeft / vw) * 100}% ${((spotlightTop + spotlightHeight) / vh) * 100}%,
      ${((spotlightLeft + spotlightWidth) / vw) * 100}% ${((spotlightTop + spotlightHeight) / vh) * 100}%,
      ${((spotlightLeft + spotlightWidth) / vw) * 100}% ${(spotlightTop / vh) * 100}%,
      ${(spotlightLeft / vw) * 100}% ${(spotlightTop / vh) * 100}%
    )
  `;

  return (
    <AnimatePresence>
      {isActive && currentStep && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-9998 pointer-events-none"
          style={{
            clipPath: clipPathValue,
          }}
        >
          {/* Overlay background */}
          <motion.div
            key={`overlay-${currentStepIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            style={{
              pointerEvents: 'auto',
            }}
          />
        </div>
      )}

      {/* Spotlight border highlight */}
      {isActive && currentStep && targetRect && (
        <motion.div
          key={`spotlight-${currentStepIndex}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed pointer-events-none border-2 border-emerald-500/60 rounded-lg shadow-lg"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: spotlightWidth,
            height: spotlightHeight,
            zIndex: 9998,
            boxShadow: `
              0 0 0 9999px rgba(0, 0, 0, 0.75),
              inset 0 0 24px rgba(16, 185, 129, 0.2),
              0 0 24px rgba(16, 185, 129, 0.3)
            `,
            backdropFilter: 'blur(0px)',
          }}
        />
      )}

      {/* Tooltip */}
      {isActive && currentStep && targetRect && (
        <TutorialTooltip
          step={currentStep}
          targetRect={targetRect}
          stepIndex={currentStepIndex}
        />
      )}
    </AnimatePresence>
  );
}
