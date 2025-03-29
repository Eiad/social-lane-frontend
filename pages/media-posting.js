import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/MediaPosting.module.css';
import { TikTokSimpleIcon, TwitterIcon } from '../src/components/icons/SocialIcons';
import ProtectedRoute from '../src/components/ProtectedRoute';
import axios from 'axios';
// Import platform-specific components
import {
  TikTokAccountSelector,
  TikTokPoster,
  TwitterAccountSelector,
  TwitterPoster
} from '../components/platforms';

const API_BASE_URL = 'https://sociallane-backend.mindio.chat';

// Enhanced fetch with timeout and retry utility
const fetchWithTimeoutAndRetry = async (url, options = {}, timeout = 120000, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      console.log(`API attempt ${attempt}/${maxRetries} for ${url}`);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      console.error(`API attempt ${attempt} failed:`, error?.message || error);
      
      if (attempt < maxRetries) {
        const delay = 2000 * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`All ${maxRetries} retry attempts failed`);
};

function MediaPosting() {
  // State for managing current step
  const [currentStep, setCurrentStep] = useState(1);
  
  // State for managing file upload
  const [file, setFile] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  
  // State for managing platforms and accounts
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  
  // TikTok accounts
  const [tiktokAccounts, setTiktokAccounts] = useState([]);
  const [selectedTiktokAccounts, setSelectedTiktokAccounts] = useState([]);
  
  // Twitter accounts
  const [twitterAccounts, setTwitterAccounts] = useState([]);
  const [selectedTwitterAccounts, setSelectedTwitterAccounts] = useState([]);
  
  // State for managing caption
  const [caption, setCaption] = useState('');
  
  // State for managing scheduling
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  
  // State for managing posting
  const [isPosting, setIsPosting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [postSuccess, setPostSuccess] = useState(false);
  const [platformResults, setPlatformResults] = useState({});
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  
  const [userId, setUserId] = useState('');
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // First useEffect - load user data and accounts
  useEffect(() => {
    // Always use Firebase UID - this is the authoritative user identifier
    const firebaseUid = localStorage?.getItem('firebaseUid');
    if (firebaseUid) {
      setUserId(firebaseUid);
      // Ensure userId is set to the Firebase UID for consistency across all components
      localStorage?.setItem('userId', firebaseUid);
      console.log('Using Firebase UID as user identifier:', firebaseUid);
    } else {
      // If no Firebase UID, check for existing userId as fallback
      const storedUserId = localStorage?.getItem('userId');
      if (storedUserId) {
        setUserId(storedUserId);
        console.log('No Firebase UID found, using existing userId:', storedUserId);
        // Note: This is a fallback and may cause issues with database operations
        window.showToast?.warning?.('Authentication issue detected. Some features might not work correctly. Please try logging in again.');
      } else {
        // As a last resort, generate a temporary ID - but warn that this may cause issues
        console.warn('No user ID found! Generating temporary ID, but this may cause sync issues.');
        const tempUserId = crypto.randomUUID();
        localStorage?.setItem('userId', tempUserId);
        setUserId(tempUserId);
        // Clearly warn the user about potential issues
        window.showToast?.error?.('Authentication issue detected. Please log in again to use all features.');
      }
    }
    
    // Load TikTok accounts on component mount
    loadTikTokAccounts();
    
    // Load Twitter accounts
    loadTwitterAccounts();
  }, []);

  // Helper function to fetch social media accounts from the database
  const fetchSocialMediaAccounts = async () => {
    try {
      console.log('Fetching social media accounts from database');
      
      // Get current user ID from localStorage
      const uid = localStorage?.getItem('firebaseUid') || localStorage?.getItem('userId');
      
      if (!uid) {
        console.error('No user ID found, cannot fetch social media accounts');
        return false;
      }
      
      // Call the backend API to get user data including social media accounts
      const response = await fetch(`/api/users/${uid}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching user data: ${response.status}`);
      }
      
      const userData = await response.json();
      
      if (userData?.success && userData?.data?.providerData) {
        // Initialize or get existing socialMediaData
        let socialMediaData = {};
        try {
          const existingData = localStorage.getItem('socialMediaData');
          if (existingData) {
            socialMediaData = JSON.parse(existingData);
          }
        } catch (error) {
          console.error('Error parsing existing socialMediaData:', error);
          socialMediaData = {};
        }
        
        // Process Twitter accounts if available
        if (userData.data.providerData.twitter) {
          const twitterData = userData.data.providerData.twitter;
          const twitterAccounts = Array.isArray(twitterData) ? twitterData : [twitterData];
          
          if (twitterAccounts.length > 0) {
            console.log(`Found ${twitterAccounts.length} Twitter accounts in database`);
            
            // Format Twitter accounts - only store UI display data, not tokens
            const formattedTwitterAccounts = twitterAccounts
              .filter(account => account)
              .map(account => ({
                userId: account.userId || account.user_id,
                username: account.username || account.screen_name || '',
                name: account.name || account.displayName || account.username || 'Twitter User',
                profileImageUrl: account.profileImageUrl || account.profile_image_url || ''
              }))
              .filter(account => account.userId);
            
            if (formattedTwitterAccounts.length > 0) {
              socialMediaData.twitter = formattedTwitterAccounts;
              console.log(`Processed ${formattedTwitterAccounts.length} Twitter accounts from database`);
              setTwitterAccounts(formattedTwitterAccounts);
            }
          }
        }
        
        // Process TikTok accounts if available
        if (userData.data.providerData.tiktok) {
          const tiktokData = userData.data.providerData.tiktok;
          const tiktokAccounts = Array.isArray(tiktokData) ? tiktokData : [tiktokData];
          
          if (tiktokAccounts.length > 0) {
            console.log(`Found ${tiktokAccounts.length} TikTok accounts in database`);
            
            // Format TikTok accounts for storage with accountId as identifier
            const formattedTiktokAccounts = tiktokAccounts
              .filter(account => account)
              .map(account => ({
                accountId: account.openId || account.accountId,
                username: account.username || account.userInfo?.username || '',
                displayName: account.displayName || account.userInfo?.display_name || '',
                avatarUrl: account.avatarUrl || account.userInfo?.avatar_url || account.avatarUrl100 || account.userInfo?.avatar_url_100 || '',
                userInfo: account.userInfo || {}
              }))
              .filter(account => account.accountId);
            
            if (formattedTiktokAccounts.length > 0) {
              socialMediaData.tiktok = formattedTiktokAccounts;
              console.log(`Processed ${formattedTiktokAccounts.length} TikTok accounts from database`);
              setTiktokAccounts(formattedTiktokAccounts);
            }
          }
        }
        
        // Save the updated socialMediaData to localStorage
        localStorage.setItem('socialMediaData', JSON.stringify(socialMediaData));
        localStorage.setItem('socialMediaDataUpdated', Date.now().toString());
        console.log('Saved social media accounts to localStorage');
        
        return true;
      } else {
        console.log('No social media data found in user data');
        return false;
      }
    } catch (error) {
      console.error('Error fetching social media accounts:', error);
      return false;
    }
  };

  // Add a new function to load Twitter accounts
  const loadTwitterAccounts = useCallback(() => {
    try {
      // Get from socialMediaData first (primary location)
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (socialMediaDataStr) {
        try {
          const socialMediaData = JSON.parse(socialMediaDataStr);
          if (socialMediaData?.twitter && Array.isArray(socialMediaData.twitter) && socialMediaData.twitter.length > 0) {
            // Filter out accounts without required fields - only userId is needed now
            const validAccounts = socialMediaData.twitter.filter(account => 
              account?.userId
            );
            
            if (validAccounts.length > 0) {
              console.log(`Loaded ${validAccounts.length} Twitter accounts from socialMediaData`);
              setTwitterAccounts(validAccounts);
              return true;
            }
          }
        } catch (e) {
          console.error('Error parsing socialMediaData for Twitter accounts:', e);
        }
      }
      
      // Fallback: try the direct twitterAccounts in localStorage
      const twitterAccountsStr = localStorage?.getItem('twitterAccounts');
      if (twitterAccountsStr) {
        try {
          const accounts = JSON.parse(twitterAccountsStr);
          if (Array.isArray(accounts) && accounts.length > 0) {
            // Filter out accounts without required fields - only userId is needed now
            const validAccounts = accounts.filter(account => 
              account?.userId
            );
            
            if (validAccounts.length > 0) {
              console.log(`Loaded ${validAccounts.length} Twitter accounts from twitterAccounts`);
              setTwitterAccounts(validAccounts);
              return true;
            }
          }
        } catch (e) {
          console.error('Error parsing twitterAccounts:', e);
        }
      }
      
      console.log('No valid Twitter accounts found in storage');
      return false;
    } catch (error) {
      console.error('Error loading Twitter accounts:', error);
      return false;
    }
  }, []);

  const loadTikTokAccounts = useCallback(() => {
    // Load exclusively from socialMediaData
    try {
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (socialMediaDataStr) {
        const socialMediaData = JSON.parse(socialMediaDataStr);
        if (socialMediaData?.tiktok && Array.isArray(socialMediaData.tiktok) && socialMediaData.tiktok.length > 0) {
          // Filter out accounts without required fields
          const validAccounts = socialMediaData.tiktok.filter(account => 
            account?.accountId
          );
          
          if (validAccounts.length > 0) {
            console.log(`Loaded ${validAccounts.length} TikTok accounts from socialMediaData`);
            setTiktokAccounts(validAccounts);
            
            // If we found TikTok accounts, update selectedPlatforms
            setSelectedPlatforms(prev => {
              if (!prev.includes('tiktok')) {
                return [...prev, 'tiktok'];
              }
              return prev;
            });
            
            return true; // Exit early since we found accounts
          }
        }
      }
      
      console.log('No valid TikTok accounts found in socialMediaData');
      return false;
    } catch (e) {
      console.error('Error loading TikTok accounts from socialMediaData:', e);
      return false;
    }
  }, []);

  // Load accounts and data on initialization
  useEffect(() => {
    const loadAllAccounts = async () => {
      console.log('Loading social media accounts...');
      
      // Try to load accounts from localStorage first
      const twitterAccountsLoaded = loadTwitterAccounts();
      const tiktokAccountsLoaded = loadTikTokAccounts();
      
      // If either account type wasn't loaded from localStorage, try to fetch from database
      if (!twitterAccountsLoaded || !tiktokAccountsLoaded) {
        console.log('Some account types not found in localStorage, trying to fetch from database');
        await fetchSocialMediaAccounts();
      }
    };
    
    loadAllAccounts();
  }, [loadTwitterAccounts, loadTikTokAccounts]);

  const handleTikTokAccountToggle = (account) => {
    if (!account?.accountId) return;
    
    setSelectedTiktokAccounts(prev => {
      const isSelected = prev.some(acc => acc?.accountId === account?.accountId);
      const newSelectedAccounts = isSelected 
        ? prev.filter(acc => acc?.accountId !== account?.accountId)
        : [...prev, account];
      
      // Also update selectedPlatforms based on if we have any accounts selected
      if (newSelectedAccounts.length > 0 && !selectedPlatforms.includes('tiktok')) {
        setSelectedPlatforms(prev => [...prev, 'tiktok']);
      } else if (newSelectedAccounts.length === 0 && selectedPlatforms.includes('tiktok')) {
        setSelectedPlatforms(prev => prev.filter(p => p !== 'tiktok'));
      }
      
      return newSelectedAccounts;
    });
  };

  const handlePlatformToggle = (platform) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platform)) {
        // If removing a platform, also clear the selected accounts for that platform
        if (platform === 'tiktok') {
          setSelectedTiktokAccounts([]);
        }
        if (platform === 'twitter') {
          setSelectedTwitterAccounts([]);
        }
        return prev.filter((p) => p !== platform);
      } else {
        return [...prev, platform];
      }
    });
  };

  const handleFileChange = (e) => {
    const selectedFile = e?.target?.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadedFile(selectedFile?.name);
      setUploadError(null);
      setVideoUrl('');
      setPostSuccess(false);
    }
  };

  const handleChangeFile = () => {
    // Don't allow changing file during upload or processing
    if (isUploading || isProcessing) return;
    
    setFile(null);
    setUploadedFile(null);
    setVideoUrl('');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleUploadClick = () => {
    // Don't allow clicking during upload or processing
    if (isUploading || isProcessing) return;
    
    fileInputRef.current?.click();
  };

  const handleFileUpload = async () => {
    if (!file) return;
    
    setUploadError(null);
    setIsUploading(true);
    setIsProcessing(false);
    setUploadProgress(0);
    
    try {
      if (!file?.type?.startsWith('video/')) {
        throw new Error('Please select a video file');
      }
      
      if (file?.size > 500 * 1024 * 1024) {
        throw new Error('File size exceeds 500MB limit');
      }
      
      // For large files, use improved chunked upload with progress tracking
      const uploadWithProgress = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event?.lengthComputable) {
            const percentCompleted = Math.round((event?.loaded * 100) / (event?.total || 1));
            setUploadProgress(percentCompleted);
            
            // Set processing state when upload reaches 100%
            if (percentCompleted === 100) {
              setIsProcessing(true);
            }
          }
        });

        return new Promise((resolve, reject) => {
          xhr.onload = function() {
            if (xhr?.status >= 200 && xhr?.status < 300) {
              try {
                const response = JSON.parse(xhr?.responseText);
                resolve(response);
              } catch (e) {
                reject(new Error('Invalid response format'));
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr?.status}: ${xhr?.statusText}`));
            }
          };
          
          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.ontimeout = () => reject(new Error('Upload timed out'));
          
          // Set longer timeout for large files
          xhr.timeout = 600000; // 10 minutes
          
          // Add event listener for network errors
          xhr.addEventListener('error', () => {
            reject(new Error('Network error occurred during upload'));
          });
          
          // Set up proper headers for streaming upload
          xhr.open('POST', '/api/upload', true);
          
          // Don't set content-type header, let the browser set it with the boundary
          xhr.setRequestHeader('X-File-Name', file.name);
          
          // Send the form data
          xhr.send(formData);
        });
      };
      
      // Use the improved upload function
      const data = await uploadWithProgress(file);
      
      if (data?.success && data?.url) {
        setVideoUrl(data?.url);
        setIsProcessing(false); // Clear processing state
        setIsUploading(false); // Clear uploading state
        window.showToast?.success?.('File uploaded successfully');
        // Automatically advance to the next step
        setCurrentStep(2);
      } else {
        throw new Error('Failed to get upload URL');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error?.message || 'Upload failed');
      setIsUploading(false);
      window.showToast?.error?.(error?.message || 'Upload failed');
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePost = async () => {
    try {
      setUploadError(null);
      setPostSuccess(false);
      setPlatformResults({});
      
      if (isScheduled) {
        setIsScheduling(true);
      } else {
        setIsPosting(true);
      }
      
      const scheduledAt = getScheduledDateTime();
      const firebaseUid = localStorage?.getItem('firebaseUid') || localStorage?.getItem('userId');
      
      if (!firebaseUid) {
        throw new Error('User ID not found. Please log in again.');
      }
      
      // Prepare platform results
      const results = {};
      
      // TikTok posting
      if (selectedPlatforms.includes('tiktok') && selectedTiktokAccounts.length > 0) {
        console.log('Posting to TikTok...');
        try {
          const tiktokResult = await TikTokPoster.postToTikTok({
            selectedTiktokAccounts,
            videoUrl,
            caption,
            firebaseUid,
            isScheduled,
            scheduledAt
          });
          
          results.tiktok = tiktokResult.results;
          
          // If scheduling, show success message
          if (isScheduled) {
            window.showToast?.success?.(`Your post has been scheduled successfully for ${scheduledAt.toLocaleString()}`);
          }
        } catch (error) {
          console.error('Error posting to TikTok:', error);
          window.showToast?.error?.(error?.message || 'Error posting to TikTok');
        }
      }
      
      // Twitter posting
      if (selectedPlatforms.includes('twitter') && selectedTwitterAccounts.length > 0) {
        console.log('Posting to Twitter...', {
          accountCount: selectedTwitterAccounts.length,
          accounts: selectedTwitterAccounts.map(acc => acc.username || acc.userId)
        });
        
        try {
          const twitterResult = await TwitterPoster.postToTwitter({
            selectedTwitterAccounts,
            videoUrl,
            caption,
            firebaseUid,
            isScheduled,
            scheduledAt
          });
          
          results.twitter = twitterResult.results;
          console.log('Twitter posting results:', twitterResult);
          
          // Check if any accounts succeeded
          const anySuccess = Array.isArray(twitterResult.results) && twitterResult.results.some(r => r.success);
          
          // If scheduling and at least one account succeeded, show success message
          if (isScheduled && anySuccess) {
            window.showToast?.success?.(`Your post has been scheduled successfully for ${scheduledAt.toLocaleString()}`);
          }
        } catch (error) {
          console.error('Error posting to Twitter:', error);
          console.error('Twitter error details:', error?.message || 'Unknown error');
          
          // Add error results for Twitter
          results.twitter = selectedTwitterAccounts.map(account => ({
            username: account.username || account.userId,
            success: false,
            error: error?.message || 'Failed to post to Twitter'
          }));
          
          window.showToast?.error?.(error?.message || 'Error posting to Twitter');
        }
      }
      
      // Save results and update UI
      setPlatformResults(results);
      
      // Check if any successful platforms
      const hasSuccessfulPosts = Object.values(results).some(result => {
        if (Array.isArray(result)) {
          return result.some(r => r.success);
        } else {
          return result.success;
        }
      });
      
      setPostSuccess(hasSuccessfulPosts);
      
      // If all were successful, show success toast
      if (hasSuccessfulPosts && !isScheduled) {
        window.showToast?.success?.('Your content has been posted successfully!');
      }
      
      // If we get here, all posting operations completed
      console.log('Posting completed with results:', results);
      
    } catch (error) {
      console.error('Error in post handling:', error);
      setUploadError(error.message);
      setPostSuccess(false);
      setIsPosting(false);
      setIsScheduling(false);
      window.showToast?.error?.(error?.message);
    } finally {
      // Use a slight delay to update state so it feels more natural
      setTimeout(() => {
        setIsPosting(false);
        setIsScheduling(false);
      }, 500);
    }
  };

  const filteredTiktokAccounts = useMemo(() => {
    return tiktokAccounts.filter(account => 
      account.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tiktokAccounts, searchTerm]);

  const filteredTwitterAccounts = useMemo(() => {
    try {
      // Use socialMediaData structure instead of legacy storage
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (!socialMediaDataStr) return [];
      
      const socialMediaData = JSON.parse(socialMediaDataStr);
      if (!socialMediaData?.twitter || !Array.isArray(socialMediaData.twitter) || socialMediaData.twitter.length === 0) {
        return [];
      }
      
      // Get Twitter accounts that match the search term
      return socialMediaData.twitter
        .filter(account => account?.username?.toLowerCase().includes(searchTerm.toLowerCase()))
        .map(account => account.username);
    } catch (error) {
      console.error('Error filtering Twitter accounts:', error);
      return [];
    }
  }, [searchTerm]);

  const renderTikTokAccounts = () => {
    if (!selectedPlatforms.includes('tiktok')) return null;
    
    return (
      <TikTokAccountSelector
        tiktokAccounts={tiktokAccounts}
        selectedTiktokAccounts={selectedTiktokAccounts}
        handleTikTokAccountToggle={handleTikTokAccountToggle}
        searchTerm={searchTerm}
      />
    );
  };

  const renderTwitterAccounts = () => {
    if (!selectedPlatforms.includes('twitter')) return null;
    
    return (
      <TwitterAccountSelector
        twitterAccounts={twitterAccounts}
        selectedTwitterAccounts={selectedTwitterAccounts}
        handleTwitterAccountToggle={handleTwitterAccountToggle}
        searchTerm={searchTerm}
      />
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className={styles.stepContainer}>
            <div className={styles.stepTitle}>
              <h2>Upload Your Media</h2>
            </div>
            <div className={styles.uploadArea}>
              {videoUrl ? (
                <div className={styles.videoPreviewContainer}>
                  <video 
                    className={styles.videoPreview} 
                    src={videoUrl} 
                    controls 
                    ref={videoRef}
                  />
                  <div className={styles.videoControls}>
                    <button 
                      className={styles.changeFileButton} 
                      onClick={handleChangeFile}
                      disabled={isUploading || isProcessing}
                      style={{ opacity: isUploading || isProcessing ? 0.6 : 1, cursor: isUploading || isProcessing ? 'not-allowed' : 'pointer' }}
                    >
                      Change Video
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div 
                    className={`${styles.dropzone} ${isUploading ? styles.uploadingState : ''}`}
                    onClick={!isUploading && !isProcessing ? handleUploadClick : undefined}
                    style={{ cursor: isUploading || isProcessing ? 'default' : 'pointer' }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className={styles.fileInput}
                      onChange={handleFileChange}
                      accept="video/*"
                      disabled={isUploading || isProcessing}
                    />
                    {isUploading ? (
                      <div className={styles.uploadingContainer}>
                        <div className={styles.progressRing}>
                          <svg className={styles.progressCircle} viewBox="0 0 120 120">
                            <circle
                              className={styles.progressCircleTrack}
                              cx="60"
                              cy="60"
                              r="54"
                              fill="none"
                              strokeWidth="12"
                            />
                            <circle
                              className={`${styles.progressCircleIndicator} ${isProcessing ? styles.processingAnimation : ''}`}
                              cx="60"
                              cy="60"
                              r="54"
                              fill="none"
                              strokeWidth="12"
                              strokeDasharray="339.292"
                              strokeDashoffset={isProcessing ? 0 : 339.292 * (1 - (uploadProgress || 0) / 100)}
                              style={{transition: 'stroke-dashoffset 0.3s ease'}}
                            />
                          </svg>
                          <div className={styles.progressPercentage}>
                            {isProcessing ? '' : `${uploadProgress || 0}%`}
                          </div>
                        </div>
                        <p className={styles.uploadingText}>
                          {isProcessing ? 'Media uploaded successfully, Now we\'re Processing your video...' : 'Uploading your video...'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <h3>Drag & Drop Your Video</h3>
                        <p>or click to browse</p>
                        <div className={styles.uploadSpecs}>
                          <span>Supported formats: MP4, MOV</span>
                          <span>Max file size: 500MB</span>
                        </div>
                      </>
                    )}
                  </div>
                  {uploadedFile && !videoUrl && !isUploading && (
                    <div className={styles.uploadControls}>
                      <div className={styles.selectedFileInfo}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <path d="M12 18v-6"></path>
                          <path d="M8 15h8"></path>
                        </svg>
                        <div className={styles.fileDetails}>
                          <span className={styles.fileName}>{uploadedFile}</span>
                          <span className={styles.fileSize}>{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : ''}</span>
                        </div>
                      </div>
                      <button 
                        className={styles.uploadButton} 
                        onClick={handleFileUpload}
                        disabled={!file || isUploading}
                      >
                        {isUploading ? 'Uploading...' : 'Upload Video'}
                      </button>
                    </div>
                  )}
                </>
              )}
              {uploadError && (
                <div className={styles.errorMessage}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12" y2="16"></line>
                  </svg>
                  <p>{uploadError}</p>
                </div>
              )}
            </div>
            {videoUrl && (
              <div className={styles.nextButtonContainer}>
                <button 
                  className={styles.nextButton} 
                  onClick={() => setCurrentStep(2)}
                >
                  Next: Choose Platforms
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold">Select platforms to post to</h2>
            
            <div className="flex flex-wrap gap-4">
              {/* TikTok platform selection */}
              <div
                className={`border rounded-lg p-4 cursor-pointer flex items-center space-x-3 ${
                  selectedPlatforms.includes('tiktok')
                    ? 'border-blue-500'
                    : 'border-gray-200'
                }`}
                onClick={() => handlePlatformToggle('tiktok')}
              >
                <div className="w-12 h-12 flex items-center justify-center bg-black rounded-full">
                  <svg viewBox="0 0 48 48" width="24" height="24" fill="white">
                    <path d="M38.0266 15.5965C34.9334 15.5965 32.1709 14.3528 30.2 12.2062V27.9677C30.2 34.9147 24.6466 40.6062 17.7334 40.6062C14.9306 40.6062 12.3595 39.5516 10.4 37.8062C12.9889 40.5342 16.6595 42.2062 20.7334 42.2062C27.6466 42.2062 33.2 36.5147 33.2 29.5677V13.8062C35.1709 15.9528 37.9334 17.1965 41.0266 17.1965V8.79648C41.0266 8.79648 39.4555 8.79648 38.0266 8.79648V15.5965ZM27.6667 11.3965V13.0306C26.9377 12.3919 26.3377 11.3743 26.0889 10.6062C25.7334 9.61733 25.5556 8.57191 25.6 7.52591V5.59648H22.8V26.3965C22.8 28.8639 20.8 30.7965 18.4 30.7965C17.0889 30.7965 15.9111 30.178 15.1556 29.2284C14.4 28.2789 14.0655 27.0506 14.2667 25.8062C14.5556 23.7965 16.2667 22.2729 18.2667 21.9965C17.1037 21.9382 16.4482 21.9965 16.4 21.9965V29.1965C16.2767 30.4408 16.6112 31.6691 17.3667 32.6187C18.1223 33.5682 19.3 34.1868 20.6112 34.1868C23.0112 34.1868 25.0112 32.2542 25.0112 29.7868V7.59648C23.2445 7.63525 20.0889 7.85191 16.2667 9.19648C16.9112 13.3677 20.2667 16.7965 24.3823 17.3187L24.4 14.508C22.0889 14.0343 20.3112 12.0454 20.3112 9.59648H27.6667V11.3965Z" />
                  </svg>
                </div>
                <span className="font-medium">TikTok</span>
                {tiktokAccounts.length > 0 && (
                  <span className="ml-2 text-sm text-green-600">
                    {tiktokAccounts.length} account{tiktokAccounts.length > 1 ? 's' : ''} connected
                  </span>
                )}
              </div>
              
              {/* Twitter platform selection */}
              <div
                className={`border rounded-lg p-4 cursor-pointer flex items-center space-x-3 ${
                  selectedPlatforms.includes('twitter')
                    ? 'border-blue-500'
                    : 'border-gray-200'
                }`}
                onClick={() => handlePlatformToggle('twitter')}
              >
                <div className="w-12 h-12 flex items-center justify-center bg-blue-400 rounded-full">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
                    <path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z" />
                  </svg>
                </div>
                <span className="font-medium">Twitter</span>
                {twitterAccounts.length > 0 && (
                  <span className="ml-2 text-sm text-green-600">
                    {twitterAccounts.length} account{twitterAccounts.length > 1 ? 's' : ''} connected
                  </span>
                )}
              </div>
            </div>
            
            {/* Display TikTok accounts */}
            {selectedPlatforms.includes('tiktok') && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">TikTok Accounts</h3>
                
                {tiktokAccounts.length === 0 ? (
                  <div className="mb-4 p-4 bg-gray-100 rounded-lg">
                    <p className="text-gray-600">No TikTok account connected.</p>
                    <Link href="/tiktok" className="mt-2 inline-block text-blue-600 hover:underline">
                      Connect TikTok account
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {tiktokAccounts.map((account) => (
                      <div
                        key={`tiktok-account-${account.accountId}`}
                        className={`p-3 border rounded-lg cursor-pointer flex items-center ${
                          selectedTiktokAccounts.some((a) => a.accountId === account.accountId)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200'
                        }`}
                        onClick={() => handleTikTokAccountToggle(account)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTiktokAccounts.some((a) => a.accountId === account.accountId)}
                          onChange={() => handleTikTokAccountToggle(account)}
                          className="mr-3"
                        />
                        <div>
                          <p className="font-medium">{account.displayName || account.userInfo?.display_name || account.username || (account.accountId ? `@${account.accountId.substring(0, 10)}...` : 'TikTok Account')}</p>
                          {account.username && (
                            <p className="text-xs text-gray-500">@{account.username}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Display Twitter accounts */}
            {selectedPlatforms.includes('twitter') && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Twitter Accounts</h3>
                
                {twitterAccounts.length === 0 ? (
                  <div className="mb-4 p-4 bg-gray-100 rounded-lg">
                    <p className="text-gray-600">No Twitter account connected.</p>
                    <Link href="/twitter" className="mt-2 inline-block text-blue-600 hover:underline">
                      Connect Twitter account
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {twitterAccounts.map((account) => (
                      <div
                        key={`twitter-account-${account.userId}`}
                        className={`p-3 border rounded-lg cursor-pointer flex items-center ${
                          selectedTwitterAccounts.some((a) => a.userId === account.userId)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200'
                        }`}
                        onClick={() => handleTwitterAccountToggle(account)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTwitterAccounts.some((a) => a.userId === account.userId)}
                          onChange={() => handleTwitterAccountToggle(account)}
                          className="mr-3"
                        />
                        <div>
                          <p className="font-medium">{account.username || account.screenName || '@' + account.userId}</p>
                          {account.username && account.userId && account.username !== account.userId && (
                            <p className="text-xs text-gray-500">ID: {account.userId}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-6 flex justify-between">
              <button
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                onClick={() => setCurrentStep(1)}
              >
                Back
              </button>
              
              <button
                className={`px-4 py-2 rounded ${
                  (selectedPlatforms.length === 0 ||
                  (selectedPlatforms.includes('tiktok') && selectedTiktokAccounts.length === 0 && !selectedPlatforms.includes('twitter')) ||
                  (selectedPlatforms.includes('twitter') && selectedTwitterAccounts.length === 0 && !selectedPlatforms.includes('tiktok')) ||
                  (selectedPlatforms.includes('tiktok') && selectedTiktokAccounts.length === 0 && 
                   selectedPlatforms.includes('twitter') && selectedTwitterAccounts.length === 0))
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
                onClick={() => {
                  // Validate that at least one platform is selected with at least one account
                  if (
                    selectedPlatforms.length === 0 || 
                    (selectedPlatforms.includes('tiktok') && selectedTiktokAccounts.length === 0 && !selectedPlatforms.includes('twitter')) ||
                    (selectedPlatforms.includes('twitter') && selectedTwitterAccounts.length === 0 && !selectedPlatforms.includes('tiktok')) ||
                    (selectedPlatforms.includes('tiktok') && selectedTiktokAccounts.length === 0 && 
                     selectedPlatforms.includes('twitter') && selectedTwitterAccounts.length === 0)
                  ) {
                    return;
                  }
                  
                  setCurrentStep(3);
                }}
              >
                Next
              </button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className={styles.stepContainer}>
            <div className={styles.captionSection}>
              <h3>Add Caption</h3>
              <textarea
                className={styles.captionInput}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption for your video..."
                maxLength={2200}
              />
              <div className={styles.captionCounter}>
                {caption.length}/2200
              </div>
            </div>

            <div className={styles.postActions}>
              <button
                className={styles.backButton}
                onClick={() => setCurrentStep(2)}
              >
                Back
              </button>
              <button
                className={styles.nextButton}
                onClick={() => setCurrentStep(4)}
              >
                Review Post
              </button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="text-center py-8 px-4 border-b">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Review Your Post</h2>
              <p className="text-gray-500">Review your content before publishing to your selected platforms</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              {/* Media Preview Section */}
              <div className="bg-gray-50 rounded-xl overflow-hidden p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Media Preview</h3>
                
                <div className="cursor-pointer relative" onClick={() => setShowVideoModal(true)}>
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    {videoUrl && (
                      <video
                        className="absolute inset-0 w-full h-full object-cover"
                        src={videoUrl}
                        playsInline
                        muted
                        ref={videoRef}
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
                      <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-gray-800 font-medium">{uploadedFile}</div>
                    <div className="text-sm text-gray-500">{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : ''}</div>
                  </div>
                </div>
                
                {/* Caption */}
                <div className="mt-6">
                  <h4 className="font-medium text-gray-700 mb-3">Post Caption</h4>
                  <div className="text-gray-700 p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                    {caption || 'No caption added'}
                  </div>
                </div>
              </div>
              
              {/* Right Column - Either Publishing Details or Posting Results */}
              {Object.keys(platformResults).length > 0 ? (
                /* Posting Results - shown when available */
                <div className="bg-gray-50 rounded-xl overflow-hidden p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Posting Results</h3>
                  <div className="space-y-4 mb-8">
                    {Object.entries(platformResults).map(([platform, result]) => (
                      <div key={`${platform}-result`} className="mb-6 last:mb-0">
                        <h4 className="text-lg font-medium text-gray-700 mb-3 flex items-center">
                          {platform === 'tiktok' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mr-2">
                              <path d="M19.6099 6.90989C17.9366 6.90989 16.5731 5.54646 16.5731 3.87312H12.1379V15.9837C12.1379 17.6477 10.7837 19.0019 9.11969 19.0019C7.45569 19.0019 6.1015 17.6477 6.1015 15.9837C6.1015 14.3197 7.45569 12.9655 9.11969 12.9655C9.51114 12.9655 9.88351 13.0447 10.2276 13.1855V8.69296C9.88351 8.65228 9.5301 8.63213 9.18077 8.63213C5.04351 8.63213 1.67578 12.0091 1.67578 16.1356C1.67578 20.2728 5.05271 23.639 9.18077 23.639C13.3088 23.639 16.6858 20.2728 16.6858 16.1356V9.93228C18.0322 10.9064 19.6743 11.445 21.427 11.445V7.10217C21.4178 7.10217 19.6191 7.10217 19.6099 6.90989Z" fill="black"/>
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mr-2">
                              <path d="M18.901 1.50293H22.581L14.541 10.7825L24 22.4999H16.594L10.794 15.4626L4.156 22.4999H0.474L9.074 12.5626L0 1.50293H7.594L12.837 7.92235L18.901 1.50293ZM17.61 20.4208H19.649L6.486 3.48519H4.298L17.61 20.4208Z" fill="black"/>
                            </svg>
                          )}
                          {platform.charAt(0).toUpperCase() + platform.slice(1)}
                        </h4>
                        {Array.isArray(result) ? (
                          <div className="space-y-3">
                            {result.map((r, i) => (
                              <div key={`${platform}-result-${i}`} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border">
                                <div className="flex items-center gap-2">
                                  {platform === 'tiktok' ? (
                                    <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                                      {r?.avatarUrl || r?.userInfo?.avatar_url ? (
                                        <img 
                                          src={r?.avatarUrl || r?.userInfo?.avatar_url} 
                                          alt={r?.displayName || 'TikTok'} 
                                          className="w-full h-full rounded-full object-cover"
                                        />
                                      ) : (
                                        <TikTokSimpleIcon width="14" height="14" />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center flex-shrink-0">
                                      {r?.profileImageUrl ? (
                                        <img 
                                          src={r.profileImageUrl} 
                                          alt={r?.username || 'Twitter'} 
                                          className="w-full h-full rounded-full object-cover"
                                        />
                                      ) : (
                                        <TwitterIcon width="14" height="14" />
                                      )}
                                    </div>
                                  )}
                                  <span className="font-medium text-gray-700">{r?.displayName || r?.username}</span>
                                </div>
                                {r?.success ? (
                                  <span className="text-green-600 flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </span>
                                ) : (
                                  <span className="text-red-600 flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    {r?.error}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border">
                            <div className="flex items-center gap-2">
                              {(() => {
                                // Find the Twitter account with matching username to get profile image
                                const account = selectedTwitterAccounts?.find(acc => 
                                  acc?.username === result?.username || 
                                  acc?.username === selectedTwitterAccounts?.[0]?.username
                                ) || selectedTwitterAccounts?.[0];
                                
                                return (
                                  <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center flex-shrink-0">
                                    {account?.profileImageUrl ? (
                                      <img 
                                        src={account.profileImageUrl} 
                                        alt={account?.username || 'Twitter'} 
                                        className="w-full h-full rounded-full object-cover"
                                      />
                                    ) : (
                                      <TwitterIcon width="14" height="14" />
                                    )}
                                  </div>
                                );
                              })()}
                              <span className="font-medium text-gray-700">
                                {selectedTwitterAccounts.map(acc => acc?.username || acc?.screenName || '@' + acc?.userId).join(', ')}
                              </span>
                            </div>
                            {result?.success ? (
                              <span className="text-green-600 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            ) : (
                              <span className="text-red-600 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                {result?.error}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Create Another Post Button */}
                  <button
                    onClick={() => {
                      // Reset states and go back to step 1
                      setFile(null);
                      setUploadedFile(null); 
                      setVideoUrl('');
                      setSelectedPlatforms([]);
                      setSelectedTiktokAccounts([]);
                      setSelectedTwitterAccounts([]);
                      setCaption('');
                      setIsScheduled(false);
                      setScheduledDate('');
                      setScheduledTime('');
                      setPlatformResults({});
                      setUploadError(null);
                      setCurrentStep(1);
                    }}
                    className="w-full py-3 mt-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Another Post
                  </button>
                </div>
              ) : (
                /* Publishing Details - shown before posting */
                <div className="bg-gray-50 rounded-xl overflow-hidden p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Publishing Details</h3>
                  
                  <div className="space-y-6">
                    {/* Selected Platforms */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Selected Platforms</h4>
                      <div className="space-y-4">
                        {/* TikTok Accounts */}
                        {selectedTiktokAccounts?.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-600 mb-2 flex items-center">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mr-2">
                                <path d="M19.6099 6.90989C17.9366 6.90989 16.5731 5.54646 16.5731 3.87312H12.1379V15.9837C12.1379 17.6477 10.7837 19.0019 9.11969 19.0019C7.45569 19.0019 6.1015 17.6477 6.1015 15.9837C6.1015 14.3197 7.45569 12.9655 9.11969 12.9655C9.51114 12.9655 9.88351 13.0447 10.2276 13.1855V8.69296C9.88351 8.65228 9.5301 8.63213 9.18077 8.63213C5.04351 8.63213 1.67578 12.0091 1.67578 16.1356C1.67578 20.2728 5.05271 23.639 9.18077 23.639C13.3088 23.639 16.6858 20.2728 16.6858 16.1356V9.93228C18.0322 10.9064 19.6743 11.445 21.427 11.445V7.10217C21.4178 7.10217 19.6191 7.10217 19.6099 6.90989Z" fill="black"/>
                              </svg>
                              TikTok ({selectedTiktokAccounts.length})
                            </h5>
                            <div className="grid grid-cols-1 gap-2">
                              {selectedTiktokAccounts?.map(account => (
                                <div key={`${account?.accountId}-review`} className="flex items-center gap-2 p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
                                  <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                                    {account?.avatarUrl || account?.userInfo?.avatar_url ? (
                                      <img 
                                        src={account?.avatarUrl || account?.userInfo?.avatar_url} 
                                        alt={account?.displayName || 'TikTok'} 
                                        className="w-full h-full rounded-full object-cover"
                                      />
                                    ) : (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M19.6099 6.90989C17.9366 6.90989 16.5731 5.54646 16.5731 3.87312H12.1379V15.9837C12.1379 17.6477 10.7837 19.0019 9.11969 19.0019C7.45569 19.0019 6.1015 17.6477 6.1015 15.9837C6.1015 14.3197 7.45569 12.9655 9.11969 12.9655C9.51114 12.9655 9.88351 13.0447 10.2276 13.1855V8.69296C9.88351 8.65228 9.5301 8.63213 9.18077 8.63213C5.04351 8.63213 1.67578 12.0091 1.67578 16.1356C1.67578 20.2728 5.05271 23.639 9.18077 23.639C13.3088 23.639 16.6858 20.2728 16.6858 16.1356V9.93228C18.0322 10.9064 19.6743 11.445 21.427 11.445V7.10217C21.4178 7.10217 19.6191 7.10217 19.6099 6.90989Z" fill="white"/>
                                      </svg>
                                    )}
                                  </div>
                                  <span className="text-gray-800 font-medium">{account?.displayName || account?.userInfo?.display_name || account?.username || (account?.accountId ? `@${account?.accountId.substring(0, 10)}...` : 'TikTok Account')}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Twitter Accounts */}
                        {selectedTwitterAccounts?.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-600 mb-2 flex items-center">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mr-2">
                                <path d="M18.901 1.50293H22.581L14.541 10.7825L24 22.4999H16.594L10.794 15.4626L4.156 22.4999H0.474L9.074 12.5626L0 1.50293H7.594L12.837 7.92235L18.901 1.50293ZM17.61 20.4208H19.649L6.486 3.48519H4.298L17.61 20.4208Z" fill="black"/>
                              </svg>
                              Twitter / X ({selectedTwitterAccounts.length})
                            </h5>
                            <div className="grid grid-cols-1 gap-2">
                              {selectedTwitterAccounts.map(account => (
                                <div key={`${account?.userId}-review`} className="flex items-center gap-2 p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
                                  <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center flex-shrink-0">
                                    {account?.profileImageUrl ? (
                                      <img 
                                        src={account.profileImageUrl} 
                                        alt={account?.username || 'Twitter'} 
                                        className="w-full h-full rounded-full object-cover"
                                      />
                                    ) : (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                        <path d="M18.901 1.50293H22.581L14.541 10.7825L24 22.4999H16.594L10.794 15.4626L4.156 22.4999H0.474L9.074 12.5626L0 1.50293H7.594L12.837 7.92235L18.901 1.50293ZM17.61 20.4208H19.649L6.486 3.48519H4.298L17.61 20.4208Z" fill="white"/>
                                      </svg>
                                    )}
                                  </div>
                                  <span className="text-gray-800 font-medium">{account?.username || account?.screenName || '@' + account?.userId}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Schedule Post */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Scheduling
                      </h4>
                      <div className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-gray-700">Schedule post</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={isScheduled}
                              onChange={(e) => setIsScheduled(e.target.checked)}
                            />
                            <div className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${isScheduled ? 'bg-green-500' : 'bg-gray-300'}`}>
                              <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out ${isScheduled ? 'transform translate-x-5' : ''}`}></div>
                            </div>
                          </label>
                        </div>

                        {isScheduled && (
                          <div className="flex flex-col sm:flex-row gap-4 mt-4">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                              <input
                                type="date"
                                value={scheduledDate}
                                onChange={(e) => setScheduledDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                              <input
                                type="time"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Post Button */}
                    <button
                      className="w-full py-3 mt-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                      onClick={handlePost}
                      disabled={isPosting || isScheduling || !hasValidPlatforms() || (isScheduled && (!scheduledDate || !scheduledTime))}
                    >
                      {isScheduling ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Scheduling...
                        </>
                      ) : isPosting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Posting...
                        </>
                      ) : (
                        <>
                          {isScheduled ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Schedule Post
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                              Post Now
                            </>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Action Buttons - Only shown before posting */}
            {Object.keys(platformResults).length === 0 && (
              <div className="flex justify-between items-center border-t p-6">
                <button
                  className="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center"
                  onClick={() => setCurrentStep(3)}
                  disabled={isPosting}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Edit
                </button>
              </div>
            )}
            
            {uploadError && (
              <div className="p-4 mb-6 bg-red-50 border-t border-red-100 text-red-700">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {uploadError}
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const hasValidPlatforms = () => {
    // Check if either platform has valid accounts selected
    const hasTiktok = selectedPlatforms?.includes('tiktok') && selectedTiktokAccounts?.length > 0;
    const hasTwitter = selectedPlatforms?.includes('twitter') && selectedTwitterAccounts?.length > 0;
    
    // Log validation status with more details
    console.log(`Platform validation:
    - TikTok selected: ${selectedPlatforms?.includes('tiktok')}
    - TikTok accounts: ${selectedTiktokAccounts?.length} (${hasTiktok ? 'Valid' : 'Invalid'})
    - Twitter selected: ${selectedPlatforms?.includes('twitter')}
    - Twitter accounts: ${selectedTwitterAccounts?.length} (${hasTwitter ? 'Valid' : 'Invalid'})
    - Overall validation: ${hasTiktok || hasTwitter ? 'Valid' : 'Invalid'}
    `);
    
    // Return true if either platform has at least one account selected
    return hasTiktok || hasTwitter;
  };

  // Render the Connect buttons
  const renderConnectButtons = () => {
    return (
      <div className={styles.connectButtonsContainer}>
        <div className={styles.platformButtonsRow}>
          <Link href="/tiktok" legacyBehavior>
            <a className={styles.connectLink}>
              <button className={styles.connectPlatformButton} type="button" onClick={(e) => e.preventDefault()}>
                <TikTokSimpleIcon width="24" height="24" />
                Connect TikTok
              </button>
            </a>
          </Link>
          <Link href="/twitter" legacyBehavior>
            <a className={styles.connectLink}>
              <button className={styles.connectPlatformButton} type="button" onClick={(e) => e.preventDefault()}>
                <TwitterIcon width="24" height="24" />
                Connect Twitter
              </button>
            </a>
          </Link>
        </div>
      </div>
    );
  };

  // Handle Twitter account toggle
  const handleTwitterAccountToggle = (account) => {
    if (!account?.userId) return;
    
    setSelectedTwitterAccounts(prev => {
      const isSelected = prev.some(acc => acc?.userId === account?.userId);
      const newSelectedAccounts = isSelected 
        ? prev.filter(acc => acc?.userId !== account?.userId)
        : [...prev, account];
      
      // Also update selectedPlatforms based on if we have any accounts selected
      if (newSelectedAccounts.length > 0 && !selectedPlatforms.includes('twitter')) {
        setSelectedPlatforms(prev => [...prev, 'twitter']);
      } else if (newSelectedAccounts.length === 0 && selectedPlatforms.includes('twitter')) {
        setSelectedPlatforms(prev => prev.filter(p => p !== 'twitter'));
      }
      
      return newSelectedAccounts;
    });
  };

  // Get scheduled date and time as a Date object
  const getScheduledDateTime = () => {
    if (!isScheduled || !scheduledDate || !scheduledTime) {
      return null;
    }
    
    // Create Date object from scheduled date and time
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
    
    // Validate scheduled time is in the future
    if (scheduledAt <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }
    
    console.log('Post scheduled for:', scheduledAt.toISOString());
    return scheduledAt;
  };

  // Create a PostingLoader component
  const PostingLoader = ({ isPosting }) => {
    const [loadingText, setLoadingText] = useState('Processing your awesome video...');
    
    useEffect(() => {
      if (!isPosting) return;
      
      const messages = [
        'Processing your awesome video...',
        'The bigger the files and number of accounts, the longer it takes...',
        'We are almost there!',
        'Just a bit more time needed...',
        'Your content is being prepared for sharing...',
        'Adding the finishing touches to your post...'
      ];
      
      let messageIndex = 0;
      const intervalId = setInterval(() => {
        messageIndex = (messageIndex + 1) % (messages?.length || 1);
        setLoadingText(messages?.[messageIndex] || 'Posting...');
      }, 3000);
      
      return () => clearInterval(intervalId);
    }, [isPosting]);
    
    if (!isPosting) return null;
    
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-green-500 animate-spin"></div>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Posting in Progress</h3>
            <p className="text-gray-600 mb-6">{loadingText}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div className="bg-green-500 h-2 rounded-full animate-pulse"></div>
            </div>
            <p className="text-xs text-gray-500">Please don&apos;t close this window</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Media Post | Social Lane</title>
        <meta name="description" content="Post to social media platforms" />
      </Head>
      
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Create Your Post</h1>
          <div className={styles.steps}>
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`${styles.step} ${currentStep >= step ? styles.active : ''} ${currentStep === step ? styles.current : ''}`}
              >
                <div className={styles.stepNumber}>{step}</div>
                <div className={styles.stepLabel}>
                  {step === 1 && 'UPLOAD'}
                  {step === 2 && 'PLATFORMS'}
                  {step === 3 && 'DETAILS'}
                  {step === 4 && 'PUBLISH'}
                </div>
              </div>
            ))}
          </div>
        </div>        
        <main className={styles.main}>
          <div className={styles.content}>
            {renderStep()}
          </div>

          {uploadError && (
            <div className={styles.errorMessage}>
              <div className={styles.errorIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12" y2="16"></line>
                </svg>
              </div>
              <div className={styles.errorContent}>
                <h4>Error</h4>
                <p>{uploadError}</p>
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowVideoModal(false)}>
          <div className="absolute inset-0 bg-black/70"></div>
          <div 
            className="relative w-11/12 max-w-4xl rounded-xl overflow-hidden shadow-2xl z-10" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-black">
              {videoUrl && (
                <video
                  className="w-full h-auto max-h-[80vh] object-contain"
                  src={videoUrl}
                  controls
                  autoPlay
                />
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Add the PostingLoader */}
      <PostingLoader isPosting={isPosting || isScheduling} />
    </>
  );
}

export default function MediaPostingPage() {
  return (
    <ProtectedRoute>
      <MediaPosting />
    </ProtectedRoute>
  );
} 