/**
 * INTEGRATION EXAMPLE FOR App.jsx
 * 
 * Shows exactly how to integrate the tutorial system into your existing routing structure
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { TutorialProvider } from './contexts/TutorialContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Footer from './components/Footer';
import NetworkStatus from './components/NetworkStatus';
import ChatWidget from './components/ChatWidget';
import TutorialOverlay from './components/TutorialOverlay';

// All your existing page imports...
import Home from './pages/Home';
import Explore from './pages/Explore';
import Campaign from './pages/Campaign';
import Dashboard from './pages/Dashboard';
// ... other imports

// Styles
import './styles/globals.css';

/**
 * STEP 1: Create tutorial steps configuration
 * This defines all tutorial steps with their metadata
 */
const getTutorialSteps = (refs) => [
  {
    id: 'wallet-button',
    targetRef: refs.walletButtonRef,
    title: 'Connect Your Wallet',
    description:
      'Connect your Phantom Wallet here to fund campaigns or receive investor payouts.',
    route: '/dashboard',
    position: 'bottom',
  },
  {
    id: 'discover-projects',
    targetRef: refs.discoverRef,
    title: 'Discover Investment Opportunities',
    description:
      'Browse and explore active investment campaigns from verified creators in your area of interest.',
    route: '/explore',
    position: 'bottom',
  },
  {
    id: 'create-campaign',
    targetRef: refs.createRef,
    title: 'Launch Your Campaign',
    description:
      'Have a business idea? Launch your own campaign and attract investors. Complete KYC verification first.',
    route: '/create-project',
    position: 'bottom',
  },
  {
    id: 'analytics-link',
    targetRef: refs.analyticsRef,
    title: 'Track Your Performance',
    description:
      'View detailed analytics about your portfolio performance, ROI, and campaign metrics.',
    route: '/analytics',
    position: 'bottom',
  },
  {
    id: 'help-link',
    targetRef: refs.helpRef,
    title: 'Learn How It Works',
    description:
      'New to the platform? Read our comprehensive guide explaining every step of the investment process.',
    route: '/how-it-works',
    position: 'bottom',
  },
];

/**
 * STEP 2: Wrapper component that provides tutorial context
 * This wraps the main app layout with the TutorialProvider
 */
function AppLayout({ tutorialSteps }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <Routes>
          {/* All your existing routes */}
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/campaign/:id" element={<Campaign />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {/* ... other routes */}
        </Routes>
      </main>
      <Footer />

      {/* Tutorial overlay - renders at top level */}
      <TutorialOverlay />
    </div>
  );
}

/**
 * STEP 3: Create refs in a component that persists across route changes
 * The Provider wrapper ensures tutorial state survives navigation
 */
function AppWithTutorial() {
  // Create refs for tutorial targets
  // These will be passed to Header via context or props
  const tutorialRefs = React.useRef({
    walletButtonRef: React.createRef(),
    discoverRef: React.createRef(),
    createRef: React.createRef(),
    analyticsRef: React.createRef(),
    helpRef: React.createRef(),
  }).current;

  const tutorialSteps = getTutorialSteps(tutorialRefs);

  return (
    <TutorialProvider steps={tutorialSteps}>
      <AppLayout tutorialSteps={tutorialSteps} />
    </TutorialProvider>
  );
}

/**
 * Main App component
 */
function App() {
  return (
    <ErrorBoundary>
      <NetworkStatus />
      <Router>
        <AuthProvider>
          <AppWithTutorial />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;

/**
 * ALTERNATIVE APPROACH: Using a Context for refs
 * 
 * If you prefer, create a separate context for tutorial refs:
 */

// Create a refs context
const TutorialRefsContext = React.createContext();

export function TutorialRefsProvider({ children }) {
  const refs = React.useRef({
    walletButtonRef: React.createRef(),
    discoverRef: React.createRef(),
    createRef: React.createRef(),
    analyticsRef: React.createRef(),
    helpRef: React.createRef(),
  }).current;

  return (
    <TutorialRefsContext.Provider value={refs}>
      {children}
    </TutorialRefsContext.Provider>
  );
}

export function useTutorialRefs() {
  return React.useContext(TutorialRefsContext);
}

// Then use it in Header.jsx:
/**
 * // In Header.jsx
 * import { useTutorialRefs } from './TutorialRefsProvider';
 * 
 * export default function Header() {
 *   const refs = useTutorialRefs();
 * 
 *   return (
 *     <header>
 *       <button ref={refs.walletButtonRef}>Connect Wallet</button>
 *       <a ref={refs.discoverRef}>Discover</a>
 *       {* ... etc *}
 *     </header>
 *   );
 * }
 */
