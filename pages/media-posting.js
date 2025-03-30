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

  // Add accountStatus state to track status of each account during posting
  const [accountStatus, setAccountStatus] = useState({
    tiktok: {}, // Will store accountId -> {status: 'idle'|'loading'|'success'|'error', message: ''}
    twitter: {}  // Will store userId -> {status: 'idle'|'loading'|'success'|'error', message: ''}
  });

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

  // Modify the handlePost function to properly handle scheduling
  const handlePost = async () => {
    try {
      setUploadError(null);
      setPostSuccess(false);
      setPlatformResults({});
      
      // Initialize account status tracking for all accounts
      const initialStatus = {
        tiktok: {},
        twitter: {}
      };
      
      // Set initial status for TikTok accounts
      if (selectedPlatforms.includes('tiktok')) {
        selectedTiktokAccounts.forEach(account => {
          initialStatus.tiktok[account.accountId] = {
            status: 'idle',
            message: 'Waiting to process...'
          };
        });
      }
      
      // Set initial status for Twitter accounts
      if (selectedPlatforms.includes('twitter')) {
        selectedTwitterAccounts.forEach(account => {
          initialStatus.twitter[account.userId] = {
            status: 'idle', 
            message: 'Waiting to process...'
          };
        });
      }
      
      setAccountStatus(initialStatus);
      
      const firebaseUid = localStorage?.getItem('firebaseUid') || localStorage?.getItem('userId');
      
      if (!firebaseUid) {
        throw new Error('User ID not found. Please log in again.');
      }
      
      // Check if we're scheduling or posting immediately
      if (isScheduled) {
        // SCHEDULING PATH
        setIsScheduling(true);
        
        // Get scheduled date/time
        const scheduledAt = getScheduledDateTime();
        if (!scheduledAt) {
          throw new Error('Please select a valid date and time for scheduling');
        }
        
        // Update all accounts to "scheduling" status
        const updatedStatus = { ...initialStatus };
        if (selectedPlatforms.includes('tiktok')) {
          Object.keys(updatedStatus.tiktok).forEach(accountId => {
            updatedStatus.tiktok[accountId] = {
              status: 'loading',
              message: 'Scheduling post...'
            };
          });
        }
        
        if (selectedPlatforms.includes('twitter')) {
          Object.keys(updatedStatus.twitter).forEach(userId => {
            updatedStatus.twitter[userId] = {
              status: 'loading',
              message: 'Scheduling post...'
            };
          });
        }
        
        setAccountStatus(updatedStatus);
        
        // Prepare data for scheduling API
        const schedulingData = {
          userId: firebaseUid,
          video_url: videoUrl,
          post_description: caption,
          platforms: [],
          isScheduled: true,
          scheduledDate: scheduledAt.toISOString()
        };
        
        // Add selected TikTok accounts if any
        if (selectedPlatforms.includes('tiktok') && selectedTiktokAccounts.length > 0) {
          schedulingData.platforms.push('tiktok');
          schedulingData.tiktok_accounts = selectedTiktokAccounts.map(account => ({
            accountId: account.accountId || account.openId,
            username: account.username || '',
            displayName: account.displayName || ''
          }));
        }
        
        // Add selected Twitter accounts if any
        if (selectedPlatforms.includes('twitter') && selectedTwitterAccounts.length > 0) {
          schedulingData.platforms.push('twitter');
          schedulingData.twitter_accounts = selectedTwitterAccounts.map(account => ({
            userId: account.userId,
            username: account.username || ''
          }));
        }
        
        try {
          // Make a single API call to schedule the post
          const response = await fetch('/api/schedules', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(schedulingData)
          });
          
          // Handle non-OK responses
          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorMessage = `Failed with status ${response.status}`;
            
            try {
              // Try to parse as JSON first
              if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
              } else {
                // If not JSON, try to get text
                const text = await response.text();
                if (text.includes('<!DOCTYPE html>')) {
                  errorMessage = 'Server returned HTML instead of JSON. Check network connectivity.';
                  console.error('HTML response from server:', text.substring(0, 200));
                } else {
                  errorMessage = text.substring(0, 100) || errorMessage;
                }
              }
            } catch (parseError) {
              console.error('Error parsing response:', parseError);
            }
            
            throw new Error(errorMessage);
          }
          
          const data = await response.json();
          console.log('Schedule response:', data);
          
          // Create result objects to show success in the UI
          const results = {};
          
          if (selectedPlatforms.includes('tiktok') && selectedTiktokAccounts.length > 0) {
            results.tiktok = selectedTiktokAccounts.map(account => ({
              accountId: account.accountId,
              displayName: account.displayName || account.username || '',
              success: true,
              scheduled: true,
              message: 'Post scheduled successfully'
            }));
            
            // Update all TikTok accounts with success status
            const tiktokSuccessUpdate = {};
            selectedTiktokAccounts.forEach(account => {
              tiktokSuccessUpdate[account.accountId] = {
                status: 'success',
                message: 'Post scheduled successfully'
              };
            });
            
            setAccountStatus(prev => ({
              ...prev,
              tiktok: {
                ...prev.tiktok,
                ...tiktokSuccessUpdate
              }
            }));
          }
          
          if (selectedPlatforms.includes('twitter') && selectedTwitterAccounts.length > 0) {
            results.twitter = selectedTwitterAccounts.map(account => ({
              userId: account.userId,
              username: account.username || '',
              success: true,
              scheduled: true,
              message: 'Post scheduled successfully'
            }));
            
            // Update all Twitter accounts with success status
            const twitterSuccessUpdate = {};
            selectedTwitterAccounts.forEach(account => {
              twitterSuccessUpdate[account.userId] = {
                status: 'success',
                message: 'Post scheduled successfully'
              };
            });
            
            setAccountStatus(prev => ({
              ...prev,
              twitter: {
                ...prev.twitter,
                ...twitterSuccessUpdate
              }
            }));
          }
          
          setPlatformResults(results);
          setPostSuccess(true);
          window.showToast?.success?.(`Your post has been scheduled successfully for ${scheduledAt.toLocaleString()}`);
        } catch (error) {
          console.error('Error scheduling post:', error);
          
          // Update all accounts with error status
          const errorUpdate = {
            tiktok: {},
            twitter: {}
          };
          
          selectedTiktokAccounts.forEach(account => {
            errorUpdate.tiktok[account.accountId] = {
              status: 'error',
              message: error.message || 'Failed to schedule post'
            };
          });
          
          selectedTwitterAccounts.forEach(account => {
            errorUpdate.twitter[account.userId] = {
              status: 'error',
              message: error.message || 'Failed to schedule post'
            };
          });
          
          setAccountStatus(prev => ({
            tiktok: { ...prev.tiktok, ...errorUpdate.tiktok },
            twitter: { ...prev.twitter, ...errorUpdate.twitter }
          }));
          
          // Create error results
          const errorResults = {};
          
          if (selectedPlatforms.includes('tiktok') && selectedTiktokAccounts.length > 0) {
            errorResults.tiktok = selectedTiktokAccounts.map(account => ({
              accountId: account.accountId,
              displayName: account.displayName || account.username || '',
              success: false,
              error: error.message || 'Failed to schedule post'
            }));
          }
          
          if (selectedPlatforms.includes('twitter') && selectedTwitterAccounts.length > 0) {
            errorResults.twitter = selectedTwitterAccounts.map(account => ({
              userId: account.userId,
              username: account.username || '',
              success: false,
              error: error.message || 'Failed to schedule post'
            }));
          }
          
          setPlatformResults(errorResults);
          setUploadError(error.message);
          window.showToast?.error?.(error?.message || 'Error scheduling post');
        }
      } else {
        // IMMEDIATE POSTING PATH - Continue with the existing code for immediate posting
        setIsPosting(true);
        
        // Prepare platform results
        const results = {};
        
        // Existing TikTok posting code
        if (selectedPlatforms.includes('tiktok') && selectedTiktokAccounts.length > 0) {
          // Existing TikTok posting implementation goes here
          console.log('Posting to TikTok immediately...');
          // ... (keep existing TikTok posting code) ...
        }
        
        // Existing Twitter posting code
        if (selectedPlatforms.includes('twitter') && selectedTwitterAccounts.length > 0) {
          // Existing Twitter posting implementation goes here
          console.log('Posting to Twitter immediately...');
          // ... (keep existing Twitter posting code) ...
        }
      }
    } catch (error) {
      console.error('Error in post handling:', error);
      setUploadError(error.message);
      setPostSuccess(false);
      
      // Update all accounts with error status
      const errorUpdate = {
        tiktok: {},
        twitter: {}
      };
      
      selectedTiktokAccounts.forEach(account => {
        errorUpdate.tiktok[account.accountId] = {
          status: 'error',
          message: error.message || 'Failed to post'
        };
      });
      
      selectedTwitterAccounts.forEach(account => {
        errorUpdate.twitter[account.userId] = {
          status: 'error',
          message: error.message || 'Failed to post'
        };
      });
      
      setAccountStatus(prev => ({
        tiktok: { ...prev.tiktok, ...errorUpdate.tiktok },
        twitter: { ...prev.twitter, ...errorUpdate.twitter }
      }));
      
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
                <div className="mt-8">
                  <h3 className="text-xl font-semibold mb-4">Posting Results</h3>
                  
                  {/* TikTok Results */}
                  {platformResults.tiktok && Array.isArray(platformResults.tiktok) && (
                    <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div className="p-4 border-b flex items-center">
                        <div className="mr-3">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12.53.02C13.84 0 15.14.01 16.44.02c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="currentColor"/>
                          </svg>
                        </div>
                        <h4 className="font-medium">TikTok</h4>
                        {platformResults.tiktokPartial && (
                          <span className="ml-auto text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            Partial Success
                          </span>
                        )}
                      </div>
                      <div className="p-4 max-h-[300px] overflow-auto scroll-smooth">
                        <div className="space-y-3">
                          {platformResults.tiktok.map((account, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                                  {account.success ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                                <span className="font-medium">{account.displayName || account.username || 'TikTok Account'}</span>
                              </div>
                              {account.pending && (
                                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                  Processing
                                </span>
                              )}
                              {!account.success && !account.pending && (
                                <div className="text-xs ml-3 text-red-600">
                                  {account.error || 'Failed to post'}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Twitter Results */}
                  {platformResults.twitter && Array.isArray(platformResults.twitter) && (
                    <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div className="p-4 border-b flex items-center">
                        <div className="mr-3">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M18.901 1.50293H22.581L14.541 10.7825L24 22.4999H16.594L10.794 15.4626L4.156 22.4999H0.474L9.074 12.5626L0 1.50293H7.594L12.837 7.92235L18.901 1.50293ZM17.61 20.4208H19.649L6.486 3.48519H4.298L17.61 20.4208Z" fill="currentColor"/>
                          </svg>
                        </div>
                        <h4 className="font-medium">Twitter</h4>
                        {platformResults.twitterPartial && (
                          <span className="ml-auto text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            Partial Success
                          </span>
                        )}
                      </div>
                      <div className="p-4 max-h-[300px] overflow-auto scroll-smooth">
                        <div className="space-y-3">
                          {platformResults.twitter.map((account, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                                  {account.success ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                                <span className="font-medium">@{account.username || account.userId}</span>
                              </div>
                              {account.pending && (
                                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                  Processing
                                </span>
                              )}
                              {!account.success && !account.pending && (
                                <div className="text-xs ml-3 text-red-600">
                                  {account.error || 'Failed to post'}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Show scheduling information in the results view - BEFORE Create Another Post button */}
                  {isScheduled && scheduledDate && scheduledTime && postSuccess && Object.keys(platformResults).length > 0 && (
                    <div className="mb-6 bg-white rounded-lg border border-green-100 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-green-50 flex items-center bg-green-50">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center mr-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <h4 className="font-medium text-gray-800">Your Post has been Scheduled</h4>
                      </div>
                      <div className="p-4 max-h-[300px] overflow-auto scroll-smooth">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="text-gray-500 text-sm">Date</div>
                              <div className="text-gray-800 font-medium">
                                {formatScheduledDateTime('date')}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500 text-sm">Time</div>
                              <div className="text-gray-800 font-medium">
                                {formatScheduledDateTime('time')}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                          <div className="flex items-center text-green-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm">Your content will be posted automatically</span>
                          </div>
                          <Link href="/scheduled-posts" className="text-green-600 hover:text-green-800 font-medium flex items-center text-sm">
                            Manage
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Create Another Post button */}
                  {postSuccess && (
                    <div className="my-4 flex justify-center">
                      <button
                        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors duration-200"
                        onClick={() => {
                          setCurrentStep(1);
                          setVideoUrl('');
                          setSelectedFile(null);
                          setFileName('');
                          setCaption('');
                          setPlatformResults({});
                          setPostSuccess(false);
                          setIsScheduled(false);
                        }}
                      >
                        Create Another Post
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Publishing Details - shown before posting */
                <div className="bg-gray-50 rounded-xl overflow-hidden p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Publishing Details</h3>
                  
                  <div className="space-y-6">
                    {/* Selected Platforms */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Selected Platforms
                      </h4>

                      {/* TikTok Accounts */}
                      {selectedPlatforms.includes('tiktok') && (
                        <div className="mt-4">
                          <h4 className="font-medium text-gray-700 mb-2">TikTok Accounts</h4>
                          <div className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm max-h-60 overflow-y-auto">
                            <div className="space-y-3">
                              {selectedTiktokAccounts.map((account) => (
                                <div key={account.accountId} className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <div className="mr-3 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                      {account?.avatarUrl ? (
                                        <img 
                                          src={account.avatarUrl} 
                                          alt={account.displayName || 'TikTok'} 
                                          className="w-full h-full rounded-full object-cover"
                                        />
                                      ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                          <path d="M12.53.02C13.84 0 15.14.01 16.44.02c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="black"/>
                                        </svg>
                                      )}
                                    </div>
                                    <span className="text-gray-800 font-medium">{account.displayName || account.username || account.accountId}</span>
                                  </div>
                                  
                                  {/* Show status indicator during posting */}
                                  {(isPosting || isScheduling) && accountStatus?.tiktok?.[account.accountId] ? (
                                    <AccountStatusIndicator status={accountStatus.tiktok[account.accountId]} />
                                  ) : (
                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Twitter Accounts */}
                      {selectedPlatforms.includes('twitter') && (
                        <div className="mt-4">
                          <h4 className="font-medium text-gray-700 mb-2">Twitter Accounts</h4>
                          <div className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm max-h-60 overflow-y-auto">
                            <div className="space-y-3">
                              {selectedTwitterAccounts.map((account) => (
                                <div key={account.userId} className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <div className="mr-3 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                      {account?.profileImageUrl ? (
                                        <img 
                                          src={account.profileImageUrl} 
                                          alt={account.username || 'Twitter'} 
                                          className="w-full h-full rounded-full object-cover"
                                        />
                                      ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                          <path d="M18.901 1.50293H22.581L14.541 10.7825L24 22.4999H16.594L10.794 15.4626L4.156 22.4999H0.474L9.074 12.5626L0 1.50293H7.594L12.837 7.92235L18.901 1.50293ZM17.61 20.4208H19.649L6.486 3.48519H4.298L17.61 20.4208Z" fill="black"/>
                                        </svg>
                                      )}
                                    </div>
                                    <span className="text-gray-800 font-medium">{account?.username || account?.screenName || '@' + account?.userId}</span>
                                  </div>
                                  
                                  {/* Show status indicator during posting */}
                                  {(isPosting || isScheduling) && accountStatus?.twitter?.[account.userId] ? (
                                    <AccountStatusIndicator status={accountStatus.twitter[account.userId]} />
                                  ) : (
                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
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

  // Helper function to safely format date and time
  const formatScheduledDateTime = (format) => {
    try {
      if (!scheduledDate || !scheduledTime) return '';
      const dateObj = new Date(`${scheduledDate}T${scheduledTime}`);
      if (isNaN(dateObj.getTime())) return '';
      
      if (format === 'date') {
        return dateObj.toLocaleDateString(undefined, { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        });
      } else if (format === 'time') {
        return dateObj.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      return '';
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
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
    const [loadingText, setLoadingText] = useState('Your content is being prepared for sharing...');
    const [visible, setVisible] = useState(true);
    const [leaving, setLeaving] = useState(false);
    
    useEffect(() => {
      if (!isPosting) {
        // Trigger exit animation
        if (visible) {
          setLeaving(true);
          const timeout = setTimeout(() => {
            setVisible(false);
            setLeaving(false);
          }, 300); // Match the transition duration
          return () => clearTimeout(timeout);
        }
        return;
      }
      
      setVisible(true);
      setLeaving(false);
      
      const messages = [
        'Processing your awesome video...',
        'The bigger video the longer it may take...',
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
    }, [isPosting, visible]);
    
    const handleClose = () => {
      setLeaving(true);
      setTimeout(() => {
        setVisible(false);
        setLeaving(false);
      }, 300);
    };
    
    if (!isPosting || !visible) return null;
    
    return (
      <div 
        className={`fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[300px] max-w-[400px] transition-all duration-300 transform ${
          leaving ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-medium text-gray-800">Posting in Progress</h3>
            <button 
              onClick={handleClose} 
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="flex items-center mb-3">
            <div className="relative mr-3">
              <div className="w-8 h-8 rounded-full border-4 border-gray-200"></div>
              <div className="absolute top-0 left-0 w-8 h-8 rounded-full border-4 border-t-green-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-gray-600">{loadingText}</p>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-green-500 h-1.5 rounded-full animate-pulse" style={{ width: '100%' }}></div>
          </div>
          
          <p className="text-xs text-gray-500 mt-2 text-center">Please don&apos;t close this window</p>
        </div>
      </div>
    );
  };

  // Add a component to display processing status for each account during posting
  const AccountStatusIndicator = ({ status }) => {
    if (!status) return null;
    
    if (status.status === 'loading') {
      return (
        <div className="flex items-center text-blue-500">
          <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {status.message || 'Processing...'}
        </div>
      );
    } else if (status.status === 'success') {
      return (
        <div className="flex items-center text-green-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {status.message || 'Success'}
        </div>
      );
    } else if (status.status === 'error') {
      return (
        <div className="flex items-center text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {status.message || 'Error'}
        </div>
      );
    } else if (status.status === 'next') {
      return (
        <div className="flex items-center text-yellow-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          {status.message || 'Next in queue'}
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          {status.message || 'Waiting...'}
        </div>
      );
    }
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