/**
 * READY-TO-USE EXAMPLE: Minimal Tutorial Integration
 * 
 * This shows the absolute minimum code needed to integrate the tutorial system.
 * Copy this exact pattern into your App.jsx or Dashboard component.
 */

import React, { useRef } from 'react';
import { TutorialProvider } from './contexts/TutorialContext';
import TutorialOverlay from './components/TutorialOverlay';

// Step 1: Define your tutorial steps (move this to a constants file in production)
const TUTORIAL_STEPS = [
  {
    id: 'wallet-button',
    targetRef: null,
    title: '🔗 Connect Your Wallet',
    description:
      'Connect your Phantom Wallet to authenticate and access all features. You can fund campaigns or receive investor payouts safely.',
    route: '/dashboard',
    position: 'bottom',
  },
  {
    id: 'discover-projects',
    targetRef: null,
    title: '🔍 Discover Investment Opportunities',
    description:
      'Browse verified business campaigns. See funding goals, milestones, creator badges, and AI risk assessments.',
    route: '/explore',
    position: 'bottom',
  },
  {
    id: 'create-campaign',
    targetRef: null,
    title: '➕ Launch Your Campaign',
    description:
      'Have a great business idea? Submit your campaign and attract investors. You\'ll need to pass KYC verification first.',
    route: '/create-project',
    position: 'bottom',
  },
  {
    id: 'analytics-link',
    targetRef: null,
    title: '📊 Track Your Performance',
    description:
      'View comprehensive analytics about your portfolio, investment returns, and campaign metrics in real-time.',
    route: '/analytics',
    position: 'bottom',
  },
  {
    id: 'help-link',
    targetRef: null,
    title: '❓ Learn How It Works',
    description:
      'New to the platform? Explore our detailed guide covering wallet setup, KYC, investing, and campaign creation step-by-step.',
    route: '/how-it-works',
    position: 'bottom',
  },
];

/**
 * Step 2: Create a wrapper component that provides tutorial context
 * This component manages refs and passes them to TutorialProvider
 */
function AppWithTutorial() {
  // Create refs for each tutorial target element
  const walletButtonRef = useRef(null);
  const discoverRef = useRef(null);
  const createRef = useRef(null);
  const analyticsRef = useRef(null);
  const helpRef = useRef(null);

  // Build tutorial steps with actual refs
  const tutorialSteps = [
    { ...TUTORIAL_STEPS[0], targetRef: walletButtonRef },
    { ...TUTORIAL_STEPS[1], targetRef: discoverRef },
    { ...TUTORIAL_STEPS[2], targetRef: createRef },
    { ...TUTORIAL_STEPS[3], targetRef: analyticsRef },
    { ...TUTORIAL_STEPS[4], targetRef: helpRef },
  ];

  // Return TutorialProvider wrapping your entire app layout
  return (
    <TutorialProvider steps={tutorialSteps}>
      {/* Step 3: Wrap your existing app layout */}
      <AppLayout
        refs={{
          walletButtonRef,
          discoverRef,
          createRef,
          analyticsRef,
          helpRef,
        }}
      />

      {/* Step 4: Render the tutorial overlay at top level */}
      <TutorialOverlay />
    </TutorialProvider>
  );
}

/**
 * Step 5: Update your AppLayout to accept and use refs
 * Example showing how to attach refs to header elements
 */
function AppLayout({ refs }) {
  // Your existing app structure
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with tutorial target refs */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo / Home link */}
          <a href="/" className="text-2xl font-bold text-emerald-600">
            FundChain
          </a>

          {/* Navigation flex container */}
          <div className="flex gap-6 items-center">
            {/* Wallet Button - Tutorial Target #1 */}
            <button
              ref={refs.walletButtonRef}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
            >
              🔗 Connect Wallet
            </button>

            {/* Main nav links */}
            <div className="hidden sm:flex gap-6">
              {/* Discover Projects - Tutorial Target #2 */}
              <a
                ref={refs.discoverRef}
                href="/explore"
                className="text-white/80 hover:text-white font-medium transition-colors"
              >
                🔍 Discover
              </a>

              {/* Create Campaign - Tutorial Target #3 */}
              <a
                ref={refs.createRef}
                href="/create-project"
                className="text-white/80 hover:text-white font-medium transition-colors"
              >
                ➕ Create
              </a>

              {/* Analytics - Tutorial Target #4 */}
              <a
                ref={refs.analyticsRef}
                href="/analytics"
                className="text-white/80 hover:text-white font-medium transition-colors"
              >
                📊 Analytics
              </a>

              {/* Help - Tutorial Target #5 */}
              <a
                ref={refs.helpRef}
                href="/how-it-works"
                className="text-white/80 hover:text-white font-medium transition-colors"
              >
                ❓ Help
              </a>
            </div>

            {/* Mobile menu button (not part of tutorial) */}
            <button className="sm:hidden text-white">☰</button>
          </div>
        </nav>
      </header>

      {/* Main content - your existing routes/pages */}
      <main style={{ flex: 1 }}>
        {/* Your routes/pages render here */}
        <YourExistingAppRoutes />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8">
        <div className="text-center text-white/60">
          © 2024 FundChain. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

/**
 * Your existing app routes component
 */
function YourExistingAppRoutes() {
  // This contains your existing Routes/pages
  // No changes needed - tutorial works on top of this
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>
      {/* Your existing content */}
    </div>
  );
}

export default AppWithTutorial;

/**
 * USAGE INSTRUCTIONS:
 * 
 * 1. Import in your main App.jsx:
 *    import AppWithTutorial from './components/AppWithTutorialExample';
 * 
 * 2. Replace your current app structure with AppWithTutorial
 * 
 * 3. In production, move TUTORIAL_STEPS to a constants file:
 *    src/constants/tutorialSteps.ts
 * 
 * 4. Test by:
 *    - Clearing localStorage: localStorage.clear()
 *    - Refreshing page: Should show tutorial
 * 
 * 5. User experience:
 *    - First visit: Tutorial auto-starts
 *    - User clicks "Skip" or "Got it": Tutorial ends
 *    - Revisit: No tutorial (remembered via localStorage)
 * 
 * 6. To show tutorial again for demo/testing:
 *    - Run in DevTools console: localStorage.removeItem('hasSeenTutorial')
 *    - Refresh page
 * 
 * THAT'S IT! Your tutorial system is now live.
 */

/**
 * ADVANCED: Conditional Tutorial by Role
 * 
 * If you have different tutorials for different user roles:
 */
function AppWithConditionalTutorial() {
  // Determine user role (from auth context)
  const shouldShowTutorial = true; // Replace with your auth logic

  // Define steps based on role
  const getTutorialSteps = () => {
    if (!shouldShowTutorial) return [];
    return TUTORIAL_STEPS;
  };

  // Rest of the component...
  return <AppWithTutorial />;
}

/**
 * ADVANCED: Clean up old tutorial implementation
 * 
 * If you were using the old TutorialPopup.jsx (slide-based tutorial),
 * you can now archive it or remove it. This spotlight system replaces it.
 */
