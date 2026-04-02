import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTutorialContext } from '../contexts/TutorialContext';

/**
 * Calculate the position of the tooltip relative to the target element
 */
function calculateTooltipPosition(targetRect, position, padding = 16, tooltipWidth = 320, tooltipHeight = 240) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let x = targetRect.left;
  let y = targetRect.top;

  const spotlightPadding = 12;
  const spotlightTop = targetRect.top - spotlightPadding;
  const spotlightLeft = targetRect.left - spotlightPadding;
  const spotlightBottom = targetRect.bottom + spotlightPadding;
  const spotlightRight = targetRect.right + spotlightPadding;

  switch (position) {
    case 'top': {
      x = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      y = spotlightTop - tooltipHeight - padding;
      break;
    }
    case 'bottom': {
      x = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      y = spotlightBottom + padding;
      break;
    }
    case 'left': {
      x = spotlightLeft - tooltipWidth - padding;
      y = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      break;
    }
    case 'right': {
      x = spotlightRight + padding;
      y = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      break;
    }
    default: {
      position = 'bottom';
      x = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      y = spotlightBottom + padding;
    }
  }

  // Clamp to viewport
  x = Math.max(padding, Math.min(x, vw - tooltipWidth - padding));
  y = Math.max(padding, Math.min(y, vh - tooltipHeight - padding));

  return { x, y };
}

/**
 * TutorialTooltip component - card showing tutorial step details
 */
export default function TutorialTooltip({ step, targetRect, stepIndex }) {
  const { skipTutorial, nextStep, totalSteps } = useTutorialContext();

  const tooltipWidth = 340;
  const tooltipHeight = 280;

  const { x, y } = useMemo(
    () =>
      calculateTooltipPosition(targetRect, step.position, 16, tooltipWidth, tooltipHeight),
    [targetRect, step.position]
  );

  const handleGotIt = useCallback(() => {
    // Keep user on dashboard and simply advance tutorial step.
    nextStep();
  }, [nextStep]);

  const handleSkip = useCallback(() => {
    skipTutorial();
  }, [skipTutorial]);

  const progressPercentage = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <motion.div
      key={`tooltip-${stepIndex}`}
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
      className="fixed z-9999"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: tooltipWidth,
        zIndex: 10001,
        pointerEvents: 'auto',
      }}
    >
      {/* Card background */}
      <div
        className="relative rounded-2xl border p-5 shadow-2xl"
        style={{
          background: '#ffffff',
          borderColor: 'var(--color-border)',
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.16)',
        }}
      >
        {/* Title */}
        <h3 className="text-base font-bold text-slate-900 mb-3 leading-snug">
          {step.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-800 leading-relaxed mb-6 line-clamp-4 font-bold">
          {step.description}
        </p>

        {/* Buttons */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={handleSkip}
            className="flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-primary-ink)',
            }}
            type="button"
            aria-label="Skip tutorial"
          >
            Skip
          </button>
          <button
            onClick={handleGotIt}
            className="flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-primary-ink)',
            }}
            type="button"
            aria-label="Continue tutorial"
          >
            Got it →
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full bg-slate-200 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: 'var(--color-primary)' }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Arrow pointer to target (optional, using CSS triangle) */}
        <div
          className="absolute pointer-events-none"
          style={{
            content: '""',
            position: 'absolute',
            width: 0,
            height: 0,
            borderStyle: 'solid',
            ...getArrowStyles(step.position, tooltipWidth, tooltipHeight),
          }}
        />
      </div>
    </motion.div>
  );
}

/**
 * Calculate arrow styles based on tooltip position
 */
function getArrowStyles(position, _tooltipWidth, _tooltipHeight) {
  const arrowSize = 10;

  switch (position) {
    case 'bottom':
      return {
        top: -arrowSize * 2,
        left: '50%',
        transform: 'translateX(-50%)',
        borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
        borderColor: '#ffffff transparent transparent transparent',
      };
    case 'top':
      return {
        bottom: -arrowSize * 2,
        left: '50%',
        transform: 'translateX(-50%)',
        borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
        borderColor: 'transparent transparent #ffffff transparent',
      };
    case 'right':
      return {
        left: -arrowSize * 2,
        top: '50%',
        transform: 'translateY(-50%)',
        borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
        borderColor: 'transparent #ffffff transparent transparent',
      };
    case 'left':
      return {
        right: -arrowSize * 2,
        top: '50%',
        transform: 'translateY(-50%)',
        borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
        borderColor: 'transparent transparent transparent #ffffff',
      };
    default:
      return {};
  }
}
