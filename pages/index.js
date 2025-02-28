import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.scss';
import Head from 'next/head';
import { TikTokIcon } from '../src/components/icons/Icons';
import { 
  LinkedInIcon, 
  TwitterIcon, 
  FacebookIcon, 
  InstagramIcon, 
  YouTubeIcon, 
  PinterestIcon, 
  RedditIcon,
  TikTokSimpleIcon
} from '../src/components/icons/SocialIcons';

// Use environment variable for API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'info', 'success', 'error'
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Set API URL on component mount and check for existing token
  useEffect(() => {
    // Use the API_BASE_URL constant instead of accessing process.env directly
    setApiUrl(API_BASE_URL);
    
    // Check if we have a token in localStorage
    const savedToken = localStorage?.getItem('tiktokAccessToken');
    if (savedToken) {
      setAccessToken(savedToken);
      setIsConnected(true);
      setMessage('Connected to your TikTok account.');
      setMessageType('success');
    }
  }, []);

  // Connect to TikTok
  const handleConnect = () => {
    // Redirect to the TikTok page for proper authentication
    window.location.href = '/tiktok';
  };

  // Submit video URL to the backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('Posting video...');
    setMessageType('info');

    // Get the token from state or localStorage
    const token = accessToken || localStorage?.getItem('tiktokAccessToken');
    
    if (!token) {
      setMessage('Error: No access token available. Please connect your TikTok account first.');
      setMessageType('error');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/tiktok/post-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          videoUrl,
          accessToken: token
        })
      });
      
      const data = await res?.json();
      if (res?.ok) {
        setMessage('Video posted successfully!');
        setMessageType('success');
        setVideoUrl('');
      } else {
        setMessage(`Error: ${data?.error || 'Failed to post video'}`);
        setMessageType('error');
      }
    } catch (error) {
      setMessage(`Error: ${error?.message || 'Unknown error occurred'}`);
      setMessageType('error');
      console.error('Post error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect from TikTok
  const handleDisconnect = () => {
    localStorage?.removeItem('tiktokAccessToken');
    setAccessToken(null);
    setIsConnected(false);
    setMessage('Disconnected from TikTok.');
    setMessageType('info');
  };

  // Toggle FAQ item
  const toggleFaq = (index) => {
    if (expandedFaq === index) {
      setExpandedFaq(null);
    } else {
      setExpandedFaq(index);
    }
  };

  // FAQ data
  const faqItems = [
    {
      question: "What platforms does Social Lane support?",
      answer: "Social Lane supports all major social media platforms including TikTok, Instagram, Facebook, Twitter, LinkedIn, YouTube, Pinterest, and Reddit. We're constantly adding more platforms to our ecosystem."
    },
    {
      question: "How does the scheduling feature work?",
      answer: "Our scheduling feature allows you to plan and schedule your content in advance. You can create posts, set specific dates and times for them to be published, and our system will automatically post them to your selected platforms at the scheduled time."
    },
    {
      question: "Can I use Social Lane for multiple accounts?",
      answer: "Yes! Depending on your plan, you can connect multiple accounts from different platforms. Our Free plan supports up to 3 social accounts, Pro plan supports up to 10 accounts, and Business plan offers unlimited social accounts."
    },
    {
      question: "Is there a free trial available?",
      answer: "Yes, we offer a free plan that allows you to try out our core features. You can use the free plan for as long as you want, and upgrade to a paid plan when you need more features or capacity."
    },
    {
      question: "How does the AI content suggestion work?",
      answer: "Our AI analyzes your content and audience engagement patterns to suggest optimizations for each platform. It helps you tailor your content to match the specific requirements and best practices of each social network, increasing your reach and engagement."
    }
  ];

  return (
    <>
      <Head>
        <title>Social Lane - Schedule & Post Content</title>
        <meta name="description" content="Schedule and post your content everywhere in seconds" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className={styles.landingPage}>
        {/* Navigation */}
        <nav className={styles.navbar}>
          <div className={styles.navContainer}>
            <div className={styles.logo}>
              <span className={styles.logoText}>sociallane</span>
            </div>
            <div className={styles.navLinks}>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#about">About</a>
              <a href="#faq">FAQ</a>
              <a href="#blog">Blog</a>
            </div>
            <div className={styles.navButtons}>
              <button className={styles.loginButton}>Log in</button>
              <button className={styles.signupButton}>Sign up free</button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroContent}>
            <h1>Schedule your content everywhere in seconds</h1>
            <p className={styles.heroSubtitle}>Plan, schedule and automatically post your content across all social media platforms with just a few clicks.</p>
            
            <div className={styles.ctaButtons}>
              <button className={styles.primaryCta}>Start for free</button>
              <button className={styles.secondaryCta}>See how it works</button>
            </div>
            
            <div className={styles.socialIcons}>
              <div className={styles.iconGrid}>
                <div className={styles.socialIcon}><TikTokSimpleIcon /></div>
                <div className={styles.socialIcon}><LinkedInIcon /></div>
                <div className={styles.socialIcon}><TwitterIcon /></div>
                <div className={styles.socialIcon}><FacebookIcon /></div>
                <div className={styles.socialIcon}><InstagramIcon /></div>
                <div className={styles.socialIcon}><YouTubeIcon /></div>
              </div>
              <p>Supported platforms</p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className={styles.featuresSection} id="features">
          <h2>Posting content shouldn&apos;t be this hard</h2>
          
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔄</div>
              <h3>Never re-posting</h3>
              <p>Schedule your content once and let it post automatically across all platforms.</p>
            </div>
            
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📅</div>
              <h3>Simple calendar</h3>
              <p>Easily plan and visualize your content schedule with our intuitive calendar.</p>
            </div>
            
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📊</div>
              <h3>Track performance</h3>
              <p>Get insights on how your content is performing across different platforms.</p>
            </div>
            
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔍</div>
              <h3>AI suggestions</h3>
              <p>Get AI-powered suggestions to optimize your content for each platform.</p>
            </div>
          </div>
        </section>

        {/* Social Reach Section */}
        <section className={styles.socialReachSection}>
          <h2>Grow your social reach with less effort</h2>
          <p>Our platform helps you maintain a consistent presence across all social media channels</p>
          
          <div className={styles.demoContainer}>
            <div className={styles.demoContent}>
              <div className={styles.demoFeature}>
                <h3>Schedule once, post everywhere</h3>
                <p>Create content once and schedule it to post across all your social media accounts.</p>
              </div>
              
              <div className={styles.demoFeature}>
                <h3>Optimize for each platform</h3>
                <p>Our AI helps you tailor your content for each platform&apos;s unique requirements.</p>
              </div>
              
              <div className={styles.demoFeature}>
                <h3>Analytics dashboard</h3>
                <p>Track performance metrics across all platforms in one centralized dashboard.</p>
              </div>
            </div>
            
            <div className={styles.demoImage}>
              {/* Placeholder for dashboard image */}
              <div className={styles.dashboardImage}></div>
            </div>
          </div>
        </section>

        {/* Video Creation Section */}
        <section className={styles.videoSection}>
          <h2>Create Viral Videos in Seconds</h2>
          
          <div className={styles.videoDemo}>
            <div className={styles.videoDemoImage}>
              {/* Placeholder for app screenshot */}
            </div>
            
            <div className={styles.videoDemoFeatures}>
              <div className={styles.videoDemoFeature}>
                <h3>AI-powered video creation</h3>
                <p>Generate engaging videos with our AI tools in just a few clicks.</p>
              </div>
              
              <div className={styles.videoDemoFeature}>
                <h3>Custom templates</h3>
                <p>Choose from hundreds of templates or create your own to match your brand.</p>
              </div>
              
              <div className={styles.videoDemoFeature}>
                <h3>One-click publishing</h3>
                <p>Publish your videos to multiple platforms with a single click.</p>
              </div>
            </div>
          </div>
        </section>

        {/* User Testimonials */}
        <section className={styles.testimonialsSection}>
          <h2>25000+ users growing on all platforms</h2>
          
          <div className={styles.testimonialGrid}>
            {/* This would be a grid of testimonial cards */}
            {/* Placeholder for testimonial cards */}
          </div>
        </section>

        {/* Supported Platforms */}
        <section className={styles.platformsSection}>
          <h3>Supported Platforms</h3>
          
          <div className={styles.platformIcons}>
            <div className={styles.platformIcon}><TwitterIcon /></div>
            <div className={styles.platformIcon}><LinkedInIcon /></div>
            <div className={styles.platformIcon}><FacebookIcon /></div>
            <div className={styles.platformIcon}><InstagramIcon /></div>
            <div className={styles.platformIcon}><YouTubeIcon /></div>
            <div className={styles.platformIcon}><TikTokSimpleIcon /></div>
            <div className={styles.platformIcon}><PinterestIcon /></div>
            <div className={styles.platformIcon}><RedditIcon /></div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className={styles.pricingSection} id="pricing">
          <h2>Get more views, with less effort</h2>
          
          <div className={styles.pricingCards}>
            <div className={styles.pricingCard}>
              <div className={styles.pricingHeader}>
                <h3>Free</h3>
                <div className={styles.price}>$0<span>/mo</span></div>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>3 social accounts</li>
                <li>30 scheduled posts</li>
                <li>Basic analytics</li>
              </ul>
              <button className={styles.pricingButton}>Get started</button>
            </div>
            
            <div className={`${styles.pricingCard} ${styles.popularPlan}`}>
              <div className={styles.popularTag}>Most popular</div>
              <div className={styles.pricingHeader}>
                <h3>Pro</h3>
                <div className={styles.price}>$10<span>/mo</span></div>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>10 social accounts</li>
                <li>Unlimited scheduled posts</li>
                <li>Advanced analytics</li>
                <li>AI content suggestions</li>
              </ul>
              <button className={styles.pricingButton}>Get started</button>
            </div>
            
            <div className={styles.pricingCard}>
              <div className={styles.pricingHeader}>
                <h3>Business</h3>
                <div className={styles.price}>$25<span>/mo</span></div>
              </div>
              <ul className={styles.pricingFeatures}>
                <li>Unlimited social accounts</li>
                <li>Unlimited scheduled posts</li>
                <li>Premium analytics</li>
                <li>Team collaboration</li>
                <li>Priority support</li>
              </ul>
              <button className={styles.pricingButton}>Get started</button>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className={styles.faqSection} id="faq">
          <h2>Frequently Asked Questions</h2>
          
          <div className={styles.faqList}>
            {faqItems.map((item, index) => (
              <div 
                key={index} 
                className={`${styles.faqItem} ${expandedFaq === index ? styles.expanded : ''}`}
              >
                <div 
                  className={styles.faqQuestion}
                  onClick={() => toggleFaq(index)}
                >
                  <h3>{item.question}</h3>
                  <span className={styles.faqToggle}>
                    {expandedFaq === index ? '−' : '+'}
                  </span>
                </div>
                {expandedFaq === index && (
                  <div className={styles.faqAnswer}>
                    <p>{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2>Get more views, with less effort</h2>
          <p>Join thousands of content creators who are growing their audience with Social Lane</p>
          <button className={styles.primaryCta}>Start for free</button>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerContent}>
            <div className={styles.footerLogo}>
              <span className={styles.logoText}>sociallane</span>
            </div>
            
            <div className={styles.footerLinks}>
              <div className={styles.footerColumn}>
                <h4>Product</h4>
                <a href="#features">Features</a>
                <a href="#pricing">Pricing</a>
                <a href="#">Integrations</a>
              </div>
              
              <div className={styles.footerColumn} id="about">
                <h4>Company</h4>
                <a href="#">About</a>
                <a href="#" id="blog">Blog</a>
                <a href="#">Careers</a>
              </div>
              
              <div className={styles.footerColumn}>
                <h4>Resources</h4>
                <a href="#">Help Center</a>
                <a href="#">API</a>
                <a href="#">Status</a>
              </div>
              
              <div className={styles.footerColumn}>
                <h4>Legal</h4>
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
                <a href="#">Security</a>
              </div>
            </div>
          </div>
          
          <div className={styles.footerBottom}>
            <p>© 2023 Social Lane. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}