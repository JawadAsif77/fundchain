import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/howitworks.css';

const HowItWorks = () => {
  const navigate = useNavigate();

  const handleJoinAsCreator = () => {
    navigate('/register');
  };

  const handleStartExploring = () => {
    navigate('/explore');
  };

  const handleCreateCampaign = () => {
    navigate('/create-project');
  };

  return (
    <div className="how-it-works">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Empowering Smart, Transparent, and Secure Investments
            </h1>
            <p className="hero-subtitle">
              FundChain connects campaign creators and investors through 
              FC token-based funding with milestone escrow and investor voting governance.
            </p>
            <div className="hero-buttons">
              <button 
                className="btn btn-primary"
                onClick={handleJoinAsCreator}
              >
                Join as Creator
              </button>
              <button 
                className="btn btn-secondary"
                onClick={handleStartExploring}
              >
                Start Exploring
              </button>
            </div>
          </div>
          <div className="hero-illustration">
            <div className="blockchain-nodes">
              <div className="node node-1"></div>
              <div className="node node-2"></div>
              <div className="node node-3"></div>
              <div className="connection connection-1"></div>
              <div className="connection connection-2"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Overview */}
      <section className="platform-overview">
        <div className="container">
          <h2 className="section-title">Built on Three Pillars of Trust</h2>
          <div className="pillars-grid">
            <div className="pillar-card">
              <div className="pillar-icon">🔒</div>
              <h3>Secure Blockchain Escrow</h3>
              <p>
                Every transaction is recorded on the Solana blockchain, 
                ensuring full transparency and traceability.
              </p>
            </div>
            <div className="pillar-card">
              <div className="pillar-icon">🤖</div>
              <h3>AI-Powered Risk & Trust Scoring</h3>
              <p>
                FundChain's AI evaluates campaigns, KYC data, and user behavior 
                to build a trust score for both creators and investors.
              </p>
            </div>
            <div className="pillar-card">
              <div className="pillar-icon">🪙</div>
              <h3>FundChain Token (FC)</h3>
              <p>
                FC tokens power all platform transactions with instant settlements, 
                low fees, and seamless USD exchange (1 USD = 1 FC).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For Creators */}
      <section className="creators-section">
        <div className="container">
          <div className="section-content">
            <div className="content-text">
              <h2 className="section-title">
                Launch Your Business, Funded by the Crowd—Safely and Transparently
              </h2>
              <div className="timeline">
                <div className="timeline-item">
                  <div className="timeline-icon">📝</div>
                  <div className="timeline-content">
                    <h4>Register & Complete KYC</h4>
                    <p>Verify business & identity.</p>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-icon">🚀</div>
                  <div className="timeline-content">
                    <h4>Create Campaign</h4>
                    <p>Set funding goals, milestones, and upload media.</p>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-icon">🔍</div>
                  <div className="timeline-content">
                    <h4>AI Review & Admin Approval</h4>
                    <p>Automatic trust-score analysis before going live.</p>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-icon">📈</div>
                  <div className="timeline-content">
                    <h4>Go Live</h4>
                    <p>Investors fund milestones securely.</p>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-icon">💰</div>
                  <div className="timeline-content">
                    <h4>Withdraw Funds by Milestone</h4>
                    <p>Release triggered only after investor and AI milestone verification.</p>
                  </div>
                </div>
              </div>
              
              <div className="why-creators-love">
                <h3>Why Creators Love FundChain</h3>
                <div className="benefits-grid">
                  <div className="benefit-item">
                    <span className="benefit-icon">🌍</span>
                    <span>Instant exposure to global investors</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">🔐</span>
                    <span>Smart contract-based payouts</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">🛡️</span>
                    <span>Fraud protection via AI monitoring</span>
                  </div>
                  <div className="benefit-item">
                    <span className="benefit-icon">📊</span>
                    <span>In-depth analytics dashboard</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="content-illustration">
              <div className="creator-workflow">
                <div className="workflow-step">
                  <div className="step-icon">📄</div>
                  <div className="step-label">Upload Documents</div>
                </div>
                <div className="workflow-arrow">→</div>
                <div className="workflow-step">
                  <div className="step-icon">🎯</div>
                  <div className="step-label">Set Milestones</div>
                </div>
                <div className="workflow-arrow">→</div>
                <div className="workflow-step">
                  <div className="step-icon">✅</div>
                  <div className="step-label">Get Funded</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Investors */}
      <section className="investors-section">
        <div className="container">
          <div className="section-content reverse">
            <div className="content-illustration">
              <div className="investor-dashboard">
                <div className="dashboard-header">
                  <h4>Your Portfolio</h4>
                  <div className="portfolio-value">$125,430</div>
                </div>
                <div className="investment-cards">
                  <div className="investment-card">
                    <div className="investment-info">
                      <span className="company">GreenTech Solutions</span>
                      <span className="amount">$5,000</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress" style={{width: '75%'}}></div>
                    </div>
                  </div>
                  <div className="investment-card">
                    <div className="investment-info">
                      <span className="company">AI MedCare</span>
                      <span className="amount">$3,500</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress" style={{width: '60%'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="content-text">
              <h2 className="section-title">
                Invest in Verified Businesses. Track Every Dollar.
              </h2>
              <div className="timeline">
                <div className="timeline-item">
                  <div className="timeline-icon">👤</div>
                  <div className="timeline-content">
                    <h4>Sign Up & Select Role as Investor</h4>
                    <p>Quick registration process to get started.</p>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-icon">🔍</div>
                  <div className="timeline-content">
                    <h4>Discover High-Potential Campaigns</h4>
                    <p>Browse verified opportunities via Explore.</p>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-icon">🤖</div>
                  <div className="timeline-content">
                    <h4>View AI-Generated Trust Score</h4>
                    <p>See detailed risk analysis for each campaign.</p>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-icon">💳</div>
                  <div className="timeline-content">
                    <h4>Invest Using FC Tokens</h4>
                    <p>Exchange USD to FC (1:1) and fund campaigns instantly.</p>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-icon">📊</div>
                  <div className="timeline-content">
                    <h4>Track Progress & Milestone Unlocks</h4>
                    <p>Monitor your investments in real-time.</p>
                  </div>
                </div>
                <div className="timeline-item">
                  <div className="timeline-icon">💰</div>
                  <div className="timeline-content">
                    <h4>Withdraw or Reinvest Profits</h4>
                    <p>Flexible profit management after successful campaigns.</p>
                  </div>
                </div>
              </div>
              
              <div className="investor-perks">
                <h3>Investor Perks</h3>
                <div className="perks-grid">
                  <div className="perk-card">
                    <div className="perk-icon">📈</div>
                    <h4>Portfolio Analytics</h4>
                    <p>Comprehensive performance tracking</p>
                  </div>
                  <div className="perk-card">
                    <div className="perk-icon">🎯</div>
                    <h4>Milestone-Based Security</h4>
                    <p>Risk mitigation through staged funding</p>
                  </div>
                  <div className="perk-card">
                    <div className="perk-icon">🤖</div>
                    <h4>AI-Verified Transparency</h4>
                    <p>Automated due diligence and monitoring</p>
                  </div>
                  <div className="perk-card">
                    <div className="perk-icon">🔗</div>
                    <h4>On-Chain Audit Trail</h4>
                    <p>Complete transaction transparency</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safety & Verification */}
      <section className="safety-section">
        <div className="container">
          <h2 className="section-title">Safety & Verification</h2>
          <p className="section-subtitle">
            "Transparency isn't a feature—it's the foundation."
          </p>
          <div className="safety-features">
            <div className="safety-card">
              <div className="safety-icon">🧾</div>
              <h3>KYC Verification</h3>
              <p>All creators are verified by AI and human checks before campaign launch.</p>
            </div>
            <div className="safety-card">
              <div className="safety-icon">🔍</div>
              <h3>AI Anomaly Detection</h3>
              <p>Continuous fraud monitoring ensures safe transactions.</p>
            </div>
            <div className="safety-card">
              <div className="safety-icon">💡</div>
              <h3>Smart Escrow Contracts</h3>
              <p>Funds are locked until milestones are approved by both sides.</p>
            </div>
            <div className="safety-card">
              <div className="safety-icon">🧠</div>
              <h3>Transparent Analytics</h3>
              <p>Every funding event is publicly auditable via Solana Explorer.</p>
              <Link to="/analytics" className="card-link">View Platform Analytics →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Diagram */}
      <section className="workflow-section">
        <div className="container">
          <h2 className="section-title">FundChain Workflow</h2>
          <div className="workflow-diagram">
            <div className="workflow-step-large">
              <div className="step-icon-large">📤</div>
              <h3>Creator Submits</h3>
              <p>Campaign and documents uploaded</p>
            </div>
            <div className="workflow-arrow-large">→</div>
            <div className="workflow-step-large">
              <div className="step-icon-large">🤖</div>
              <h3>AI Reviews & Admin Approves</h3>
              <p>Automated analysis and verification</p>
            </div>
            <div className="workflow-arrow-large">→</div>
            <div className="workflow-step-large">
              <div className="step-icon-large">💰</div>
              <h3>Investors Fund Milestones</h3>
              <p>Staged investment process begins</p>
            </div>
            <div className="workflow-arrow-large">→</div>
            <div className="workflow-step-large">
              <div className="step-icon-large">🔓</div>
              <h3>Smart Contracts Release Funds</h3>
              <p>Milestone-based fund distribution</p>
            </div>
            <div className="workflow-arrow-large">→</div>
            <div className="workflow-step-large">
              <div className="step-icon-large">📊</div>
              <h3>AI Analytics Track Outcomes</h3>
              <p>Continuous monitoring and reporting</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials-section">
        <div className="container">
          <h2 className="section-title">Success Stories</h2>
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>"FundChain made our green energy startup possible—transparent and fair."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">🌱</div>
                <div className="author-info">
                  <h4>Sarah Chen</h4>
                  <span>EcoTech Solutions</span>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>"I can finally invest in early-stage businesses without worrying about scams."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">💼</div>
                <div className="author-info">
                  <h4>Marcus Rodriguez</h4>
                  <span>Angel Investor</span>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>"The milestone-based funding gives me confidence in every investment decision."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">📈</div>
                <div className="author-info">
                  <h4>Lisa Park</h4>
                  <span>Portfolio Manager</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call-to-Action Footer */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to start your journey?</h2>
            <p>Join thousands of creators and investors building the future of finance</p>
            <div className="cta-buttons">
              <button 
                className="btn btn-primary btn-large"
                onClick={handleCreateCampaign}
              >
                Create Campaign
              </button>
              <button 
                className="btn btn-secondary btn-large"
                onClick={handleStartExploring}
              >
                Explore Opportunities
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;