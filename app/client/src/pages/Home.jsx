import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import CampaignCard from '../components/CampaignCard';
import { campaignApi } from '../lib/api';

const Home = () => {
  const { user } = useAuth();
  const [showChatbot, setShowChatbot] = useState(false);
  const [featuredCampaigns, setFeaturedCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch real campaigns from database
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const { data } = await campaignApi.getCampaigns({ status: 'active' });
        // Get top 3 campaigns sorted by raised amount
        const top3 = (data || [])
          .sort((a, b) => (b.current_funding || 0) - (a.current_funding || 0))
          .slice(0, 3);
        setFeaturedCampaigns(top3);
      } catch (error) {
        console.error('Failed to fetch campaigns:', error);
        setFeaturedCampaigns([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCampaigns();
  }, []);

  // Features data
  const features = [
    {
      icon: '📊',
      title: 'AI Risk Assessment',
      description: 'Machine learning algorithms analyze campaign viability, creator history, and market conditions to provide comprehensive risk scores.',
      benefits: ['Real-time risk evaluation', '95% accuracy rate', 'Historical performance analysis'],
      color: '#10B981'
    },
    {
      icon: '🔒',
      title: 'Milestone-based Escrow',
      description: 'FC tokens are held in smart contract escrow and released only when campaign milestones are approved by investor voting.',
      benefits: ['Automated escrow management', 'Investor-controlled releases', 'Milestone verification'],
      color: '#3B82F6'
    },
    {
      icon: '👥',
      title: 'Voting Governance',
      description: 'Investors vote on milestone completion using investment-weighted governance. Consensus determines fund release.',
      benefits: ['Democratic milestone voting', 'Investment-weighted votes', 'Transparent consensus'],
      color: '#8B5CF6'
    },
    {
      icon: '⚡',
      title: 'Solana-Powered Speed',
      description: 'Lightning-fast FC token transactions with minimal fees on the high-performance Solana blockchain.',
      benefits: ['Sub-second settlements', 'Low transaction fees', 'High throughput'],
      color: '#F59E0B'
    },
    {
      icon: '🤖',
      title: 'Smart Contract Escrow',
      description: 'Automated escrow system ensures funds are protected and released based on verified milestone completion.',
      benefits: ['Trustless transactions', 'Automated releases', 'Immutable records'],
      color: '#6366F1'
    },
    {
      icon: '📈',
      title: 'Portfolio Tracking',
      description: 'Real-time dashboards track your FC token investments, milestone progress, and campaign performance.',
      benefits: ['Live portfolio updates', 'Milestone tracking', 'Performance analytics'],
      color: '#059669'
    }
  ];

  // How it works steps
  const steps = [
    {
      icon: '�',
      title: 'Connect & Get FC Tokens',
      description: 'Connect your Solana wallet and exchange USD for FC tokens to start funding campaigns.',
      details: [
        'Connect Solana wallet (Phantom, Solflare, etc.)',
        'Exchange USD to FC tokens (1 USD = 1 FC)',
        'Complete KYC verification for access'
      ],
      color: '#3B82F6'
    },
    {
      icon: '🔍',
      title: 'Discover Campaigns',
      description: 'Browse verified campaigns with AI risk scores, milestone plans, and creator backgrounds.',
      details: [
        'View active campaigns with risk ratings',
        'Review campaign milestones and funding goals',
        'Check creator profiles and past performance'
      ],
      color: '#10B981'
    },
    {
      icon: '📈',
      title: 'Invest & Vote',
      description: 'Fund campaigns with FC tokens and vote on milestone completion to control fund releases.',
      details: [
        'Invest FC tokens in campaigns',
        'Vote on milestone approval (investment-weighted)',
        'Track milestone progress in real-time'
      ],
      color: '#8B5CF6'
    },
    {
      icon: '�',
      title: 'Track Performance',
      description: 'Monitor campaign progress, vote on releases, and track your FC token portfolio performance.',
      details: [
        'Real-time portfolio dashboard',
        'Milestone-based fund releases',
        'Campaign success notifications'
      ],
      color: '#F59E0B'
    }
  ];

  return (
    <div>
      {/* Hero Section */}
      <section style={{ 
        backgroundColor: 'white',
        padding: '80px 20px 120px 20px',
        position: 'relative'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: window.innerWidth >= 1024 ? '1fr 1fr' : '1fr',
            gap: '60px',
            alignItems: 'center'
          }}>
            {/* Left Column - Content */}
            <div>
              {/* Badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#29C7AC',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.875rem',
                fontWeight: '600',
                marginBottom: '32px'
              }}>
                <span style={{ marginRight: '8px' }}>⚡</span>
                Powered by Solana Blockchain
              </div>

              {/* Headline */}
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{ 
                  fontSize: window.innerWidth >= 1024 ? '3.5rem' : '2.5rem',
                  fontWeight: 'bold', 
                  lineHeight: '1.1',
                  color: '#1a202c',
                  marginBottom: '16px'
                }}>
                  Smart Investment
                  <br />
                  <span style={{ 
                    background: 'linear-gradient(135deg, #29C7AC, #0B132B)', 
                    WebkitBackgroundClip: 'text', 
                    WebkitTextFillColor: 'transparent' 
                  }}>
                    Platform
                  </span>
                </h1>
                <p style={{ 
                  fontSize: '1.125rem', 
                  color: '#4a5568',
                  lineHeight: '1.6',
                  maxWidth: '500px'
                }}>
                  Fund innovative campaigns with FC tokens. Milestone-based escrow releases, 
                  AI-powered risk scoring, and investor voting governance on Solana blockchain.
                </p>
              </div>

              {/* Stats */}
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px',
                paddingTop: '16px',
                marginBottom: '32px'
              }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#29C7AC' }}>2.5M+ FC</div>
                  <div style={{ fontSize: '0.875rem', color: '#4a5568' }}>Total Funded</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#29C7AC' }}>150+</div>
                  <div style={{ fontSize: '0.875rem', color: '#4a5568' }}>Active Campaigns</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#29C7AC' }}>95%</div>
                  <div style={{ fontSize: '0.875rem', color: '#4a5568' }}>Success Rate</div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div style={{ 
                display: 'flex', 
                flexDirection: window.innerWidth >= 640 ? 'row' : 'column',
                gap: '16px',
                marginBottom: '32px'
              }}>
                {user ? (
                  <>
                    <Link 
                      to="/dashboard" 
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: '#29C7AC',
                        color: 'white',
                        padding: '16px 32px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        textDecoration: 'none',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <span style={{ marginRight: '8px' }}>💼</span>
                      View Dashboard
                    </Link>
                    <Link 
                      to="/explore" 
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: 'transparent',
                        color: '#29C7AC',
                        padding: '16px 32px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        textDecoration: 'none',
                        fontSize: '1rem',
                        border: '2px solid #29C7AC',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      Explore Opportunities
                      <span style={{ marginLeft: '8px' }}>→</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link 
                      to="/register" 
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: '#29C7AC',
                        color: 'white',
                        padding: '16px 32px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        textDecoration: 'none',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <span style={{ marginRight: '8px' }}>🔗</span>
                      Connect Wallet
                    </Link>
                    <Link 
                      to="/explore" 
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: 'transparent',
                        color: '#29C7AC',
                        padding: '16px 32px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        textDecoration: 'none',
                        fontSize: '1rem',
                        border: '2px solid #29C7AC',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      Explore Opportunities
                      <span style={{ marginLeft: '8px' }}>→</span>
                    </Link>
                  </>
                )}
              </div>

              {/* Trust Indicators */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '24px',
                fontSize: '0.875rem', 
                color: '#4a5568',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#10B981' }}>📊</span>
                  <span>Risk Assessment</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#3B82F6' }}>👥</span>
                  <span>Verified Deals</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#8B5CF6' }}>📈</span>
                  <span>Growth Tracking</span>
                </div>
              </div>
            </div>

            {/* Right Column - Investment Dashboard Preview */}
            <div style={{ position: 'relative' }}>
              {/* Main Dashboard */}
              <div style={{
                position: 'relative',
                zIndex: '10',
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '32px',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.1)',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ marginBottom: '24px' }}>
                  {/* Header */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: '24px'
                  }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1a202c' }}>
                      GreenTech Solutions
                    </h3>
                    <div style={{
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      Active Investment
                    </div>
                  </div>

                  {/* Investment Progress */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '8px' }}>
                      <span style={{ color: '#4a5568' }}>Capital Raised</span>
                      <span style={{ fontWeight: '600' }}>75%</span>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      backgroundColor: '#f1f5f9', 
                      borderRadius: '8px', 
                      height: '12px',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        background: 'linear-gradient(135deg, #29C7AC, #0B132B)',
                        height: '12px',
                        borderRadius: '8px',
                        width: '75%'
                      }}></div>
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      fontSize: '0.75rem', 
                      color: '#64748b' 
                    }}>
                      <span>75,000 FC raised</span>
                      <span>100,000 FC target</span>
                    </div>
                  </div>

                  {/* Investment Metrics */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    marginBottom: '24px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#10B981', fontSize: '1.25rem', marginBottom: '4px' }}>💲</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Expected ROI</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#10B981' }}>28%</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#3B82F6', fontSize: '1.25rem', marginBottom: '4px' }}>📊</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Equity</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>12%</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#8B5CF6', fontSize: '1.25rem', marginBottom: '4px' }}>📈</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Risk</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#F59E0B' }}>Medium</div>
                    </div>
                  </div>

                  {/* Milestones */}
                  <div>
                    <h4 style={{ fontWeight: '600', marginBottom: '12px', color: '#1a202c' }}>
                      Capital Release Schedule
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { title: 'Product Development', amount: '25,000 FC', status: 'released' },
                        { title: 'Market Validation', amount: '30,000 FC', status: 'active' },
                        { title: 'Scale & Growth', amount: '45,000 FC', status: 'pending' },
                      ].map((milestone, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          borderRadius: '8px',
                          backgroundColor: '#f8fafc'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              height: '12px',
                              width: '12px',
                              borderRadius: '50%',
                              backgroundColor: 
                                milestone.status === 'released' ? '#10B981' :
                                milestone.status === 'active' ? '#29C7AC' :
                                '#cbd5e1'
                            }}></div>
                            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{milestone.title}</span>
                          </div>
                          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{milestone.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Elements */}
              <div style={{
                position: 'absolute',
                top: '-16px',
                right: '-16px',
                backgroundColor: '#29C7AC',
                color: 'white',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1)'
              }}>
                <span style={{ fontSize: '1.5rem' }}>📈</span>
              </div>
              
              <div style={{
                position: 'absolute',
                bottom: '-16px',
                left: '-16px',
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Portfolio Growth</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#10B981' }}>+24%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ padding: '80px 20px', backgroundColor: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{
              display: 'inline-block',
              backgroundColor: '#29C7AC',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '0.875rem',
              fontWeight: '600',
              marginBottom: '20px'
            }}>
              Investment Platform
            </div>
            <h2 style={{ 
              fontSize: '2.5rem', 
              fontWeight: 'bold', 
              color: '#1a202c',
              marginBottom: '16px'
            }}>
              Built for <span style={{ background: 'linear-gradient(135deg, #29C7AC, #0B132B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Smart Investing</span>
            </h2>
            <p style={{ 
              fontSize: '1.1rem', 
              color: '#4a5568',
              maxWidth: '800px',
              margin: '0 auto',
              lineHeight: '1.6'
            }}>
              FundChain combines cutting-edge blockchain technology with AI-powered analytics 
              to create the most sophisticated investment platform for growth businesses and institutional investors.
            </p>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
            gap: '30px',
            marginBottom: '40px'
          }}>
            {features.map((feature, index) => (
              <div key={index} style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '32px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e2e8f0',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 20px 25px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
              }}>
                <div style={{
                  display: 'inline-flex',
                  padding: '12px',
                  backgroundColor: feature.color + '20',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  fontSize: '1.5rem'
                }}>
                  {feature.icon}
                </div>
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  marginBottom: '12px', 
                  color: '#1a202c' 
                }}>
                  {feature.title}
                </h3>
                <p style={{ 
                  color: '#4a5568', 
                  lineHeight: '1.6',
                  marginBottom: '20px'
                }}>
                  {feature.description}
                </p>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  {feature.benefits.map((benefit, benefitIndex) => (
                    <div key={benefitIndex} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      fontSize: '0.875rem', 
                      color: '#4a5568',
                      marginBottom: '8px'
                    }}>
                      <span style={{ color: feature.color, marginRight: '8px' }}>→</span>
                      {benefit}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '25px',
              padding: '12px 24px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}>
              <span style={{ color: '#29C7AC', marginRight: '8px' }}>📈</span>
              <span style={{ fontSize: '0.875rem' }}>Join 10,000+ investors building their portfolios</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Campaigns Section */}
      <section style={{ padding: '80px 20px', backgroundColor: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{
              display: 'inline-block',
              backgroundColor: '#29C7AC',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '0.875rem',
              fontWeight: '600',
              marginBottom: '20px'
            }}>
              Top Investment Opportunities
            </div>
            <h2 style={{ 
              fontSize: '2.5rem', 
              fontWeight: 'bold', 
              color: '#1a202c',
              marginBottom: '16px'
            }}>
              Featured Investment Opportunities
            </h2>
            <p style={{ 
              fontSize: '1.1rem', 
              color: '#4a5568',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              Discover hand-picked investment opportunities from innovative startups and established companies.
            </p>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
            gap: '30px',
            marginBottom: '60px'
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1' }}>
                <p style={{ color: '#4a5568', fontSize: '1.125rem' }}>Loading campaigns...</p>
              </div>
            ) : featuredCampaigns.length > 0 ? (
              featuredCampaigns.map(campaign => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1' }}>
                <p style={{ color: '#4a5568', fontSize: '1.125rem' }}>No active campaigns available yet.</p>
              </div>
            )}
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <Link 
              to="/explore"
              style={{
                backgroundColor: '#29C7AC',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '1rem',
                fontWeight: '500'
              }}
            >
              View All Opportunities →
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section style={{ padding: '80px 20px', backgroundColor: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{
              display: 'inline-block',
              backgroundColor: '#29C7AC',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '0.875rem',
              fontWeight: '600',
              marginBottom: '20px'
            }}>
              Investment Process
            </div>
            <h2 style={{ 
              fontSize: '2.5rem', 
              fontWeight: 'bold', 
              color: '#1a202c',
              marginBottom: '16px'
            }}>
              How <span style={{ background: 'linear-gradient(135deg, #29C7AC, #0B132B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FundChain</span> Works
            </h2>
            <p style={{ 
              fontSize: '1.1rem', 
              color: '#4a5568',
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              From discovery to profit in four simple steps. Our platform makes it easy for 
              investors to find vetted opportunities and for businesses to access growth capital.
            </p>
          </div>
          
          {/* Steps Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '30px',
            marginBottom: '60px'
          }}>
            {steps.map((step, index) => (
              <div key={index} style={{ position: 'relative' }}>
                {/* Connection Arrow - Only on large screens */}
                {index < steps.length - 1 && window.innerWidth >= 1024 && (
                  <div style={{
                    position: 'absolute',
                    top: '64px',
                    left: '100%',
                    width: '30px',
                    height: '2px',
                    background: 'linear-gradient(to right, #29C7AC, #29C7AC50)',
                    zIndex: '1',
                    transform: 'translateX(15px)'
                  }}>
                    <div style={{
                      position: 'absolute',
                      right: '-4px',
                      top: '-3px',
                      width: '0',
                      height: '0',
                      borderLeft: '8px solid #29C7AC',
                      borderTop: '4px solid transparent',
                      borderBottom: '4px solid transparent'
                    }}></div>
                  </div>
                )}
                
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  textAlign: 'center',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #e2e8f0',
                  position: 'relative',
                  zIndex: '2',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 20px 25px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
                }}>
                  {/* Step Icon with Number Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        display: 'inline-flex',
                        padding: '16px',
                        backgroundColor: step.color + '20',
                        borderRadius: '12px',
                        fontSize: '2rem'
                      }}>
                        {step.icon}
                      </div>
                      <div style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        backgroundColor: '#29C7AC',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {index + 1}
                      </div>
                    </div>
                  </div>
                  
                  <h3 style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '600', 
                    marginBottom: '12px', 
                    color: '#1a202c' 
                  }}>
                    {step.title}
                  </h3>
                  <p style={{ 
                    color: '#4a5568', 
                    lineHeight: '1.6',
                    marginBottom: '20px'
                  }}>
                    {step.description}
                  </p>
                  
                  {/* Details List */}
                  <div style={{ textAlign: 'left' }}>
                    {step.details.map((detail, detailIndex) => (
                      <div key={detailIndex} style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        fontSize: '0.875rem', 
                        color: '#4a5568',
                        marginBottom: '8px'
                      }}>
                        <span style={{ color: '#29C7AC', marginRight: '8px', marginTop: '2px' }}>✓</span>
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* User Types Section */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: window.innerWidth >= 768 ? '1fr 1fr' : '1fr',
            gap: '32px',
            marginBottom: '60px'
          }}>
            {/* For Businesses */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '32px',
              border: '2px solid #dbeafe',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  display: 'inline-flex',
                  padding: '12px',
                  backgroundColor: '#dbeafe',
                  borderRadius: '12px',
                  marginBottom: '16px'
                }}>
                  <span style={{ fontSize: '2rem', color: '#3B82F6' }}>📈</span>
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '8px', color: '#1a202c' }}>
                  For Businesses
                </h3>
                <p style={{ color: '#4a5568', fontSize: '0.95rem' }}>
                  Raise growth capital for your startup with milestone-based investment releases
                </p>
              </div>

              <div style={{ marginBottom: '32px' }}>
                {[
                  'Access accredited investor network',
                  'Milestone-based capital releases', 
                  'Transparent investor relations',
                  'Competitive equity terms',
                  'Global market reach'
                ].map((feature, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <span style={{ color: '#3B82F6', marginRight: '12px' }}>✓</span>
                    <span style={{ fontSize: '0.875rem', color: '#4a5568' }}>{feature}</span>
                  </div>
                ))}
              </div>

              <Link 
                to="/create-project"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #29C7AC, #0B132B)',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  textDecoration: 'none'
                }}
              >
                Raise Capital
                <span style={{ marginLeft: '8px' }}>→</span>
              </Link>
            </div>

            {/* For Investors */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '32px',
              border: '2px solid #dcfce7',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  display: 'inline-flex',
                  padding: '12px',
                  backgroundColor: '#dcfce7',
                  borderRadius: '12px',
                  marginBottom: '16px'
                }}>
                  <span style={{ fontSize: '2rem', color: '#10B981' }}>💼</span>
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '8px', color: '#1a202c' }}>
                  For Investors
                </h3>
                <p style={{ color: '#4a5568', fontSize: '0.95rem' }}>
                  Build a diversified portfolio with vetted high-growth investment opportunities
                </p>
              </div>

              <div style={{ marginBottom: '32px' }}>
                {[
                  'Curated investment opportunities',
                  'AI-powered risk assessment',
                  'Milestone-based capital protection',
                  'Portfolio analytics dashboard',
                  'Governance token rewards'
                ].map((feature, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <span style={{ color: '#10B981', marginRight: '12px' }}>✓</span>
                    <span style={{ fontSize: '0.875rem', color: '#4a5568' }}>{feature}</span>
                  </div>
                ))}
              </div>

              <Link 
                to="/explore"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: '#29C7AC',
                  border: '2px solid #29C7AC',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  textDecoration: 'none'
                }}
              >
                Start Investing
                <span style={{ marginLeft: '8px' }}>→</span>
              </Link>
            </div>
          </div>
          
          {/* Final CTA */}
          <div style={{ textAlign: 'center' }}>
            <Link 
              to={user ? "/dashboard" : "/register"}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#29C7AC',
                color: 'white',
                padding: '16px 32px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '1.1rem',
                fontWeight: '600',
                marginBottom: '16px'
              }}
            >
              <span style={{ marginRight: '8px' }}>💼</span>
              {user ? "Go to Dashboard" : "Start Investing Today"}
            </Link>
            <p style={{ fontSize: '0.875rem', color: '#4a5568' }}>
              Join the future of investment management. No setup fees required.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ 
        background: 'linear-gradient(135deg, #1a202c, #2d3748)', 
        color: 'white',
        padding: '60px 20px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ 
            fontSize: '2.5rem', 
            fontWeight: 'bold', 
            marginBottom: '20px'
          }}>
            Ready to Start Investing?
          </h2>
          <p style={{ 
            fontSize: '1.1rem', 
            marginBottom: '30px',
            opacity: '0.9'
          }}>
            Join thousands of investors who are already building their wealth through InvestHub.
          </p>
          <Link 
            to={user ? "/dashboard" : "/register"}
            style={{
              backgroundColor: '#29C7AC',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '600'
            }}
          >
            {user ? "Go to Dashboard" : "Create Free Account"}
          </Link>
        </div>
      </section>

      {/* Floating AI Investment Assistant */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: '50'
      }}>
        <button
          onClick={() => setShowChatbot(!showChatbot)}
          style={{
            height: '56px',
            width: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #29C7AC, #0B132B)',
            color: 'white',
            border: 'none',
            boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 20px 25px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 10px 15px rgba(0, 0, 0, 0.1)';
          }}
        >
          💬
        </button>
        
        {showChatbot && (
          <div style={{
            position: 'absolute',
            bottom: '64px',
            right: '0',
            width: '320px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
            border: '2px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                marginBottom: '12px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    height: '32px',
                    width: '32px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #29C7AC, #0B132B)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: 'bold'
                  }}>
                    AI
                  </div>
                  <span style={{ fontWeight: '600' }}>Investment Assistant</span>
                </div>
                <button 
                  onClick={() => setShowChatbot(false)}
                  style={{
                    height: '24px',
                    width: '24px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    color: '#666'
                  }}
                >
                  ×
                </button>
              </div>
              <p style={{ 
                fontSize: '0.875rem', 
                color: '#4a5568', 
                marginBottom: '12px' 
              }}>
                Hi! I'm your AI investment advisor. I can help you with:
              </p>
              <div style={{ fontSize: '0.875rem', color: '#4a5568', marginBottom: '16px' }}>
                <div style={{ marginBottom: '4px' }}>• Investment opportunity analysis</div>
                <div style={{ marginBottom: '4px' }}>• Portfolio optimization</div>
                <div style={{ marginBottom: '4px' }}>• Risk assessment guidance</div>
                <div>• Platform navigation</div>
              </div>
              <button style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #29C7AC, #0B132B)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
                Start Investment Analysis
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;