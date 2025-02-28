import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.scss';
import tikTokStyles from '../styles/TikTok.module.css';
import Head from 'next/head';
import { TikTokSimpleIcon } from '../src/components/icons/SocialIcons';
import Link from 'next/link';

// Replace this line:
// const API_BASE_URL = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined;

// With this approach that safely handles both server and client environments:
const API_BASE_URL = typeof window !== 'undefined' 
  ? process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat'
  : process.env.NEXT_PUBLIC_API_URL;

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
  const fileInputRef = useRef(null);
  const router = useRouter();

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
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        mode: 'cors',
      });
      
      // Debug response
      console.log('Response status:', response.status);
      
      const data = await response?.json();
      console.log('Response data:', data);
      
      if (data?.authUrl) {
        console.log('Redirecting to auth URL:', data.authUrl);
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (error) {
      console.error('Detailed auth error:', error);
      window.showToast?.error?.(('Failed to initiate TikTok authentication: ' + (error?.message || 'Unknown error')));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    // Reset states
    setUploadError(null);
    setUploadDetails(null);
    setCurrentStep('validating');

    // Check if file is a video
    if (!file.type.startsWith('video/')) {
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
      
      // Create a promise to handle the XHR request
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.open('POST', '/api/upload', true);
        
        xhr.onload = () => {
          console.log(`[UPLOAD] Request completed with status: ${xhr.status}`);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              console.log('[UPLOAD] Response data:', data);
              resolve(data);
            } catch (error) {
              console.error('[UPLOAD] Error parsing response:', error);
              reject(new Error('Invalid response format'));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              console.error('[UPLOAD] Error response:', errorData);
              reject(new Error(errorData?.error || errorData?.details || 'Upload failed'));
            } catch (error) {
              console.error('[UPLOAD] Error parsing error response:', error);
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };
        
        xhr.onerror = (error) => {
          console.error('[UPLOAD] Network error:', error);
          reject(new Error('Network error during upload'));
        };
        
        console.log('[UPLOAD] Sending request');
        xhr.send(formData);
      });
      
      setCurrentStep('processing');
      const data = await uploadPromise;
      
      if (data?.success && data?.url) {
        console.log('[UPLOAD] Upload successful, URL:', data.url);
        setVideoUrl(data.url);
        setUploadedFile(file.name);
        setUploadDetails({
          filename: data.filename,
          url: data.url,
          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          type: file.type
        });
        window.showToast?.success?.('File uploaded successfully');
        setCurrentStep('completed');
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

  const handlePostVideo = async (e) => {
    e.preventDefault();
    if (!videoUrl) return;

    try {
      setIsLoading(true);
      setCurrentStep('preparing');
      
      // Use the token from state or localStorage as a fallback
      const token = accessToken || localStorage?.getItem('tiktokAccessToken');
      
      if (!token) {
        throw new Error('No access token available. Please reconnect your TikTok account.');
      }
      
      // Make sure we're using the environment variable
      const url = `${apiUrl}/tiktok/post-video`;
      
      console.log('[POST] Sending video to TikTok:', {
        url: videoUrl,
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
          videoUrl,
          accessToken: token,
        }),
      });

      console.log('[POST] Response status:', response?.status);
      const data = await response?.json();
      console.log('[POST] Response data:', data);
      
      if (response?.ok) {
        setCurrentStep('success');
        window.showToast?.success?.('Video posted successfully!');
        setVideoUrl('');
        setUploadedFile(null);
        setUploadDetails(null);
      } else {
        setCurrentStep('error');
        throw new Error(data?.error || 'Failed to post video');
      }
    } catch (error) {
      console.error('[POST] Error:', error);
      setCurrentStep('error');
      window.showToast?.error?.(error?.message || 'Unknown error occurred');
      console.error('Post error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setAccessToken(null);
    setOpenId(null);
    setIsAuthenticated(false);
    localStorage?.removeItem('tiktokAccessToken');
    localStorage?.removeItem('tiktokOpenId');
    window.showToast?.info?.('Disconnected from TikTok account');
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
                    
                    {/* Step Indicator */}
                    {currentStep && (
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
                        
                        {/* Show progress bar for uploading and processing steps */}
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
                        
                        {/* Show completed progress bar for file uploads */}
                        {currentStep === 'completed' && (
                          <div className={`${tikTokStyles.progressBarContainer} ${tikTokStyles.uploadCompleted}`}>
                            <div 
                              className={tikTokStyles.progressBar} 
                              style={{ width: '100%' }}
                            ></div>
                            <span className={tikTokStyles.progressText}>Completed!</span>
                          </div>
                        )}
                        
                        {/* Show completed progress bar for success step with static styling */}
                        {currentStep === 'success' && (
                          <div className={`${tikTokStyles.progressBarContainer} ${tikTokStyles.uploadCompleted} ${tikTokStyles.staticCompleted}`}>
                            <div 
                              className={tikTokStyles.progressBar} 
                              style={{ width: '100%' }}
                            ></div>
                            <span className={tikTokStyles.progressText}>Posted Successfully!</span>
                          </div>
                        )}
                        
                        {/* Multi-step progress indicator for upload process */}
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
                        
                        {/* Multi-step progress indicator for posting process */}
                        {getActiveProcess() === 'posting' && (
                          <div className={`${tikTokStyles.progressSteps} ${currentStep === 'success' ? tikTokStyles.staticCompleted : ''}`}>
                            {postingSteps.map((step, index) => {
                              const currentIndex = getCurrentStepIndex();
                              const isActive = index === currentIndex;
                              const isCompleted = index < currentIndex || currentStep === 'success';
                              const isSuccessStep = step.id === 'success';
                              const isStaticSuccess = currentStep === 'success';
                              
                              return (
                                <div key={step.id} className={tikTokStyles.progressStep}>
                                  <div 
                                    className={`
                                      ${tikTokStyles.progressStepDot} 
                                      ${isActive ? tikTokStyles.active : ''} 
                                      ${isCompleted ? tikTokStyles.completed : ''} 
                                      ${isActive && isSuccessStep && !isStaticSuccess ? 'success' : ''}
                                      ${isStaticSuccess ? tikTokStyles.staticCompleted : ''}
                                    `}
                                  ></div>
                                  <div 
                                    className={`
                                      ${tikTokStyles.progressStepLabel} 
                                      ${isActive ? tikTokStyles.active : ''} 
                                      ${isCompleted ? tikTokStyles.completed : ''} 
                                      ${isActive && isSuccessStep && !isStaticSuccess ? 'success' : ''}
                                      ${isStaticSuccess && isSuccessStep ? tikTokStyles.staticCompleted : ''}
                                    `}
                                  >
                                    {step.label}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Error Message */}
                    {uploadError && (
                      <div className={tikTokStyles.errorMessage}>
                        <p>{uploadError}</p>
                      </div>
                    )}
                    
                    <div className={tikTokStyles.uploadSection}>
                      <h4>Upload Video</h4>
                      <div className={tikTokStyles.uploadContainer}>
                        <input
                          type="file"
                          accept="video/*"
                          onChange={handleFileUpload}
                          disabled={isUploading || isLoading}
                          ref={fileInputRef}
                          className={tikTokStyles.fileInput}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading || isLoading}
                          className={tikTokStyles.uploadButton}
                        >
                          {isUploading ? `Uploading...` : 'Select File'}
                        </button>
                      </div>
                      
                      {uploadedFile && (
                        <div className={tikTokStyles.uploadedFile}>
                          <span>Uploaded: {uploadedFile}</span>
                          {uploadDetails && (
                            <div className={tikTokStyles.uploadDetails}>
                              <p>Size: {uploadDetails.size}</p>
                              <p>Type: {uploadDetails.type}</p>
                              <p>URL: <a href={uploadDetails.url} target="_blank" rel="noopener noreferrer">{uploadDetails.url}</a></p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <form onSubmit={handlePostVideo} className={tikTokStyles.postForm}>
                      <div className={tikTokStyles.formGroup}>
                        <label htmlFor="videoUrl">Video URL</label>
                        <input
                          type="url"
                          id="videoUrl"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          placeholder="Enter video URL or upload a file"
                          required
                          disabled={isLoading}
                          className={tikTokStyles.videoUrlInput}
                        />
                      </div>
                      
                      <div className={tikTokStyles.formActions}>
                        <button
                          type="submit"
                          disabled={isLoading || !videoUrl}
                          className={tikTokStyles.postButton}
                        >
                          {isLoading ? 'Posting...' : 'Post to TikTok'}
                        </button>
                        
                        <button
                          type="button"
                          onClick={handleLogout}
                          className={tikTokStyles.disconnectButton}
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