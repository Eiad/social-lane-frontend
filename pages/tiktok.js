import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.scss';
import Head from 'next/head';
import { TikTokSimpleIcon } from '../src/components/icons/SocialIcons';
import Link from 'next/link';

// Replace this line:
// const API_BASE_URL = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined;

// With this simple approach:
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function TikTok() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const [successMessage, setSuccessMessage] = useState('');
  const router = useRouter();

  // Check for existing token in localStorage on component mount
  useEffect(() => {
    // Use the API_BASE_URL constant instead of accessing process.env directly
    setApiUrl(API_BASE_URL);
    
    const savedToken = localStorage?.getItem('tiktokAccessToken');
    const savedOpenId = localStorage?.getItem('tiktokOpenId');
    if (savedToken) {
      setAccessToken(savedToken);
      setOpenId(savedOpenId);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    // Check for token in URL (new flow)
    const { access_token, open_id, error: urlError } = router?.query || {};
    
    if (urlError) {
      setError(decodeURIComponent(urlError));
      // Remove the error from URL
      router?.replace('/tiktok', undefined, { shallow: true });
      return;
    }
    
    if (access_token) {
      setAccessToken(access_token);
      setOpenId(open_id || '');
      setIsAuthenticated(true);
      setSuccessMessage('Successfully connected to TikTok!');
      
      // Save token to localStorage for persistence
      localStorage?.setItem('tiktokAccessToken', access_token);
      if (open_id) localStorage?.setItem('tiktokOpenId', open_id);
      
      // Remove the token from URL for security
      router?.replace('/tiktok', undefined, { shallow: true });
    }
  }, [router?.query]);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Make sure we're using the environment variable
      const url = `${apiUrl}/tiktok/auth`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        mode: 'cors',
      });
      
      const data = await response?.json();
      
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (error) {
      setError('Failed to initiate TikTok authentication: ' + (error?.message || 'Unknown error'));
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostVideo = async (e) => {
    e.preventDefault();
    if (!videoUrl) return;

    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage('');
      
      // Use the token from state or localStorage as a fallback
      const token = accessToken || localStorage?.getItem('tiktokAccessToken');
      
      if (!token) {
        throw new Error('No access token available. Please reconnect your TikTok account.');
      }
      
      // Make sure we're using the environment variable
      const url = `${apiUrl}/tiktok/post-video`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        mode: 'cors',
        body: JSON.stringify({
          videoUrl,
          accessToken: token,
        }),
      });

      const data = await response?.json();
      
      if (response?.ok) {
        setSuccessMessage('Video posted successfully!');
        setVideoUrl('');
      } else {
        throw new Error(data?.error || 'Failed to post video');
      }
    } catch (error) {
      setError(error?.message || 'Unknown error occurred');
      console.error('Post error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setAccessToken(null);
    setOpenId(null);
    setIsAuthenticated(false);
    setSuccessMessage('');
    localStorage?.removeItem('tiktokAccessToken');
    localStorage?.removeItem('tiktokOpenId');
  };

  const goToHome = () => {
    router?.push('/');
  };

  return (
    <>
      <Head>
        <title>TikTok Integration - Social Lane</title>
        <meta name="description" content="Connect your TikTok account with Social Lane" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className={styles.landingPage}>
        {/* Navigation */}
        <nav className={styles.navbar}>
          <div className={styles.navContainer}>
            <div className={styles.logo}>
              <Link href="/">
                <span className={styles.logoText}>sociallane</span>
              </Link>
            </div>
            <div className={styles.navLinks}>
              <Link href="/#features">Features</Link>
              <Link href="/#pricing">Pricing</Link>
              <Link href="/#about">About</Link>
              <Link href="/#faq">FAQ</Link>
              <Link href="/#blog">Blog</Link>
            </div>
            <div className={styles.navButtons}>
              <button className={styles.loginButton}>Log in</button>
              <button className={styles.signupButton}>Sign up free</button>
            </div>
          </div>
        </nav>

        {/* TikTok Integration Section */}
        <section className={styles.tiktokIntegrationSection}>
          <div className={styles.tiktokIntegrationContainer}>
            <div className={styles.tiktokHeader}>
              <div className={styles.tiktokIconContainer}>
                <TikTokSimpleIcon width="48" height="48" className={styles.tiktokIcon} />
              </div>
              <h1>TikTok Integration</h1>
              <p>Connect your TikTok account to Social Lane</p>
            </div>

            {apiUrl && (
              <div className={styles.apiUrlBadge}>
                <span>API: {apiUrl}</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className={styles.messageBox + ' ' + styles.errorMessage}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>{error}</p>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className={styles.messageBox + ' ' + styles.successMessage}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <p>{successMessage}</p>
              </div>
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className={styles.loadingIndicator}>
                <div className={styles.spinner}></div>
                <p>Processing your request...</p>
              </div>
            )}

            <div className={styles.tiktokCard}>
              {!isAuthenticated ? (
                <div className={styles.connectContainer}>
                  <div className={styles.connectDescription}>
                    <h2>Connect your TikTok account</h2>
                    <p>
                      Connecting your TikTok account allows Social Lane to post content on your behalf.
                      We never store your TikTok password and you can disconnect at any time.
                    </p>
                    <ul className={styles.benefitsList}>
                      <li>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Schedule posts in advance
                      </li>
                      <li>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Post to multiple platforms at once
                      </li>
                      <li>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Track performance analytics
                      </li>
                    </ul>
                  </div>
                  
                  <div className={styles.connectActions}>
                    <button
                      onClick={handleConnect}
                      className={styles.connectTiktokButton}
                      disabled={isLoading}
                    >
                      <TikTokSimpleIcon width="20" height="20" />
                      <span>Connect TikTok Account</span>
                    </button>
                    
                    <button 
                      onClick={goToHome}
                      className={styles.backButton}
                    >
                      Back to Home
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.connectedContainer}>
                  <div className={styles.connectedHeader}>
                    <div className={styles.connectedStatus}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      <h2>TikTok Connected</h2>
                    </div>
                    
                    {openId && (
                      <div className={styles.accountInfo}>
                        <span>Account ID: {openId}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.postVideoSection}>
                    <h3>Post a Video to TikTok</h3>
                    <form onSubmit={handlePostVideo} className={styles.postForm}>
                      <div className={styles.formGroup}>
                        <label htmlFor="videoUrl">Video URL</label>
                        <input
                          type="url"
                          id="videoUrl"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          placeholder="Enter TikTok video URL"
                          required
                          disabled={isLoading}
                          className={styles.videoUrlInput}
                        />
                      </div>
                      
                      <div className={styles.formActions}>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className={styles.postButton}
                        >
                          {isLoading ? 'Posting...' : 'Post to TikTok'}
                        </button>
                        
                        <button
                          type="button"
                          onClick={handleLogout}
                          className={styles.disconnectButton}
                          disabled={isLoading}
                        >
                          Disconnect Account
                        </button>
                      </div>
                    </form>
                  </div>
                  
                  <div className={styles.backToHomeContainer}>
                    <button 
                      onClick={goToHome}
                      className={styles.backToHomeButton}
                    >
                      Back to Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
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
                <Link href="/#features">Features</Link>
                <Link href="/#pricing">Pricing</Link>
                <Link href="#">Integrations</Link>
              </div>
              
              <div className={styles.footerColumn}>
                <h4>Company</h4>
                <Link href="/#about">About</Link>
                <Link href="/#blog">Blog</Link>
                <Link href="#">Careers</Link>
              </div>
              
              <div className={styles.footerColumn}>
                <h4>Resources</h4>
                <Link href="#">Help Center</Link>
                <Link href="#">API</Link>
                <Link href="#">Status</Link>
              </div>
              
              <div className={styles.footerColumn}>
                <h4>Legal</h4>
                <Link href="#">Privacy</Link>
                <Link href="#">Terms</Link>
                <Link href="#">Security</Link>
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