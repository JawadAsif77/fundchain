/**
 * TYPESCRIPT TYPE DEFINITIONS
 * 
 * Optional: Use these types to add type safety to your tutorial system.
 * These types work with the existing JSX components.
 * 
 * To use:
 * 1. Rename files from .jsx to .tsx
 * 2. Import types from this file
 * 3. Add type annotations to function parameters
 */

import type { RefObject } from 'react';

/**
 * Main type for a single tutorial step
 */
export type TutorialStep = {
  /** Unique identifier for the step */
  id: string;

  /** React ref pointing to the target element to highlight */
  targetRef: RefObject<HTMLElement>;

  /** Title displayed in the tooltip */
  title: string;

  /** Description displayed in the tooltip */
  description: string;

  /** Route to navigate to when user clicks "Got it" */
  route: string;

  /** Position of tooltip relative to the target element */
  position: 'top' | 'bottom' | 'left' | 'right';
};

/**
 * Position type for tooltip placement
 */
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Configuration for the tutorial system
 */
export type TutorialConfig = {
  /** Array of tutorial steps */
  steps: TutorialStep[];

  /** Whether to show tutorial on first visit (default: true) */
  showOnFirstVisit?: boolean;

  /** LocalStorage key for tracking (default: 'hasSeenTutorial') */
  storageKey?: string;

  /** Padding around spotlight cutout in pixels (default: 12) */
  spotlightPadding?: number;

  /** Blur effect intensity (default: 'blur-sm') */
  blurEffect?: 'blur-none' | 'blur-sm' | 'blur-md' | 'blur-lg' | 'blur-xl';
};

/**
 * Context value type
 */
export type TutorialContextType = {
  /** Whether tutorial is currently showing */
  isActive: boolean;

  /** Set tutorial active state */
  setIsActive: (active: boolean) => void;

  /** Index of current step (0-based) */
  currentStepIndex: number;

  /** Set current step directly */
  setCurrentStepIndex: (index: number) => void;

  /** Whether user has seen tutorial before */
  hasSeenTutorial: boolean;

  /** Get the current step object */
  getCurrentStep: () => TutorialStep | null;

  /** Move to next step (or end if last step) */
  nextStep: () => void;

  /** Move to previous step */
  previousStep: () => void;

  /** Jump to specific step */
  goToStep: (index: number) => void;

  /** End tutorial and mark as seen */
  skipTutorial: () => void;

  /** Reset tutorial for testing/demo */
  resetTutorial: () => void;

  /** All tutorial steps */
  steps: TutorialStep[];

  /** Total number of steps */
  totalSteps: number;
};

/**
 * Target rectangle for positioning calculations
 */
export type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

/**
 * Tooltip positioning result
 */
export type TooltipPositionResult = {
  x: number;
  y: number;
};

/**
 * Props for TutorialProvider component
 */
export type TutorialProviderProps = {
  /** Tutorial steps to display */
  steps: TutorialStep[];

  /** Child components */
  children: React.ReactNode;
};

/**
 * Props for TutorialOverlay component
 */
export type TutorialOverlayProps = {
  /** Optional className override */
  className?: string;
};

/**
 * Props for TutorialTooltip component
 */
export type TutorialTooltipProps = {
  /** Tutorial step data */
  step: TutorialStep;

  /** Bounding rectangle of target element */
  targetRect: TargetRect;

  /** Current step index (0-based) */
  stepIndex: number;
};

/**
 * Return type for useTutorial hook
 */
export type UseTutorialReturn = TutorialContextType;

/**
 * Return type for useTutorialTarget hook
 */
export type UseTutorialTargetReturn = {
  /** Whether this step is currently active */
  isCurrentStep: boolean;
};

/**
 * Example usage in TypeScript
 */

// Define tutorial steps with types
export const DASHBOARD_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'wallet-button',
    targetRef: null as any, // Will be set at runtime
    title: 'Connect Your Wallet',
    description: 'Connect your Phantom Wallet to get started.',
    route: '/dashboard',
    position: 'bottom',
  },
];

// Component example with types
export function ExampleComponent(): JSX.Element {
  // Type: RefObject<HTMLButtonElement>
  const walletRef = useRef<HTMLButtonElement>(null);
  const discoverRef = useRef<HTMLAnchorElement>(null);

  const steps: TutorialStep[] = [
    {
      id: 'wallet',
      targetRef: walletRef,
      title: 'Wallet',
      description: 'Connect wallet',
      route: '/dashboard',
      position: 'bottom',
    },
    {
      id: 'discover',
      targetRef: discoverRef,
      title: 'Discover',
      description: 'Explore campaigns',
      route: '/explore',
      position: 'bottom',
    },
  ];

  return (
    <button ref={walletRef}>Connect</button>
  );
}

/**
 * Utility functions with types
 */

/**
 * Calculate if element is visible in viewport
 */
export function isElementInViewport(rect: TargetRect): boolean {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}

/**
 * Check if step target is valid
 */
export function isValidStep(step: TutorialStep | null): step is TutorialStep {
  return (
    step !== null &&
    step.targetRef !== null &&
    step.targetRef.current !== null
  );
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate percentage progress
 */
export function calculateProgress(
  currentIndex: number,
  totalSteps: number
): number {
  if (totalSteps === 0) return 0;
  return ((currentIndex + 1) / totalSteps) * 100;
}

/**
 * Debounce utility for resize handling
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

/**
 * Convert step index to human-readable format
 */
export function formatStepCounter(
  currentIndex: number,
  totalSteps: number
): string {
  return `Step ${currentIndex + 1} of ${totalSteps}`;
}

/**
 * Export all types as a namespace
 */
export namespace Tutorial {
  export type Step = TutorialStep;
  export type Config = TutorialConfig;
  export type Context = TutorialContextType;
  export type Position = TooltipPosition;
  export type OverlayProps = TutorialOverlayProps;
  export type TooltipProps = TutorialTooltipProps;
}
