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
  const videoRef = useRef(null);
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [file, setFile] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [caption, setCaption] = useState('');
  const [postStep, setPostStep] = useState(1); // 1: Upload, 2: Preview & Caption
  // Add new state for multiple accounts
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  // Remove selectedAccount state and replace with an array of tokens/openIds
  const [accountTokens, setAccountTokens] = useState({});
  // Add new state for UI improvements
  const [isHovering, setIsHovering] = useState(null);

  // Format file size function
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

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

  // Load connected accounts from localStorage
  useEffect(() => {
    setApiUrl(API_BASE_URL);
    
    // First check for legacy token (no number)
    const legacyToken = localStorage?.getItem('tiktokAccessToken');
    const legacyOpenId = localStorage?.getItem('tiktokOpenId');
    const legacyRefreshToken = localStorage?.getItem('tiktokRefreshToken');

    if (legacyToken && legacyOpenId) {
      const account = {
        accessToken: legacyToken,
        openId: legacyOpenId,
        refreshToken: legacyRefreshToken,
        index: 1  // Set legacy account as first
      };
      
      // Migrate legacy tokens to new format
      localStorage?.setItem('tiktok1AccessToken', legacyToken);
      localStorage?.setItem('tiktok1OpenId', legacyOpenId);
      if (legacyRefreshToken) localStorage?.setItem('tiktok1RefreshToken', legacyRefreshToken);
      
      // Remove legacy tokens
      localStorage?.removeItem('tiktokAccessToken');
      localStorage?.removeItem('tiktokOpenId');
      localStorage?.removeItem('tiktokRefreshToken');
      
      setConnectedAccounts([account]);
      // Initialize with the first account for backward compatibility
      setAccessToken(legacyToken);
      setOpenId(legacyOpenId);
      setIsAuthenticated(true);
      
      // Set account tokens
      setAccountTokens({
        [legacyOpenId]: {
          accessToken: legacyToken,
          openId: legacyOpenId,
          refreshToken: legacyRefreshToken
        }
      });
      
      fetchUserInfo(legacyToken, legacyOpenId);
    } else {
      // Load all accounts with numbered keys
      const accounts = [];
      const tokens = {};
      let i = 1;
      
      while (true) {
        const token = localStorage?.getItem(`tiktok${i}AccessToken`);
        const openId = localStorage?.getItem(`tiktok${i}OpenId`);
        const refreshToken = localStorage?.getItem(`tiktok${i}RefreshToken`);
        
        if (!token || !openId) break;
        
        accounts.push({
          accessToken: token,
          openId,
          refreshToken,
          index: i
        });
        
        tokens[openId] = {
          accessToken: token,
          openId,
          refreshToken
        };
        
        i++;
      }
      
      if (accounts.length > 0) {
        setConnectedAccounts(accounts);
        // Initialize with the first account for backward compatibility
        setAccessToken(accounts[0].accessToken);
        setOpenId(accounts[0].openId);
        setIsAuthenticated(true);
        setAccountTokens(tokens);
        
        // Fetch user info for all accounts
        accounts.forEach(account => {
          fetchUserInfo(account.accessToken, account.openId);
        });
      }
    }
  }, []);

  // Update token handling in the callback effect
  useEffect(() => {
    const { access_token, open_id, refresh_token, error: urlError } = router?.query || {};
    
    if (urlError) {
      window.showToast?.error?.(decodeURIComponent(urlError));
      router?.replace('/tiktok');
      return;
    }
    
    if (access_token) {
      // Find the next available index for the new account
      const nextIndex = connectedAccounts.length + 1; // Start from 1
      
      // Save token to localStorage with numbered index
      localStorage?.setItem(`tiktok${nextIndex}AccessToken`, access_token);
      if (refresh_token) localStorage?.setItem(`tiktok${nextIndex}RefreshToken`, refresh_token);
      if (open_id) localStorage?.setItem(`tiktok${nextIndex}OpenId`, open_id);
      
      const newAccount = {
        accessToken: access_token,
        openId: open_id,
        refreshToken: refresh_token,
        index: nextIndex
      };
      
      setConnectedAccounts(prev => [...prev, newAccount]);
      setAccessToken(access_token);
      setOpenId(open_id);
      setIsAuthenticated(true);
      
      window.showToast?.success?.('Successfully connected new TikTok account!');
      
      // Fetch user info for the new account
      fetchUserInfo(access_token, open_id);
      
      router?.replace('/tiktok');
    }
  }, [router?.query]);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      
      // Redirect directly to the backend auth endpoint
      window.location.href = `${apiUrl}/tiktok/auth`;
    } catch (error) {
      console.error('Detailed auth error:', error);
      window.showToast?.error?.('Failed to initiate TikTok authentication: ' + (error?.message || 'Unknown error'));
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target?.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadedFile(selectedFile);
      setUploadError(null);
      setCurrentStep(null);
      setPostSuccess(false);
    }
  };

  const handleChangeFile = () => {
    setFile(null);
    setUploadedFile(null);
    setUploadError(null);
    setCurrentStep(null);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async () => {
    if (!file || !connectedAccounts.length) return;
    
    try {
      setIsUploading(true);
      setCurrentStep('validating');
      setUploadProgress(10);
      setUploadError(null);
      
      // Use the first account for compatibility
      const accountToUse = connectedAccounts[0];
      const token = accountToUse.accessToken;
      
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

      // Reset states
      setUploadDetails(null);
      setCurrentStep('uploading');
      
      // Log file details
      console.log('[UPLOAD] Starting upload for file:', {
        name: file.name,
        type: file.type,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      });
      
      // Upload function with retry capability
      const uploadFileWithRetry = async (maxRetries = 7, retryDelay = 3000) => {
        let attempt = 1;
        let lastError = null;
        
        for (; attempt <= maxRetries; attempt++) {
          try {
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
            
            // Set a timeout (120 seconds)
            xhr.timeout = 120000; // 2 minutes
            
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
              
              xhr.ontimeout = function() {
                reject(new Error('Upload request timed out'));
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
              return data;
            } else {
              throw new Error('Failed to get upload URL');
            }
          } catch (error) {
            console.error(`[UPLOAD] Attempt ${attempt} failed:`, error);
            lastError = error;
            
            if (attempt < maxRetries) {
              console.log(`[UPLOAD] Retrying in ${retryDelay/1000} seconds...`);
              window.showToast?.warning?.(`Upload attempt ${attempt} failed, retrying...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              // Increase retry delay for next attempt
              retryDelay = retryDelay * 1.5;
            }
          }
        }
        
        // If we get here, all retries have failed
        throw lastError || new Error('Upload failed after multiple attempts');
      };
      
      // Try to upload with retries
      const data = await uploadFileWithRetry();
      
      console.log('[UPLOAD] Upload successful, URL:', data.url);
      setVideoUrl(data.url);
      setUploadedFileUrl(data.url);
      setUploadDetails({
        filename: data.filename,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        type: file.type
      });
      window.showToast?.success?.('File uploaded successfully');
      setCurrentStep('completed');
      setPostStep(2); // Move to preview & caption step
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
    
    if (!uploadedFile && !urlOverride) {
      window.showToast?.error?.('Please upload a video first');
      return;
    }
    
    // Make sure we have at least one account
    if (connectedAccounts.length === 0) {
      window.showToast?.error?.('No TikTok accounts connected');
      return;
    }
    
    try {
      setIsLoading(true);
      setCurrentStep('preparing');
      setUploadError(null);
      
      // Using the first account for posting
      const accountToUse = connectedAccounts[0];
      const uploadUrl = urlOverride || videoUrl;
      
      // Function to retry posting if it fails
      const postVideoWithRetry = async (maxRetries = 7, retryDelay = 2000) => {
        let attempt = 1;
        let lastError = null;
        
        for (; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[POST] Attempt ${attempt}: Posting video to TikTok: ${uploadUrl}`);
            
            // Post using the specified account
            const postResponse = await fetch(`${apiUrl}/tiktok/post-video`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                videoUrl: uploadUrl,
                accessToken: accountToUse.accessToken,
                refreshToken: accountToUse.refreshToken,
                caption
              }),
            });
            
            console.log('[POST] Response status:', postResponse?.status);
            
            if (!postResponse?.ok) {
              const errorText = await postResponse.text();
              throw new Error(`Failed to post to TikTok: ${postResponse.status} - ${errorText}`);
            }
            
            const data = await postResponse.json();
            console.log('[POST] Response data:', data);
            
            return data;
          } catch (error) {
            console.error(`[POST] Attempt ${attempt} failed:`, error);
            lastError = error;
            
            if (attempt < maxRetries) {
              console.log(`[POST] Retrying in ${retryDelay/1000} seconds...`);
              window.showToast?.warning?.(`Post attempt ${attempt} failed, retrying...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              // Increase retry delay for next attempt
              retryDelay = retryDelay * 1.5;
            }
          }
        }
        
        // If we get here, all retries have failed
        throw lastError || new Error('Posting failed after multiple attempts');
      };
      
      setCurrentStep('posting');
      const postResult = await postVideoWithRetry();
      
      setCurrentStep('success');
      setPostSuccess(true);
      window.showToast?.success?.('Successfully posted to TikTok!');
      
      // Add short delay before redirect
      setTimeout(() => {
        goToHome();
      }, 3000);
    } catch (error) {
      console.error('[POST] Error:', error);
      setUploadError(error?.message || 'Error posting to TikTok');
      window.showToast?.error?.(error?.message || 'Error posting to TikTok');
      setCurrentStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Update handleLogout to use new localStorage key format
  const handleLogout = (accountToRemove) => {
    if (!accountToRemove) return;
    
    // Remove account from localStorage using numbered format
    localStorage?.removeItem(`tiktok${accountToRemove.index}AccessToken`);
    localStorage?.removeItem(`tiktok${accountToRemove.index}RefreshToken`);
    localStorage?.removeItem(`tiktok${accountToRemove.index}OpenId`);
    
    // Update connected accounts
    setConnectedAccounts(prev => prev.filter(acc => acc.index !== accountToRemove.index));
    
    // Update accountTokens
    setAccountTokens(prev => {
      const newTokens = {...prev};
      delete newTokens[accountToRemove.openId];
      return newTokens;
    });
    
    // If this was the last account, reset authentication state
    if (connectedAccounts.length <= 1) {
      setIsAuthenticated(false);
      setAccessToken(null);
      setOpenId(null);
    }
  };

  // Update fetchUserInfo to use new localStorage key format
  const fetchUserInfo = async (token, accountOpenId) => {
    try {
      const account = connectedAccounts.find(acc => acc?.openId === accountOpenId);
      const refreshToken = account ? localStorage?.getItem(`tiktok${account.index}RefreshToken`) : null;
      
      const response = await fetch(`${apiUrl}/tiktok/user-info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Refresh-Token': refreshToken || ''
        }
      });
      
      const data = await response?.json();
      if (response?.ok && data?.data) {
        // Update the user info in the connected accounts array
        setConnectedAccounts(prev => {
          const accountIndex = prev?.findIndex(acc => acc?.openId === accountOpenId);
          if (accountIndex !== -1) {
            const updatedAccounts = [...prev];
            updatedAccounts[accountIndex] = {
              ...updatedAccounts[accountIndex],
              userInfo: data.data
            };
            return updatedAccounts;
          }
          return prev;
        });
      } else {
        console.error('Failed to fetch user info:', data?.error);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  const goToHome = () => {
    router?.push('/');
  };

  // After successfully connecting a TikTok account, save it to the user's record
  const saveAccountsToUserRecord = () => {
    const firebaseUid = localStorage?.getItem('firebaseUid');
    if (!firebaseUid || !connectedAccounts.length) {
      console.log('Cannot save TikTok accounts to user record:', { 
        hasFirebaseUid: !!firebaseUid, 
        accountsCount: connectedAccounts.length 
      });
      return;
    }
    
    console.log('Saving TikTok accounts to user record with UID:', firebaseUid);
    
    const accountsData = connectedAccounts.map(account => ({
      accessToken: account.accessToken,
      openId: account.openId,
      refreshToken: account.refreshToken,
      username: account.username || `TikTok Account ${account.index}`,
      index: account.index
    }));
    
    // Save to backend
    fetch(`${API_BASE_URL}/users/${firebaseUid}/social/tiktok`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(accountsData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to save tokens: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Successfully saved TikTok accounts to user record:', data.success);
    })
    .catch(error => {
      console.error('Error saving TikTok accounts to user record:', error);
    });
  };

  // Call this after adding a new account
  useEffect(() => {
    if (connectedAccounts.length > 0) {
      saveAccountsToUserRecord();
    }
  }, [connectedAccounts]);

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
                <Link href="/" legacyBehavior><a>Features</a></Link>
                <Link href="/" legacyBehavior><a>Pricing</a></Link>
                <Link href="/" legacyBehavior><a>Integrations</a></Link>
              </div>
              
              <div className={styles.footerColumn}>
                <h4>Company</h4>
                <Link href="/" legacyBehavior><a>About</a></Link>
                <Link href="/" legacyBehavior><a>Blog</a></Link>
                <Link href="/" legacyBehavior><a>Careers</a></Link>
              </div>
              
              <div className={styles.footerColumn}>
                <h4>Resources</h4>
                <Link href="/" legacyBehavior><a>Help Center</a></Link>
                <Link href="/" legacyBehavior><a>API</a></Link>
                <Link href="/" legacyBehavior><a>Status</a></Link>
              </div>
              
              <div className={styles.footerColumn}>
                <h4>Legal</h4>
                <Link href="/" legacyBehavior><a>Privacy</a></Link>
                <Link href="/" legacyBehavior><a>Terms</a></Link>
                <Link href="/" legacyBehavior><a>Security</a></Link>
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
    <div className={styles.container}>
      <Head>
        <title>TikTok Integration - Social Lane</title>
        <meta name="description" content="Post videos to TikTok" />
      </Head>

      <main className={styles.main}>
        <section className={styles.tiktokCard}>
          <div className={styles.connectedContainer}>
            {isAuthenticated ? (
              <>
                <div className={styles.connectedHeader}>
                  <div className={styles.connectedStatus}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <h2>TikTok Accounts</h2>
                  </div>
                </div>

                {/* Accounts Management Section */}
                <div className={tikTokStyles.accountsContainer}>
                  <h2 className={tikTokStyles.sectionTitle}>Your TikTok Accounts</h2>
                  
                  <div className={tikTokStyles.accountsGrid}>
                    {connectedAccounts.map(account => {
                      const profilePic = account?.userInfo?.avatar_url;
                      const username = account?.userInfo?.username || `TikTok Account ${account.index}`;
                      const displayName = account?.userInfo?.display_name || username;
                      
                      return (
                        <div 
                          key={account.openId}
                          className={tikTokStyles.accountCardNew}
                          onMouseEnter={() => setIsHovering(account.openId)}
                          onMouseLeave={() => setIsHovering(null)}
                        >
                          <div className={tikTokStyles.accountCardHeader}>
                            <div className={tikTokStyles.accountAvatar}>
                              {profilePic ? (
                                <img 
                                  src={profilePic} 
                                  alt={`${username} avatar`}
                                  className={tikTokStyles.avatarImage}
                                />
                              ) : (
                                <TikTokSimpleIcon width="32" height="32" />
                              )}
                            </div>
                          </div>
                          
                          <div className={tikTokStyles.accountCardBody}>
                            <h3 className={tikTokStyles.accountCardName}>{displayName}</h3>
                            <p className={tikTokStyles.accountCardUsername}>@{username}</p>
                          </div>
                          
                          <div className={tikTokStyles.accountCardFooter}>
                            <button 
                              className={tikTokStyles.disconnectButtonNew}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLogout(account);
                              }}
                              aria-label="Disconnect account"
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    
                    <div 
                      className={tikTokStyles.addAccountCardNew}
                      onClick={handleConnect}
                    >
                      <div className={tikTokStyles.addAccountIconNew}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="16"></line>
                          <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                      </div>
                      <h3 className={tikTokStyles.addAccountText}>Add New Account</h3>
                    </div>
                  </div>
                </div>

                {/* Post Container - Show if there are any accounts */}
                {connectedAccounts.length > 0 && (
                  <div className={tikTokStyles.postContainer}>
                    {postStep === 1 ? (
                      // Step 1: Upload Video
                      <div className={tikTokStyles.uploadSection}>
                        <div className={tikTokStyles.uploadHeader}>
                          <h4>Upload Video to TikTok</h4>
                          <p className={tikTokStyles.uploadDescription}>
                            Select a video file to upload to TikTok
                          </p>
                        </div>
                        
                        {!uploadedFile && !isUploading && (
                          <div 
                            className={tikTokStyles.uploadDropzone}
                            onClick={handleUploadClick}
                          >
                            <div className={tikTokStyles.uploadPlaceholder}>
                              <div className={tikTokStyles.uploadIcon}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                  <polyline points="17 8 12 3 7 8"></polyline>
                                  <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                              </div>
                              <div className={tikTokStyles.uploadText}>
                                Click to upload a video
                              </div>
                              <div className={tikTokStyles.uploadHint}>
                                MP4 or WebM format, max size 50MB
                              </div>
                            </div>
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              accept="video/mp4,video/webm"
                              className={tikTokStyles.fileInput}
                            />
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
                                <h5>{uploadedFile?.name}</h5>
                                <div className={tikTokStyles.uploadedFileDetails}>
                                  {formatFileSize(uploadedFile?.size)} • {uploadedFile?.type}
                                </div>
                              </div>
                            </div>
                            
                            <button 
                              className={tikTokStyles.changeFileButton}
                              onClick={handleChangeFile}
                              disabled={isUploading}
                            >
                              Change File
                            </button>
                          </div>
                        )}

                        {/* Upload button */}
                        {uploadedFile && !videoUrl && (
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

                        {/* Upload progress section */}
                        {currentStep && getActiveProcess() === 'upload' && (
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
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      // Step 2: Preview & Caption
                      <div className={tikTokStyles.previewSection}>
                        <div className={tikTokStyles.previewHeader}>
                          <h4>Preview & Add Caption</h4>
                          <p className={tikTokStyles.previewDescription}>
                            Preview your video and add a caption before posting
                          </p>
                        </div>

                        <div className={tikTokStyles.videoPreviewContainer}>
                          {videoUrl && (
                            <video
                              ref={videoRef}
                              className={tikTokStyles.videoPreview}
                              src={videoUrl}
                              controls
                              autoPlay
                              loop
                              playsInline
                            />
                          )}
                        </div>

                        <div className={tikTokStyles.captionContainer}>
                          <textarea
                            className={tikTokStyles.captionInput}
                            placeholder="Write a caption for your video..."
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            maxLength={300}
                          />
                          <div className={tikTokStyles.captionCounter}>
                            {caption.length}/300
                          </div>
                        </div>

                        <div className={tikTokStyles.postActions}>
                          <button
                            className={`${tikTokStyles.postButton} ${tikTokStyles.backButton}`}
                            onClick={() => setPostStep(1)}
                            disabled={isLoading}
                          >
                            Back
                          </button>
                          <button
                            className={tikTokStyles.postButton}
                            onClick={(e) => handlePostVideo(e)}
                            disabled={isLoading || !videoUrl}
                          >
                            <TikTokSimpleIcon width="16" height="16" /> Post to TikTok
                          </button>
                        </div>
                      </div>
                    )}

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
                  </div>
                )}
              </>
            ) : (
              <div className={styles.connectContainer}>
                <button
                  onClick={handleConnect}
                  disabled={isLoading}
                  className={styles.connectButton}
                >
                  <TikTokSimpleIcon width="24" height="24" />
                  Connect TikTok Account
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
} 