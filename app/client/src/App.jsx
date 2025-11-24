import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Footer from './components/Footer';

// Pages
import Home from './pages/Home';
import Explore from './pages/Explore';
import Campaign from './pages/Campaign';
import Login from './pages/Login_simple';
import Register from './pages/Register_simple';
import Dashboard from './pages/Dashboard';
import Profile from './pages/ProfileDisplay';
import ProfileEdit from './pages/ProfileEdit';
import NotFound from './pages/NotFound';
import KYCForm from './pages/KYCForm';
import CreateProject from './pages/CreateProject';
import AdminPanel from './pages/AdminPanel';
import AdminLayout from './components/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Wallet from './pages/Wallet';
import HowItWorks from './pages/HowItWorks';
import Governance from './pages/Governance';
import Analytics from './pages/Analytics';

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

function App() {
  console.log('App component rendering...');
  
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
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
            
            {/* All other routes use the normal layout */}
            <Route 
              path="/*" 
              element={
                <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                  <Header />
                  <main style={{ flex: 1 }}>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/" element={<Home />} />
                      <Route path="/explore" element={<Explore />} />
                      <Route path="/how-it-works" element={<HowItWorks />} />
                      <Route path="/governance" element={<Governance />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/campaign/:slug" element={<Campaign />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      
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
                            <Dashboard />
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
                        path="/wallet" 
                        element={
                          <ProtectedRoute>
                            <Wallet />
                          </ProtectedRoute>
                        }
                      />
                      
                      {/* 404 catch-all */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                  <Footer />
                </div>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;