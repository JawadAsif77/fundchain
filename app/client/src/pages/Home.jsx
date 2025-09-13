import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import CampaignCard from '../components/CampaignCard';
import { campaigns } from '../mock/campaigns';

const Home = () => {
  const { user } = useAuth();
  
  // Get featured campaigns (top 3)
  const featuredCampaigns = campaigns.slice(0, 3);

  return (
    <div>
      {/* Hero Section */}
      <section style={{ 
        background: 'linear-gradient(135deg, #29C7AC, #0B132B)', 
        color: 'white',
        padding: '80px 20px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ 
            fontSize: '3.5rem', 
            fontWeight: 'bold', 
            marginBottom: '24px',
            lineHeight: '1.2'
          }}>
            Invest in the Future
          </h1>
          <p style={{ 
            fontSize: '1.25rem', 
            marginBottom: '40px', 
            maxWidth: '600px', 
            margin: '0 auto 40px auto',
            lineHeight: '1.6',
            opacity: '0.9'
          }}>
            Discover and invest in innovative startups and projects. Join thousands of investors building the next generation of companies.
          </p>
          
          {/* Stats Row */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '30px',
            marginBottom: '40px',
            maxWidth: '800px',
            margin: '0 auto 40px auto'
          }}>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#29C7AC' }}>$2.4M+</div>
              <div style={{ fontSize: '1rem', opacity: '0.8' }}>Total Invested</div>
            </div>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#29C7AC' }}>150+</div>
              <div style={{ fontSize: '1rem', opacity: '0.8' }}>Active Campaigns</div>
            </div>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#29C7AC' }}>5,000+</div>
              <div style={{ fontSize: '1rem', opacity: '0.8' }}>Investors</div>
            </div>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#29C7AC' }}>98%</div>
              <div style={{ fontSize: '1rem', opacity: '0.8' }}>Success Rate</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {user ? (
              <>
                <Link 
                  to="/dashboard" 
                  style={{
                    backgroundColor: '#29C7AC',
                    color: 'white',
                    padding: '16px 32px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    textDecoration: 'none',
                    fontSize: '1.1rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  View Dashboard
                </Link>
                <Link 
                  to="/explore" 
                  style={{
                    backgroundColor: 'transparent',
                    color: 'white',
                    padding: '16px 32px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    textDecoration: 'none',
                    fontSize: '1.1rem',
                    border: '2px solid white',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Explore Opportunities
                </Link>
              </>
            ) : (
              <>
                <Link 
                  to="/register" 
                  style={{
                    backgroundColor: '#29C7AC',
                    color: 'white',
                    padding: '16px 32px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    textDecoration: 'none',
                    fontSize: '1.1rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Get Started Today
                </Link>
                <Link 
                  to="/explore" 
                  style={{
                    backgroundColor: 'transparent',
                    color: 'white',
                    padding: '16px 32px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    textDecoration: 'none',
                    fontSize: '1.1rem',
                    border: '2px solid white',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Browse Investments
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Featured Campaigns Section */}
      <section style={{ padding: '80px 20px', backgroundColor: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
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
            marginBottom: '40px'
          }}>
            {featuredCampaigns.map(campaign => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
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
      <section style={{ padding: '80px 20px', backgroundColor: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ 
              fontSize: '2.5rem', 
              fontWeight: 'bold', 
              color: '#1a202c',
              marginBottom: '16px'
            }}>
              How InvestHub Works
            </h2>
            <p style={{ 
              fontSize: '1.1rem', 
              color: '#4a5568'
            }}>
              Start investing in 3 simple steps
            </p>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '40px' 
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                backgroundColor: '#E8F8F5', 
                borderRadius: '50%', 
                width: '80px', 
                height: '80px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 20px auto',
                fontSize: '2rem'
              }}>
                �
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '12px', color: '#1a202c' }}>
                1. Discover
              </h3>
              <p style={{ color: '#4a5568', lineHeight: '1.6' }}>
                Browse through vetted investment opportunities across various industries and risk levels.
              </p>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                backgroundColor: '#E8F8F5', 
                borderRadius: '50%', 
                width: '80px', 
                height: '80px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 20px auto',
                fontSize: '2rem'
              }}>
                �
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '12px', color: '#1a202c' }}>
                2. Analyze
              </h3>
              <p style={{ color: '#4a5568', lineHeight: '1.6' }}>
                Review detailed business plans, financial projections, and risk assessments for each opportunity.
              </p>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                backgroundColor: '#E8F8F5', 
                borderRadius: '50%', 
                width: '80px', 
                height: '80px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 20px auto',
                fontSize: '2rem'
              }}>
                �
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '12px', color: '#1a202c' }}>
                3. Invest
              </h3>
              <p style={{ color: '#4a5568', lineHeight: '1.6' }}>
                Make secure investments and track your portfolio performance with real-time updates.
              </p>
            </div>
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
    </div>
  );
};

export default Home;