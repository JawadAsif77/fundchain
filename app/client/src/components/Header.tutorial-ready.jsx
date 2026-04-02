/**
 * COMPLETE HEADER EXAMPLE - Updated to work with Tutorial System
 * 
 * This shows how to attach tutorial refs to your Navigation
 * Copy this pattern for your actual Header.jsx
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletButton from './WalletButton';
import './Header.css';

export default function Header({ tutorialRefs = {} }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const { connected } = useWallet();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="header sticky top-0 z-40 bg-slate-900 border-b border-slate-800">
      <nav className="header-nav container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo / Brand */}
        <Link to="/" className="header-logo text-2xl font-bold text-emerald-600 hover:text-emerald-500 transition-colors">
          FundChain
        </Link>

        {/* Center Navigation - Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {/* Wallet Button - Tutorial Target #1 */}
          <div ref={tutorialRefs.walletButtonRef}>
            <WalletButton />
          </div>

          {/* Discover Link - Tutorial Target #2 */}
          <Link
            ref={tutorialRefs.discoverRef}
            to="/explore"
            className="text-white/80 hover:text-white font-medium transition-colors flex items-center gap-2"
          >
            🔍 <span>Discover</span>
          </Link>

          {/* Create Link - Tutorial Target #3 */}
          <Link
            ref={tutorialRefs.createRef}
            to="/create-project"
            className="text-white/80 hover:text-white font-medium transition-colors flex items-center gap-2"
          >
            ➕ <span>Create</span>
          </Link>

          {/* Analytics Link - Tutorial Target #4 */}
          <Link
            ref={tutorialRefs.analyticsRef}
            to="/analytics"
            className="text-white/80 hover:text-white font-medium transition-colors flex items-center gap-2"
          >
            📊 <span>Analytics</span>
          </Link>

          {/* Help Link - Tutorial Target #5 */}
          <Link
            ref={tutorialRefs.helpRef}
            to="/how-it-works"
            className="text-white/80 hover:text-white font-medium transition-colors flex items-center gap-2"
          >
            ❓ <span>Help</span>
          </Link>
        </div>

        {/* Right Side - User Menu / Mobile Toggle */}
        <div className="flex items-center gap-4">
          {/* Desktop User Menu */}
          {user && (
            <div className="hidden md:flex items-center gap-4">
              <Link
                to="/dashboard"
                className="text-white/80 hover:text-white font-medium transition-colors"
              >
                📊 Dashboard
              </Link>
              <Link
                to="/profile"
                className="text-white/80 hover:text-white font-medium transition-colors"
              >
                👤 Profile
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
              >
                Logout
              </button>
            </div>
          )}

          {/* Not Logged In */}
          {!user && (
            <div className="hidden md:flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 text-white/80 hover:text-white transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white text-2xl"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-800 border-t border-slate-700 py-4 px-4 space-y-3">
          <Link
            to="/explore"
            className="block text-white/80 hover:text-white py-2 px-4 hover:bg-slate-700 rounded transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            🔍 Discover
          </Link>
          <Link
            to="/create-project"
            className="block text-white/80 hover:text-white py-2 px-4 hover:bg-slate-700 rounded transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            ➕ Create
          </Link>
          <Link
            to="/analytics"
            className="block text-white/80 hover:text-white py-2 px-4 hover:bg-slate-700 rounded transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            📊 Analytics
          </Link>
          <Link
            to="/how-it-works"
            className="block text-white/80 hover:text-white py-2 px-4 hover:bg-slate-700 rounded transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            ❓ Help
          </Link>

          {user && (
            <>
              <hr className="border-slate-700" />
              <Link
                to="/dashboard"
                className="block text-white/80 hover:text-white py-2 px-4 hover:bg-slate-700 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                📊 Dashboard
              </Link>
              <Link
                to="/profile"
                className="block text-white/80 hover:text-white py-2 px-4 hover:bg-slate-700 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                👤 Profile
              </Link>
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded transition-colors"
              >
                Logout
              </button>
            </>
          )}

          {!user && (
            <>
              <hr className="border-slate-700" />
              <Link
                to="/login"
                className="block text-white/80 hover:text-white py-2 px-4 hover:bg-slate-700 rounded transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                to="/register"
                className="block bg-emerald-600 text-white py-2 px-4 rounded hover:bg-emerald-700 transition-colors text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
