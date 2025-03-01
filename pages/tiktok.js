import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.scss';
import tikTokStyles from '../styles/TikTok.module.css';
import Head from 'next/head';
import { TikTokSimpleIcon } from '../src/components/icons/SocialIcons';
import Link from 'next/link';
import axios from 'axios';

// Replace this line:
// const API_BASE_URL = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined;

// With this approach that safely handles both server and client environments:
const API_BASE_URL =  'https://sociallane-backend.mindio.chat';


export default function TikTok() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadDetails, setUploadDetails] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const fileInputRef = useRef(null);
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [file, setFile] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);

  // Define the upload process steps
  const uploadSteps = [
    { id: 'validating', label: 'Validate' },
    { id: 'uploading', label: 'Upload' },
    { id: 'processing', label: 'Process' },
    { id: 'completed', label: 'Complete' }
  ];

  // Define the posting process steps
  const postingSteps = [
    { id: 'preparing', label: 'Prepare' },
    { id: 'posting', label: 'Post' },
    { id: 'success', label: 'Success' }
  ];

  // Get the current step index for the active process
  const getCurrentStepIndex = () => {
    if (!currentStep) return -1;
    
    // Check if we're in the upload process
    const uploadStepIndex = uploadSteps.findIndex(step => step.id === currentStep);
    if (uploadStepIndex !== -1) return uploadStepIndex;
    
    // Check if we're in the posting process
    const postingStepIndex = postingSteps.findIndex(step => step.id === currentStep);
    if (postingStepIndex !== -1) return postingStepIndex;
    
    return -1;
  };

  // Determine which process is active (upload or posting)
  const getActiveProcess = () => {
    if (!currentStep) return null;
    
    if (uploadSteps.some(step => step.id === currentStep)) {
      return 'upload';
    }
    
    if (postingSteps.some(step => step.id === currentStep)) {
      return 'posting';
    }
    
    return null;
  };

  // Fetch user info
  const fetchUserInfo = async (token) => {
    try {
      const response = await fetch(`${apiUrl}/tiktok/user-info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response?.json();
      if (response?.ok && data?.data) {
        setUserInfo(data.data);
      } else {
        console.error('Failed to fetch user info:', data?.error);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  // Update useEffect for token handling
  useEffect(() => {
    // Use the API_BASE_URL constant instead of accessing process.env directly
    setApiUrl(API_BASE_URL);
    
    const savedToken = localStorage?.getItem('tiktokAccessToken');
    const savedOpenId = localStorage?.getItem('tiktokOpenId');
    if (savedToken) {
      setAccessToken(savedToken);
      setOpenId(savedOpenId);
      setIsAuthenticated(true);
      fetchUserInfo(savedToken);
    }
  }, []);

  useEffect(() => {
    // Check for token in URL (new flow)
    const { access_token, open_id, error: urlError } = router?.query || {};
    
    if (urlError) {
      window.showToast?.error?.(decodeURIComponent(urlError));
      // Remove the error from URL
      router?.replace('/tiktok', undefined, { shallow: true });
      return;
    }
    
    if (access_token) {
      setAccessToken(access_token);
      setOpenId(open_id || '');
      setIsAuthenticated(true);
      window.showToast?.success?.('Successfully connected to TikTok!');
      
      // Save token to localStorage for persistence
      localStorage?.setItem('tiktokAccessToken', access_token);
      if (open_id) localStorage?.setItem('tiktokOpenId', open_id);
      
      // Fetch user info with new token
      fetchUserInfo(access_token);
      
      // Remove the token from URL for security
      router?.replace('/tiktok', undefined, { shallow: true });
    }
  }, [router?.query]);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      
      // Make sure we're using the environment variable
      const url = `${apiUrl}/tiktok/auth`;
      
      // Debug logging
      console.log('Connecting to TikTok with URL:', url);
      console.log('API URL from state:', apiUrl);
      console.log('API_BASE_URL constant:', API_BASE_URL);
      
      // Try with fetch first
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        
        // Debug response
        console.log('Response status:', response?.status);
        
        if (!response?.ok) {
          throw new Error(`HTTP error! Status: ${response?.status}`);
        }
        
        const data = await response?.json?.();
        console.log('Response data:', data);
        
        if (data?.authUrl) {
          console.log('Redirecting to auth URL:', data.authUrl);
          window.location.href = data.authUrl;
          return;
        }
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        // If fetch fails, try direct redirect as fallback
        window.location.href = `${apiUrl}/tiktok/auth`;
      }
    } catch (error) {
      console.error('Detailed auth error:', error);
      window.showToast?.error?.('Failed to initiate TikTok authentication: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadedFile(selectedFile.name);
      setUploadError(null);
      setVideoUrl('');
      setPostSuccess(false);
      setCurrentStep(null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async () => {
    if (!file) return;

    // Reset states
    setUploadError(null);
    setUploadDetails(null);
    setCurrentStep('validating');

    // Check if file is a video
    if (!file.type?.startsWith('video/')) {
      setUploadError('Please select a video file');
      window.showToast?.error?.('Please select a video file');
      setCurrentStep(null);
      return;
    }

    // Check file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      setUploadError('File size exceeds 500MB limit');
      window.showToast?.error?.('File size exceeds 500MB limit');
      setCurrentStep(null);
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setCurrentStep('uploading');
      
      // Log file details
      console.log('[UPLOAD] Starting upload for file:', {
        name: file.name,
        type: file.type,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      });
      
      const formData = new FormData();
      formData.append('file', file);

      // Create XMLHttpRequest to track upload progress
      const xhr = new XMLHttpRequest();
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentCompleted = Math.round((event.loaded * 100) / event.total);
          setUploadProgress(percentCompleted);
          console.log(`[UPLOAD] Progress: ${percentCompleted}%`);
        }
      });
      
      // Create a promise to handle the XHR response
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        
        xhr.onerror = function() {
          reject(new Error('Network error during upload'));
        };
      });
      
      // Open and send the request
      xhr.open('POST', '/api/upload', true);
      xhr.send(formData);
      
      // Wait for the upload to complete
      const data = await uploadPromise;
      
      if (data?.success && data?.url) {
        console.log('[UPLOAD] Upload successful, URL:', data.url);
        setVideoUrl(data.url);
        setUploadDetails({
          filename: data.filename,
          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          type: file.type
        });
        window.showToast?.success?.('File uploaded successfully');
        setCurrentStep('completed');
        
        // Automatically post to TikTok after a delay
        console.log('[UPLOAD] Waiting 2 seconds before posting to TikTok...');
        setTimeout(() => {
          console.log('[UPLOAD] Auto-posting to TikTok with URL:', data.url);
          handlePostVideo(null, data.url);
        }, 2000);
      } else {
        console.error('[UPLOAD] Missing success or URL in response');
        throw new Error('Failed to get upload URL');
      }
    } catch (error) {
      console.error('[UPLOAD] Error:', error);
      setUploadError(error?.message || 'Error uploading file');
      window.showToast?.error?.(error?.message || 'Error uploading file');
      setCurrentStep('error');
    } finally {
      setIsUploading(false);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePostVideo = async (e, urlOverride) => {
    e?.preventDefault();
    const videoUrlToPost = urlOverride || videoUrl;
    
    if (!videoUrlToPost) return;

    try {
      setIsLoading(true);
      setCurrentStep('preparing');
      setUploadError(null); // Clear any previous errors
      
      // Use the token from state or localStorage as a fallback
      const token = accessToken || localStorage?.getItem('tiktokAccessToken');
      
      if (!token) {
        throw new Error('No access token available. Please reconnect your TikTok account.');
      }

      // Make sure we're using the environment variable
      const url = `${apiUrl}/tiktok/post-video`;
      
      console.log('[POST] Sending video to TikTok:', {
        url: videoUrlToPost,
        apiEndpoint: url
      });
      
      setCurrentStep('posting');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        mode: 'cors',
        body: JSON.stringify({
          videoUrl: videoUrlToPost,
          accessToken: token,
        }),
      });

      console.log('[POST] Response status:', response?.status);
      const data = await response?.json?.();
      console.log('[POST] Response data:', data);
      
      if (response?.ok) {
        setCurrentStep('success');
        setPostSuccess(true);
        window.showToast?.success?.('Video posted successfully!');
        if (!urlOverride) {
          setVideoUrl('');
          setUploadedFile(null);
          setUploadDetails(null);
        }
      } else {
        setCurrentStep('error');
        // Display detailed error information
        const errorMessage = data?.error || 'Failed to post video';
        setUploadError(errorMessage);
        console.error('[POST] Error response:', data);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('[POST] Error:', error);
      setCurrentStep('error');
      
      // Set a more detailed error message for display
      const errorMessage = error?.message || 'Unknown error occurred';
      setUploadError(errorMessage);
      
      window.showToast?.error?.(errorMessage);
      console.error('Post error details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setAccessToken(null);
    setOpenId(null);
    setIsAuthenticated(false);
    setUserInfo(null);
    localStorage?.removeItem('tiktokAccessToken');
    localStorage?.removeItem('tiktokOpenId');
    window.showToast?.info?.('Disconnected from TikTok account');
  };

  const goToHome = () => {
    router?.push('/');
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <Head>
          <title>TikTok Integration - Social Lane</title>
          <meta name="description" content="Connect your TikTok account with Social Lane" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

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

        <main className={tikTokStyles.preLoginContainer}>
          <div className={tikTokStyles.preLoginContent}>
            <div className={tikTokStyles.preLoginHeader}>
              <div className={tikTokStyles.preLoginIcon}>
                <TikTokSimpleIcon width="48" height="48" />
              </div>
              <h1>TikTok Integration</h1>
              <p>Connect your TikTok account to post videos directly from Social Lane</p>
            </div>

            <div className={tikTokStyles.preLoginFeatures}>
              <div className={tikTokStyles.featureItem}>
                <div className={tikTokStyles.featureIcon}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                </div>
                <h3>Direct Video Upload</h3>
                <p>Upload videos directly to TikTok from your dashboard</p>
              </div>

              <div className={tikTokStyles.featureItem}>
                <div className={tikTokStyles.featureIcon}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <h3>Schedule Posts</h3>
                <p>Plan and schedule your TikTok content in advance</p>
              </div>

              <div className={tikTokStyles.featureItem}>
                <div className={tikTokStyles.featureIcon}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                  </svg>
                </div>
                <h3>Analytics & Insights</h3>
                <p>Track performance and engagement metrics</p>
              </div>
            </div>

            <div className={tikTokStyles.preLoginCTA}>
              <button
                onClick={handleConnect}
                className={tikTokStyles.connectButton}
                disabled={isLoading}
              >
                <TikTokSimpleIcon width="24" height="24" />
                <span>Connect TikTok Account</span>
                {isLoading && (
                  <div className={tikTokStyles.buttonLoader}>
                    <span className={tikTokStyles.loaderDot}></span>
                    <span className={tikTokStyles.loaderDot}></span>
                    <span className={tikTokStyles.loaderDot}></span>
                  </div>
                )}
              </button>
              <p className={tikTokStyles.securityNote}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                Secure OAuth2 authentication with TikTok
              </p>
            </div>
          </div>
        </main>

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
    );
  }

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

            {/* Loading Indicator */}
            {isLoading && (
              <div className={styles.loadingIndicator}>
                <div className={styles.spinner}></div>
                <p>Processing your request...</p>
              </div>
            )}

            <div className={styles.tiktokCard}>
              <div className={styles.connectedContainer}>
                {/* TikTok Account Section */}
                <div className={tikTokStyles.accountSection}>
                  <div className={tikTokStyles.accountCard}>
                    <div className={tikTokStyles.accountInfo}>
                      <div className={tikTokStyles.accountAvatar}>
                        {userInfo?.avatar_url ? (
                          <img 
                            src={userInfo.avatar_url} 
                            alt={userInfo.display_name || 'TikTok User'} 
                            className={tikTokStyles.avatarImage}
                          />
                        ) : (
                          <TikTokSimpleIcon width="24" height="24" />
                        )}
                      </div>
                      <div className={tikTokStyles.accountDetails}>
                        <div className={tikTokStyles.accountName}>
                          {userInfo?.display_name || 'TikTok Account'}
                        </div>
                        <div className={tikTokStyles.accountStatus}>
                          <span className={tikTokStyles.statusIndicator}></span>
                          Connected
                        </div>
                        {userInfo?.username && (
                          <div className={tikTokStyles.accountUsername}>
                            @{userInfo.username}
                          </div>
                        )}
                      </div>
                    </div>
                    <button 
                      className={tikTokStyles.disconnectButton}
                      onClick={handleLogout}
                      disabled={isLoading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg> Disconnect Account
                    </button>
                  </div>
                </div>

                {/* Progress Section */}
                {currentStep && (
                  <div className={tikTokStyles.progressSection}>
                    <div className={tikTokStyles.stepIndicator}>
                      <div className={tikTokStyles.stepTitle}>
                        {currentStep === 'validating' && 'Validating file...'}
                        {currentStep === 'uploading' && 'Uploading file...'}
                        {currentStep === 'processing' && 'Processing upload...'}
                        {currentStep === 'completed' && 'Upload completed successfully!'}
                        {currentStep === 'preparing' && 'Preparing to post...'}
                        {currentStep === 'posting' && 'Posting to TikTok...'}
                        {currentStep === 'success' && 'Posted successfully!'}
                        {currentStep === 'error' && 'Error occurred'}
                      </div>
                      
                      {/* Progress Bar */}
                      {(currentStep === 'uploading' || currentStep === 'processing') && (
                        <div className={tikTokStyles.progressBarContainer}>
                          <div 
                            className={tikTokStyles.progressBar} 
                            style={{ 
                              width: `${currentStep === 'processing' ? 100 : uploadProgress}%`,
                            }}
                          ></div>
                          <span className={tikTokStyles.progressText}>
                            {currentStep === 'processing' ? 'Processing...' : `${uploadProgress}%`}
                          </span>
                        </div>
                      )}
                      
                      {/* Completed Progress Bar */}
                      {currentStep === 'completed' && (
                        <div className={`${tikTokStyles.progressBarContainer} ${tikTokStyles.uploadCompleted}`}>
                          <div 
                            className={tikTokStyles.progressBar} 
                            style={{ width: '100%' }}
                          ></div>
                          <span className={tikTokStyles.progressText}>Completed!</span>
                        </div>
                      )}
                      
                      {/* Success Progress Bar */}
                      {currentStep === 'success' && (
                        <div className={`${tikTokStyles.progressBarContainer} ${tikTokStyles.uploadCompleted} ${tikTokStyles.staticCompleted}`}>
                          <div 
                            className={tikTokStyles.progressBar} 
                            style={{ width: '100%' }}
                          ></div>
                          <span className={tikTokStyles.progressText}>Posted Successfully!</span>
                        </div>
                      )}
                      
                      {/* Multi-step Progress */}
                      {getActiveProcess() === 'upload' && (
                        <div className={tikTokStyles.progressSteps}>
                          {uploadSteps.map((step, index) => {
                            const currentIndex = getCurrentStepIndex();
                            const isActive = index === currentIndex;
                            const isCompleted = index < currentIndex;
                            
                            return (
                              <div key={step.id} className={tikTokStyles.progressStep}>
                                <div 
                                  className={`${tikTokStyles.progressStepDot} ${isActive ? tikTokStyles.active : ''} ${isCompleted ? tikTokStyles.completed : ''}`}
                                ></div>
                                <div 
                                  className={`${tikTokStyles.progressStepLabel} ${isActive ? tikTokStyles.active : ''} ${isCompleted ? tikTokStyles.completed : ''}`}
                                >
                                  {step.label}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {uploadError && (
                  <div className={tikTokStyles.errorMessage}>
                    <div className={tikTokStyles.errorIcon}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                    </div>
                    <div className={tikTokStyles.errorContent}>
                      <h4>Error occurred</h4>
                      <p>{uploadError}</p>
                    </div>
                  </div>
                )}

                {/* Upload Section */}
                <div className={tikTokStyles.uploadSection}>
                  <div className={tikTokStyles.uploadHeader}>
                    <h4>Upload Video to TikTok</h4>
                    <p className={tikTokStyles.uploadDescription}>
                      Select a video file to upload and post directly to your TikTok account
                    </p>
                  </div>
                  
                  {!uploadedFile && !isUploading && (
                    <div className={tikTokStyles.uploadDropzone}>
                      <div 
                        className={tikTokStyles.uploadPlaceholder}
                        onClick={handleUploadClick}
                      >
                        <div className={tikTokStyles.uploadIcon}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                          </svg>
                        </div>
                        <p className={tikTokStyles.uploadText}>
                          {isUploading ? 'Uploading...' : 'Drag & drop your video here or click to browse'}
                        </p>
                        <p className={tikTokStyles.uploadHint}>
                          Supported formats: MP4, MOV (max 60 seconds)
                        </p>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="video/*"
                          className={tikTokStyles.fileInput}
                        />
                      </div>
                    </div>
                  )}

                  {uploadedFile && !isLoading && !postSuccess && (
                    <div className={tikTokStyles.uploadedFileCard}>
                      <div className={tikTokStyles.uploadedFileHeader}>
                        <div className={tikTokStyles.videoIcon}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                          </svg>
                        </div>
                        <div className={tikTokStyles.uploadedFileInfo}>
                          <h5>{uploadedFile}</h5>
                          {uploadDetails && (
                            <div className={tikTokStyles.uploadedFileDetails}>
                              <span>{uploadDetails.size}</span>
                              <span>{uploadDetails.type}</span>
                            </div>
                          )}
                        </div>
                        <button 
                          className={tikTokStyles.changeFileButton}
                          onClick={handleUploadClick}
                          disabled={isUploading || isLoading}
                        >
                          Change
                        </button>
                      </div>
                      
                      {!videoUrl && (
                        <div className={tikTokStyles.postActions}>
                          <button
                            className={tikTokStyles.postButton}
                            onClick={handleFileUpload}
                            disabled={isUploading || !file}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="17 8 12 3 7 8"></polyline>
                              <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg> Upload Video
                          </button>
                        </div>
                      )}
                      
                      {videoUrl && (
                        <div className={tikTokStyles.postActions}>
                          <button
                            className={tikTokStyles.postButton}
                            onClick={(e) => handlePostVideo(e)}
                            disabled={isLoading || !videoUrl}
                          >
                            <TikTokSimpleIcon width="16" height="16" /> Post to TikTok
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
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