import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/governance.css';

const Governance = () => {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="governance-page">
      {/* Hero Section */}
      <section className="governance-hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <h1>FundChain Governance: Power to the Community</h1>
              <p>
                Milestones, fund releases, and platform policies are shaped by verified investors 
                and creators, with transparent records and AI-assisted integrity.
              </p>
              <div className="hero-ctas">
                <button 
                  onClick={() => scrollToSection('roadmap')}
                  className="btn btn-primary"
                >
                  View Roadmap
                </button>
                <button 
                  onClick={() => scrollToSection('workflow')}
                  className="btn btn-secondary"
                >
                  Learn How Voting Works
                </button>
              </div>
            </div>
            <div className="hero-illustration">
              <div className="governance-icons">
                <div className="icon-circle voting">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                  </svg>
                </div>
                <div className="icon-circle shield">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                  </svg>
                </div>
                <div className="icon-circle contract">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What Governance Means */}
      <section className="governance-pillars">
        <div className="container">
          <h2>What Governance Means</h2>
          <div className="pillars-grid">
            <div className="pillar-card">
              <div className="pillar-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
              <h3>Milestone-based Approvals</h3>
              <p>Investors validate progress before funds unlock, ensuring accountability and project success.</p>
            </div>
            <div className="pillar-card">
              <div className="pillar-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
              </div>
              <h3>Transparent Decisions</h3>
              <p>All votes and outcomes are recorded immutably, providing complete audit trails for community review.</p>
            </div>
            <div className="pillar-card">
              <div className="pillar-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5.5l2 2h1l2-2H20c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-9 13.5L7.5 12 6 13.5 11 18.5l7.5-7.5L17 9.5l-6 6z"/>
                </svg>
              </div>
              <h3>AI Safeguards</h3>
              <p>Advanced anomaly detection reduces collusion and fraud, maintaining integrity in all decisions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Governance Workflow */}
      <section id="workflow" className="governance-workflow">
        <div className="container">
          <h2>Governance Workflow</h2>
          <div className="workflow-timeline">
            <div className="timeline-step">
              <div className="step-number">1</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
                </svg>
              </div>
              <h3>Proposal Created</h3>
              <p>Creator submits milestone release or platform update with supporting documentation.</p>
            </div>
            <div className="timeline-step">
              <div className="step-number">2</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
              </div>
              <h3>Review Phase</h3>
              <p>Investors examine context, files, and community comments before making decisions.</p>
            </div>
            <div className="timeline-step">
              <div className="step-number">3</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                </svg>
              </div>
              <h3>Voting Window</h3>
              <p>Investors cast votes weighted by their FC token investment in the campaign.</p>
            </div>
            <div className="timeline-step">
              <div className="step-number">4</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h3>Result & Audit</h3>
              <p>Quorum and majority requirements verified; results permanently logged.</p>
            </div>
            <div className="timeline-step">
              <div className="step-number">5</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h3>Execution</h3>
              <p>Smart contracts (future) or system automatically executes approved decisions.</p>
            </div>
          </div>
          
          <div className="key-rules">
            <h3>Key Rules</h3>
            <ul>
              <li><strong>Voting Weight:</strong> Equal per investor (MVP) → configurable weight systems later</li>
              <li><strong>Quorum:</strong> Simple majority in MVP (configurable per campaign in future)</li>
              <li><strong>Voting Window:</strong> 72 hours by default (customizable based on proposal type)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Roles & Responsibilities */}
      <section className="governance-roles">
        <div className="container">
          <h2>Roles & Responsibilities</h2>
          <div className="roles-grid">
            <div className="role-card">
              <div className="role-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3>Creators</h3>
              <ul>
                <li>Propose milestone releases and fund disbursements</li>
                <li>Provide evidence of progress and deliverables</li>
                <li>Respond to investor questions and concerns</li>
              </ul>
              <p className="future-note">Future: Stake FC tokens for proposal rights</p>
            </div>
            <div className="role-card">
              <div className="role-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h3>Investors</h3>
              <ul>
                <li>Review proposals and cast informed votes</li>
                <li>Comment on milestones and flag concerns</li>
                <li>Participate in dispute resolution processes</li>
              </ul>
              <p className="future-note">Future: Delegated voting and weighted participation</p>
            </div>
            <div className="role-card">
              <div className="role-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5.5l2 2h1l2-2H20c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
              </div>
              <h3>AI Moderator</h3>
              <ul>
                <li>Flags anomalies like duplicate wallets</li>
                <li>Detects unusual voting patterns and behavior</li>
                <li>Provides integrity scores for proposals</li>
              </ul>
              <p className="future-note">Future: Real-time fraud prevention algorithms</p>
            </div>
            <div className="role-card">
              <div className="role-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                </svg>
              </div>
              <h3>FundChain Council</h3>
              <ul>
                <li>Resolves disputes and appeals</li>
                <li>Enforces platform policies and guidelines</li>
                <li>Manages emergency interventions when needed</li>
              </ul>
              <p className="future-note">Future: Elected council with term limits</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Transparency */}
      <section className="governance-transparency">
        <div className="container">
          <h2>Trust & Transparency</h2>
          <div className="transparency-features">
            <div className="features-column">
              <div className="feature-item">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span>On-chain audit trail (Phase 3+)</span>
              </div>
              <div className="feature-item">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span>Public proposal history</span>
              </div>
              <div className="feature-item">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span>Immutable milestone outcomes</span>
              </div>
            </div>
            <div className="features-column">
              <div className="feature-item">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span>Open rules: quorum, weights, durations</span>
              </div>
              <div className="feature-item">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span>KYC-verified participants only</span>
              </div>
              <div className="feature-item">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span>Real-time voting transparency</span>
              </div>
            </div>
          </div>
          <div className="transparency-cta">
            <p>
              Want to see governance in action? 
              <Link to="/analytics" className="inline-link">View platform analytics →</Link>
            </p>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="governance-roadmap">
        <div className="container">
          <h2>Governance Roadmap</h2>
          <div className="roadmap-timeline">
            <div className="roadmap-phase current">
              <div className="phase-badge">Phase A - Current</div>
              <h3>Off-chain Foundation</h3>
              <p>Off-chain proposals and voting system with database logging and basic audit trails.</p>
              <ul>
                <li>Proposal creation and review system</li>
                <li>Basic voting mechanisms</li>
                <li>Database-backed decision logging</li>
              </ul>
            </div>
            <div className="roadmap-phase">
              <div className="phase-badge">Phase B - Q1 2026</div>
              <h3>AI Integration</h3>
              <p>AI anomaly scoring and fraud detection integrated into the proposal and voting process.</p>
              <ul>
                <li>Automated fraud detection</li>
                <li>Proposal quality scoring</li>
                <li>Advanced participant verification</li>
              </ul>
            </div>
            <div className="roadmap-phase">
              <div className="phase-badge">Phase C - Q3 2026</div>
              <h3>Smart Contract Governance</h3>
              <p>Solana smart contracts for milestone escrow and automated vote execution.</p>
              <ul>
                <li>On-chain milestone escrow</li>
                <li>Automated fund release</li>
                <li>Immutable voting records</li>
              </ul>
            </div>
            <div className="roadmap-phase">
              <div className="phase-badge">Phase D - 2027</div>
              <h3>Advanced Democracy</h3>
              <p>Staking, delegated voting, and open governance portal for complete decentralization.</p>
              <ul>
                <li>Token staking for governance rights</li>
                <li>Delegated voting mechanisms</li>
                <li>Public governance portal</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="governance-faq">
        <div className="container">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            {[
              {
                question: "What happens if there's a tie in voting?",
                answer: "In case of a tie, the proposal fails by default. However, there's a 24-hour extension period where additional votes can be cast to break the tie. If the tie persists, the FundChain Council can intervene for critical decisions."
              },
              {
                question: "Can a proposal be appealed or reversed?",
                answer: "Yes, proposals can be appealed within 48 hours of the final result. Appeals must present new evidence or identify procedural violations. The FundChain Council reviews appeals and can order a revote if justified."
              },
              {
                question: "How is AI used in governance decisions?",
                answer: "AI doesn't make decisions but assists by flagging suspicious patterns, detecting duplicate accounts, analyzing proposal quality, and providing integrity scores. All final decisions remain with human participants."
              },
              {
                question: "Who can participate in governance voting?",
                answer: "Currently, all KYC-verified investors in a campaign can vote on its milestones. In the future, we'll introduce weighted voting based on investment amounts and staking participation."
              },
              {
                question: "How are voting weights determined?",
                answer: "In the MVP phase, each verified investor has equal voting weight. Future phases will introduce configurable weight systems based on investment amounts, staking, and reputation scores."
              },
              {
                question: "What information is public vs private in governance?",
                answer: "Vote outcomes, proposal details, and milestone results are public. Individual vote choices are private unless voters choose to make them public. Personal information remains confidential."
              }
            ].map((faq, index) => (
              <div key={index} className={`faq-item ${openFaq === index ? 'open' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => toggleFaq(index)}
                >
                  <span>{faq.question}</span>
                  <svg
                    className={`faq-icon ${openFaq === index ? 'rotated' : ''}`}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                  </svg>
                </button>
                {openFaq === index && (
                  <div className="faq-answer">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="governance-cta">
        <div className="container">
          <div className="cta-content">
            <div className="cta-section">
              <h3>Ready to Participate?</h3>
              <p>Join our community-driven platform and help shape the future of decentralized funding.</p>
              <div className="cta-buttons">
                <Link to="/how-it-works" className="btn btn-primary">
                  See How Milestones Work
                </Link>
                <Link to="/explore" className="btn btn-secondary">
                  Explore Campaigns
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Governance;