/**
 * TUTORIAL INTEGRATION GUIDE
 * 
 * This guide shows how to integrate the spotlight tutorial system into your app
 */

import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TutorialProvider } from '../contexts/TutorialContext';
import TutorialOverlay from '../components/TutorialOverlay';
import { useTutorial } from '../hooks/useTutorial';

/**
 * STEP 1: Define your tutorial steps
 * 
 * Create this configuration object with all the steps for your tutorial.
 * Each step targets one UI element that will be highlighted.
 */
export const DASHBOARD_TUTORIAL_STEPS = [
  {
    id: 'wallet-button',
    targetRef: null, // Will be set by ref attachment
    title: 'Connect Your Wallet',
    description:
      'Connect your Phantom Wallet to fund campaigns or receive investor payouts. Click here to get started.',
    route: '/dashboard', // Where clicking the target navigates to
    position: 'bottom',
  },
  {
    id: 'discover-projects',
    targetRef: null,
    title: 'Discover Investment Opportunities',
    description:
      'Browse and explore active investment campaigns from verified creators. Find projects aligned with your interests.',
    route: '/explore',
    position: 'bottom',
  },
  {
    id: 'create-campaign',
    targetRef: null,
    title: 'Launch Your Campaign',
    description:
      'Have a great business idea? Launch your own campaign and attract investors. Complete KYC first.',
    route: '/create-project',
    position: 'bottom',
  },
  {
    id: 'analytics-link',
    targetRef: null,
    title: 'Track Your Performance',
    description:
      'View detailed analytics about your portfolio, investments, and campaign metrics all in one place.',
    route: '/analytics',
    position: 'bottom',
  },
  {
    id: 'how-it-works',
    targetRef: null,
    title: 'Learn How It Works',
    description:
      'New to the platform? Dive into our comprehensive guide that explains every step of the process.',
    route: '/how-it-works',
    position: 'bottom',
  },
];

/**
 * STEP 2: Initialize tutorial steps with refs
 * 
 * In your Dashboard or main app layout component, create refs for each tutorial target
 * and pass them to the tutorial provider.
 */
export function DashboardExample() {
  // Create refs for each tutorial step target
  const walletButtonRef = useRef(null);
  const discoverProjectsRef = useRef(null);
  const createCampaignRef = useRef(null);
  const analyticsLinkRef = useRef(null);
  const howItWorksRef = useRef(null);

  // Initialize tutorial steps with refs
  const tutorialSteps = [
    { ...DASHBOARD_TUTORIAL_STEPS[0], targetRef: walletButtonRef },
    { ...DASHBOARD_TUTORIAL_STEPS[1], targetRef: discoverProjectsRef },
    { ...DASHBOARD_TUTORIAL_STEPS[2], targetRef: createCampaignRef },
    { ...DASHBOARD_TUTORIAL_STEPS[3], targetRef: analyticsLinkRef },
    { ...DASHBOARD_TUTORIAL_STEPS[4], targetRef: howItWorksRef },
  ];

  return (
    <TutorialProvider steps={tutorialSteps}>
      {/* Your dashboard layout */}
      <div className="min-h-screen bg-slate-950">
        {/* Header with nav items */}
        <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
          <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
            {/* Wallet Button - Tutorial target */}
            <button
              ref={walletButtonRef}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
            >
              🔗 Connect Wallet
            </button>

            {/* Nav links container */}
            <div className="flex gap-6">
              {/* Discover Projects - Tutorial target */}
              <a
                ref={discoverProjectsRef}
                href="/explore"
                className="text-white/80 hover:text-white font-medium transition-colors"
              >
                🔍 Discover
              </a>

              {/* Create Campaign - Tutorial target */}
              <a
                ref={createCampaignRef}
                href="/create-project"
                className="text-white/80 hover:text-white font-medium transition-colors"
              >
                ➕ Create
              </a>

              {/* Analytics - Tutorial target */}
              <a
                ref={analyticsLinkRef}
                href="/analytics"
                className="text-white/80 hover:text-white font-medium transition-colors"
              >
                📊 Analytics
              </a>

              {/* How It Works - Tutorial target */}
              <a
                ref={howItWorksRef}
                href="/how-it-works"
                className="text-white/80 hover:text-white font-medium transition-colors"
              >
                ❓ Help
              </a>
            </div>
          </nav>
        </header>

        {/* Main content */}
        <main className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>
          {/* Your dashboard content here */}
        </main>

        {/* Tutorial Overlay - Render at the top level */}
        <TutorialOverlay />
      </div>
    </TutorialProvider>
  );
}

/**
 * STEP 3: Wrap your entire app with TutorialProvider
 * 
 * In your main App.jsx file, wrap everything with the TutorialProvider:
 */
export function AppWithTutorialExample() {
  return (
    <TutorialProvider steps={[]}>
      {/* Your routes and components */}
      <DashboardExample />
    </TutorialProvider>
  );
}

/**
 * STEP 4: Use the useTutorial hook in components for advanced control
 * 
 * Access tutorial state and methods in any component:
 */
export function ComponentWithTutorialState() {
  const {
    isActive,
    currentStepIndex,
    totalSteps,
    skipTutorial,
    nextStep,
    resetTutorial,
  } = useTutorial();

  return (
    <div>
      {isActive && (
        <button onClick={skipTutorial} className="text-sm text-white/60">
          Tutorial: Step {currentStepIndex + 1} of {totalSteps}
        </button>
      )}
    </div>
  );
}

/**
 * IMPLEMENTATION CHECKLIST:
 * 
 * ✓ Create refs for each UI element you want to highlight
 * ✓ Define tutorial steps with title, description, route, and position
 * ✓ Wrap your app (or specific layout) with <TutorialProvider steps={steps}>
 * ✓ Render <TutorialOverlay /> at the top level of your layout
 * ✓ Attach refs to the actual HTML elements using ref attribute
 * ✓ Test the tutorial flow by clearing localStorage.getItem('hasSeenTutorial')
 * 
 * KEYBOARD CONTROLS:
 * - Escape: Skip tutorial
 * - Click "Got it →": Advance to next step
 * - Click "Skip": End tutorial
 * - No arrow key navigation needed - users click actual elements
 * 
 * STYLING CUSTOMIZATION:
 * - Primary color: emerald-600 (matches --color-primary)
 * - Update TutorialTooltip.jsx className values to match your design
 * - Adjust padding (12px) in TutorialOverlay.jsx if needed
 * - Modify tooltipWidth and tooltipHeight in TutorialTooltip.jsx
 * 
 * EDGE CASES HANDLED:
 * ✓ Refs become null/unmounted: Step is skipped silently
 * ✓ Window resize: Spotlight recalculates automatically
 * ✓ User navigates away: Step index persisted in sessionStorage
 * ✓ Page scroll: Overlay stays in sync with target position
 * ✓ Tutorial persists: Tracked via localStorage('hasSeenTutorial')
 */
