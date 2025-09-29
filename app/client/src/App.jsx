import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
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
import NotFound from './pages/NotFound';
import SelectRole from './pages/SelectRole';
import KYCForm from './pages/KYCForm';
import CreateProject from './pages/CreateProject';
import ProtectedRoute from './components/ProtectedRoute';

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
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
              <Header />
              <main style={{ flex: 1 }}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/explore" element={<Explore />} />
                  <Route path="/campaign/:slug" element={<Campaign />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  
                  {/* Onboarding routes */}
                  <Route 
                    path="/select-role" 
                    element={
                      <ProtectedRoute requireEmailConfirmed>
                        <SelectRole />
                      </ProtectedRoute>
                    } 
                  />
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
                  
                  {/* 404 catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;