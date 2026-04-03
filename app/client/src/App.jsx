import React, { useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { useAuth } from './store/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Footer from './components/Footer';
import NetworkStatus from './components/NetworkStatus';
import ChatWidget from './components/ChatWidget';

// Pages
import Home from './pages/Home';
import Explore from './pages/Explore';
import Campaign from './pages/Campaign';
import Login from './pages/Login';
import Register from './pages/Register_simple';
import Dashboard from './pages/Dashboard';
import Profile from './pages/ProfileDisplay';
import ProfileEdit from './pages/ProfileEdit';
import PublicProfile from './pages/PublicProfile';
import SearchUsers from './pages/SearchUsers';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';
import KYCForm from './pages/KYCForm';
import CreateProject from './pages/CreateProject_Enhanced';
import AdminPanel from './pages/AdminPanel';
import AdminLayout from './components/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import RoleSelection from './components/RoleSelection';
import TutorialPopup from './components/TutorialPopup';
import Wallet from './pages/Wallet';
import Portfolio from './pages/Portfolio';
import HowItWorks from './pages/HowItWorks';
import Governance from './pages/Governance';
import Analytics from './pages/Analytics';
import { TutorialProvider } from './contexts/TutorialContext';
import TutorialOverlay from './components/TutorialOverlay';

// Temporary simple components - all real components are now imported
// Campaign component is now imported from './pages/Campaign'
// const Register = () => <SimplePage title="📝 Register Page" />;
// Dashboard component is now imported from './pages/Dashboard'
// NotFound component is now imported from './pages/NotFound'

// Styles
import './styles/globals.css';
import './styles/layout.css';
import './styles/card.css';
import './styles/form.css';
import './styles/util.css';

function AppContent() {
  console.log('App component rendering...');
  const { isAuthenticated, roleStatus } = useAuth();
  const location = useLocation();

  const mainRef = useRef(null);
  const discoverProjectsButtonRef = useRef(null);
  const opportunitiesRef = useRef(null);
  const howItWorksRef = useRef(null);
  const governanceRef = useRef(null);
  const analyticsRef = useRef(null);
  const dashboardNavRef = useRef(null);
  const walletNavRef = useRef(null);
  const profileNavRef = useRef(null);
  const userRole = roleStatus?.role || 'investor';

  const shouldRunSpotlightTutorial =
    isAuthenticated &&
    location.pathname.startsWith('/dashboard') &&
    localStorage.getItem('pendingDashboardTutorial') === 'true';

  const tutorialSteps = useMemo(() => {
    const steps = [
      {
        id: 'nav-opportunities',
        targetRef: opportunitiesRef,
        title: 'Opportunities',
        description:
          'Browse investment opportunities and evaluate campaigns before committing funds.',
        route: '/explore',
        position: 'bottom',
      },
      {
        id: 'nav-how-it-works',
        targetRef: howItWorksRef,
        title: 'How It Works',
        description:
          'Open this to understand the full funding lifecycle, voting flow, and platform process.',
        route: '/how-it-works',
        position: 'bottom',
      },
      {
        id: 'nav-governance',
        targetRef: governanceRef,
        title: 'Governance',
        description:
          'Use governance to understand voting rights, milestone approvals, and refund decisions.',
        route: '/governance',
        position: 'bottom',
      },
      {
        id: 'nav-analytics',
        targetRef: analyticsRef,
        title: 'Analytics',
        description:
          'Track key platform and campaign metrics here to make better investment decisions.',
        route: '/analytics',
        position: 'bottom',
      },
      {
        id: 'nav-dashboard',
        targetRef: dashboardNavRef,
        title: 'Dashboard',
        description:
          'Return to your personal dashboard anytime to monitor investments and activity.',
        route: '/dashboard',
        position: 'bottom',
      },
      {
        id: 'workspace-area',
        targetRef: mainRef,
        title: 'Workspace Area',
        description:
          'This is your main workspace where dashboard content, onboarding, and campaign tools are displayed.',
        route: '/dashboard',
        position: 'top',
      },
    ];

    if (isAuthenticated && userRole !== 'admin') {
      steps.push({
        id: 'nav-wallet',
        targetRef: walletNavRef,
        title: 'Wallet',
        description:
          'Open Wallet to check your FC balance, locked funds, and transaction activity.',
        route: '/wallet',
        position: 'bottom',
      });
    }

    if (isAuthenticated) {
      steps.push({
        id: 'nav-profile',
        targetRef: profileNavRef,
        title: 'Profile',
        description:
          'Manage your profile details and account settings from here.',
        route: '/profile',
        position: 'bottom',
      });
    }

    if (userRole === 'investor') {
      steps.push({
        id: 'discover-projects',
        targetRef: discoverProjectsButtonRef,
        title: 'Discover Projects',
        description:
          'Click this button to discover active campaigns, review risk details, and start investing with confidence.',
        route: '/explore',
        position: 'bottom',
      });
    }

    return steps;
  }, [isAuthenticated, userRole]);

  const activeSteps = shouldRunSpotlightTutorial ? tutorialSteps : [];
  
  return (
    <Routes>
            {/* Admin route - completely separate layout */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requireRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              } 
            />

            {/* Dedicated full-screen tutorial route */}
            <Route path="/tutorial" element={<TutorialPopup />} />
            
            {/* All other routes use the normal layout */}
            <Route 
              path="/*" 
              element={
                <TutorialProvider steps={activeSteps}>
                  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                    <Header
                      tutorialRefs={{
                        opportunitiesRef,
                        howItWorksRef,
                        governanceRef,
                        analyticsRef,
                        dashboardNavRef,
                        walletNavRef,
                        profileNavRef,
                      }}
                    />
                    <main ref={mainRef} style={{ flex: 1 }}>
                      <Routes>
                      {/* Public routes */}
                      <Route path="/" element={<Home />} />
                      <Route path="/explore" element={<Explore />} />
                      <Route path="/campaigns" element={<Explore />} />
                      <Route path="/search" element={<SearchUsers />} />
                      <Route path="/how-it-works" element={<HowItWorks />} />
                      <Route path="/governance" element={<Governance />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/campaign/:slug" element={<Campaign />} />
                      <Route path="/login" element={
                        <PublicRoute>
                          <Login />
                        </PublicRoute>
                      } />
                      <Route path="/register" element={
                        <PublicRoute>
                          <Register />
                        </PublicRoute>
                      } />
                      <Route path="/create-account" element={
                        <PublicRoute>
                          <Register />
                        </PublicRoute>
                      } />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      
                      {/* Role Selection - For Google OAuth users without a role */}
                      <Route 
                        path="/role-selection" 
                        element={
                          <ProtectedRoute>
                            <RoleSelection />
                          </ProtectedRoute>
                        } 
                      />
                      
                      {/* Profile routes */}
                      <Route 
                        path="/profile" 
                        element={
                          <ProtectedRoute requireEmailConfirmed>
                            <Profile />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/profile-edit" 
                        element={
                          <ProtectedRoute requireEmailConfirmed>
                            <ProfileEdit />
                          </ProtectedRoute>
                        } 
                      />
                      {/* Public profile view */}
                      <Route path="/profile/:username" element={<PublicProfile />} />
                      
                      {/* Onboarding routes */}
                      <Route 
                        path="/kyc" 
                        element={
                          <ProtectedRoute requireEmailConfirmed requireRole>
                            <KYCForm />
                          </ProtectedRoute>
                        } 
                      />
                      
                      {/* Protected routes */}
                      <Route 
                        path="/dashboard" 
                        element={
                          <ProtectedRoute>
                            <Dashboard tutorialRefs={{ discoverProjectsButtonRef }} />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/create-project" 
                        element={
                          <ProtectedRoute requireRole="creator" requireKYC>
                            <CreateProject />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/edit-campaign/:campaignId" 
                        element={
                          <ProtectedRoute requireRole="creator" requireKYC>
                            <CreateProject />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/wallet" 
                        element={
                          <ProtectedRoute>
                            <Wallet />
                          </ProtectedRoute>
                        }
                      />
                      <Route 
                        path="/portfolio" 
                        element={
                          <ProtectedRoute>
                            <Portfolio />
                          </ProtectedRoute>
                        }
                      />
                      
                      {/* 404 catch-all */}
                      <Route path="*" element={<NotFound />} />
                      </Routes>
                    </main>
                    <Footer />
                    
                    {/* Global Chat Widget - visible on all non-admin pages for authenticated users */}
                    <ChatWidget />
                    <TutorialOverlay />
                  </div>
                </TutorialProvider>
              }
            />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <NetworkStatus />
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

export default App;