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

    // Track unique openIds to prevent duplicates
    const uniqueOpenIds = new Set();
    const accounts = [];
    const tokens = {};
    
    // Handle legacy account if it exists
    if (legacyToken && legacyOpenId) {
      uniqueOpenIds.add(legacyOpenId);
      
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
      
      accounts.push(account);
      
      // Set account tokens
      tokens[legacyOpenId] = {
        accessToken: legacyToken,
        openId: legacyOpenId,
        refreshToken: legacyRefreshToken
      };
    }
    
    // Load all accounts with numbered keys
    let i = 1;
    
    while (true) {
      const token = localStorage?.getItem(`tiktok${i}AccessToken`);
      const openId = localStorage?.getItem(`tiktok${i}OpenId`);
      const refreshToken = localStorage?.getItem(`tiktok${i}RefreshToken`);
      
      if (!token || !openId) break;
      
      // Skip if we already have this openId (prevent duplicates)
      if (uniqueOpenIds.has(openId)) {
        i++;
        continue;
      }
      
      uniqueOpenIds.add(openId);
      
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
      
      // Save accounts to user record once on initial load
      setTimeout(() => {
        saveAccountsToUserRecord();
      }, 1000);
    }
  }, []);

  // Update token handling in the callback effect
  useEffect(() => {
    const { access_token, open_id, refresh_token, username, display_name, avatar_url, avatar_url_100, error: urlError } = router?.query || {};
    
    if (urlError) {
      window.showToast?.error?.(decodeURIComponent(urlError));
      router?.replace('/tiktok');
      return;
    }
    
    if (access_token && open_id) {
      // Check if this account is already connected
      const isAlreadyConnected = connectedAccounts?.some(acc => acc?.openId === open_id);
      
      if (isAlreadyConnected) {
        console.log('Account already connected, skipping');
        // Just clear the URL parameters without adding duplicate account
        router?.replace('/tiktok', undefined, { shallow: true });
        return;
      }
      
      // Find the next available index for the new account
      const nextIndex = connectedAccounts.length + 1; // Start from 1
      
      // Save token to localStorage with numbered index
      localStorage?.setItem(`tiktok${nextIndex}AccessToken`, access_token);
      if (refresh_token) localStorage?.setItem(`tiktok${nextIndex}RefreshToken`, refresh_token);
      localStorage?.setItem(`tiktok${nextIndex}OpenId`, open_id);
      
      const newAccount = {
        accessToken: access_token,
        openId: open_id,
        refreshToken: refresh_token,
        index: nextIndex,
        userInfo: {
          username: username || '',
          display_name: display_name || '',
          avatar_url: avatar_url || '',
          avatar_url_100: avatar_url_100 || ''
        }
      };
      
      // Update account tokens
      setAccountTokens(prev => ({
        ...prev,
        [open_id]: {
          accessToken: access_token,
          openId: open_id,
          refreshToken: refresh_token
        }
      }));
      
      setConnectedAccounts(prev => [...prev, newAccount]);
      setAccessToken(access_token);
      setOpenId(open_id);
      setIsAuthenticated(true);
      
      window.showToast?.success?.('Successfully connected new TikTok account!');
      
      // Fetch user info for the new account
      fetchUserInfo(access_token, open_id);
      
      // Clear the URL parameters - use replace with empty query to avoid re-triggering this effect
      router?.replace({
        pathname: '/tiktok',
        query: {}
      }, undefined, { shallow: true });
    }
  // Remove connectedAccounts from the dependency array to prevent infinite loops
  }, [router?.query]);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      
      // Redirect to the local API route instead of directly to the backend
      window.location.href = `/api/tiktok/auth`;
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
            const postResponse = await fetch(`/api/tiktok/post-video`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                videoUrl: uploadUrl,
                accessToken: accountToUse?.accessToken || '',
                refreshToken: accountToUse?.refreshToken || '',
                caption: caption || ''
              }),
            });
            
            console.log('[POST] Response status:', postResponse?.status);
            
            if (!postResponse?.ok) {
              const errorText = await postResponse?.text();
              throw new Error(`Failed to post to TikTok: ${postResponse?.status} - ${errorText}`);
            }
            
            const data = await postResponse?.json();
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
    localStorage?.removeItem(`tiktok${accountToRemove?.index}AccessToken`);
    localStorage?.removeItem(`tiktok${accountToRemove?.index}RefreshToken`);
    localStorage?.removeItem(`tiktok${accountToRemove?.index}OpenId`);
    
    // Update connected accounts
    setConnectedAccounts(prev => prev?.filter(acc => acc?.index !== accountToRemove?.index));
    
    // Update accountTokens
    setAccountTokens(prev => {
      const newTokens = {...prev};
      delete newTokens[accountToRemove?.openId];
      return newTokens;
    });
    
    // If this was the last account, reset authentication state
    if (connectedAccounts?.length <= 1) {
      setIsAuthenticated(false);
      setAccessToken(null);
      setOpenId(null);
    }
  };

  // Update fetchUserInfo to use new localStorage key format
  const fetchUserInfo = async (token, accountOpenId) => {
    if (!token || !accountOpenId) {
      console.error('Missing token or openId for fetchUserInfo');
      return;
    }
    
    try {
      const account = connectedAccounts?.find(acc => acc?.openId === accountOpenId);
      const accountIndex = account?.index || 1;
      const refreshToken = account?.refreshToken || localStorage?.getItem(`tiktok${accountIndex}RefreshToken`);
      
      console.log(`Fetching user info for TikTok account ${accountIndex} with openId: ${accountOpenId}`);
      
      // Use the local API route instead of directly calling the backend
      const response = await fetch(`/api/tiktok/user-info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Refresh-Token': refreshToken || ''
        }
      });
      
      const data = await response?.json();
      if (response?.ok && data?.data) {
        const userInfo = data?.data;
        
        console.log(`User info retrieved for TikTok account ${accountIndex}:`, {
          hasUsername: !!userInfo?.username,
          hasDisplayName: !!userInfo?.display_name,
          hasAvatarUrl: !!userInfo?.avatar_url,
          hasAvatarUrl100: !!userInfo?.avatar_url_100
        });
        
        // Update the user info in the connected accounts array
        setConnectedAccounts(prev => {
          const accountIndex = prev?.findIndex(acc => acc?.openId === accountOpenId);
          if (accountIndex !== -1) {
            const updatedAccounts = [...prev];
            updatedAccounts[accountIndex] = {
              ...updatedAccounts[accountIndex],
              userInfo: userInfo
            };
            return updatedAccounts;
          }
          return prev;
        });
        
        // Don't call saveAccountsToUserRecord here to prevent multiple calls
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
    if (!firebaseUid || !connectedAccounts?.length) {
      console.log('Cannot save TikTok accounts to user record:', { 
        hasFirebaseUid: !!firebaseUid, 
        accountsCount: connectedAccounts?.length 
      });
      return;
    }
    
    // Prevent duplicate accounts with the same openId
    const uniqueAccounts = [];
    const seenOpenIds = new Set();
    
    connectedAccounts?.forEach(account => {
      if (account?.openId && !seenOpenIds.has(account.openId)) {
        seenOpenIds.add(account.openId);
        uniqueAccounts.push(account);
      }
    });
    
    console.log(`Saving ${uniqueAccounts.length} unique TikTok accounts to user record with UID:`, firebaseUid);
    
    const accountsData = uniqueAccounts.map(account => ({
      accessToken: account?.accessToken,
      openId: account?.openId,
      refreshToken: account?.refreshToken,
      username: account?.userInfo?.username || account?.username || `TikTok Account ${account?.index}`,
      displayName: account?.userInfo?.display_name || account?.displayName || '',
      avatarUrl: account?.userInfo?.avatar_url || account?.avatarUrl || '',
      avatarUrl100: account?.userInfo?.avatar_url_100 || account?.avatarUrl100 || '',
      index: account?.index
    }));
    
    // Save to backend
    fetch(`/api/users/${firebaseUid}/social/tiktok`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(accountsData)
    })
    .then(response => {
      if (!response?.ok) {
        throw new Error(`Failed to save tokens: ${response?.status}`);
      }
      return response?.json();
    })
    .then(data => {
      console.log('Successfully saved TikTok accounts to user record:', data?.success);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <Head>
          <title>TikTok Integration | Social Lane</title>
          <meta name="description" content="Connect your TikTok account with Social Lane" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <main className="py-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-pink-500"><TikTokSimpleIcon className="w-8 h-8" /></span>
              <span className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                TikTok Integration
              </span>
            </h1>
            <Link 
              href="/"
              className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center gap-2 transition-colors text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Home
            </Link>
          </div>

          {/* Main content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex flex-col items-center py-12 px-4">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Connect to TikTok</h2>
              <p className="text-gray-600 mb-8 text-center max-w-md">
                Authenticate with TikTok to post videos to your account.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 w-full max-w-4xl">
                <div className="bg-gray-50 rounded-xl p-5 text-center">
                  <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">Direct Video Upload</h3>
                  <p className="text-gray-600 text-sm">Upload videos directly to TikTok from your dashboard</p>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-5 text-center">
                  <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">Schedule Posts</h3>
                  <p className="text-gray-600 text-sm">Plan and schedule your TikTok content in advance</p>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-5 text-center">
                  <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">Analytics & Insights</h3>
                  <p className="text-gray-600 text-sm">Track performance and engagement metrics</p>
                </div>
              </div>
              
              <button
                onClick={handleConnect}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-medium flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <TikTokSimpleIcon width="20" height="20" />
                    <span>Connect TikTok Account</span>
                  </>
                )}
              </button>
              
              <div className="mt-4 flex items-center text-gray-500 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure OAuth2 authentication with TikTok
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
      <Head>
        <title>TikTok Integration | Social Lane</title>
        <meta name="description" content="Post videos to TikTok" />
      </Head>

      <main className="py-8">
        {/* Header with back button */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-pink-500"><TikTokSimpleIcon className="w-8 h-8" /></span>
            <span className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              TikTok Integration
            </span>
          </h1>
          <Link 
            href="/"
            className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center gap-2 transition-colors text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Home
          </Link>
        </div>

        {/* Main content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {/* Accounts Management Section */}
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Your TikTok Accounts</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {connectedAccounts.map(account => {
                  const profilePic = account?.userInfo?.avatar_url;
                  const username = account?.userInfo?.username || `TikTok Account ${account.index}`;
                  const displayName = account?.userInfo?.display_name || username;
                  
                  return (
                    <div 
                      key={account.openId}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                      onMouseEnter={() => setIsHovering(account.openId)}
                      onMouseLeave={() => setIsHovering(null)}
                    >
                      <div className="bg-gradient-to-r from-pink-400 to-purple-500 p-4 flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-white p-1 flex items-center justify-center overflow-hidden">
                          {profilePic ? (
                            <img 
                              src={profilePic} 
                              alt={`${username} avatar`}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-pink-100 flex items-center justify-center text-pink-500">
                              <TikTokSimpleIcon width="32" height="32" />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="p-4 text-center">
                        <h3 className="font-bold text-gray-800 mb-1">{displayName}</h3>
                        <p className="text-gray-500 text-sm">@{username}</p>
                      </div>
                      
                      <div className="border-t border-gray-100 p-3 flex justify-center">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLogout(account);
                          }}
                          className="w-full py-1.5 rounded-full border border-rose-500 text-rose-500 hover:bg-rose-50 text-sm font-medium transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  );
                })}
                
                {/* Add new account card */}
                <div 
                  onClick={handleConnect}
                  className="bg-gray-50 border border-dashed border-gray-300 rounded-xl overflow-hidden hover:bg-gray-100 transition-colors cursor-pointer flex flex-col items-center justify-center p-8 h-full"
                >
                  <div className="w-14 h-14 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-800">Add New Account</h3>
                </div>
              </div>
            </div>

            {/* Post Container - Show if there are any accounts */}
            {connectedAccounts.length > 0 && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Post to TikTok</h2>
                
                {postStep === 1 ? (
                  // Step 1: Upload Video
                  <div className="mt-4">
                    <div className="bg-gray-50 p-6 rounded-xl mb-4">
                      <h3 className="text-lg font-medium text-gray-800 mb-2">Upload Video</h3>
                      <p className="text-gray-600 mb-6">
                        Select a video file to upload to TikTok
                      </p>
                      
                      {!uploadedFile && !isUploading && (
                        <div 
                          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={handleUploadClick}
                        >
                          <div className="flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 mb-4">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                            </div>
                            <p className="text-gray-800 font-medium mb-1">Click to upload a video</p>
                            <p className="text-gray-500 text-sm">MP4 or WebM format, max size 500MB</p>
                          </div>
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="video/mp4,video/webm"
                            className="hidden"
                          />
                        </div>
                      )}

                      {uploadedFile && !isLoading && !postSuccess && (
                        <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-pink-100 flex items-center justify-center text-pink-500 mr-4">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-800 truncate">{uploadedFile?.name}</h4>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(uploadedFile?.size)} • {uploadedFile?.type}
                              </p>
                            </div>
                            <button 
                              className="ml-4 rounded-full p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                              onClick={handleChangeFile}
                              disabled={isUploading}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Upload button */}
                      {uploadedFile && !videoUrl && (
                        <div className="flex justify-end mt-4">
                          <button 
                            className="px-6 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-medium flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                            onClick={handleFileUpload}
                            disabled={isUploading || !file}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
                            </svg>
                            Upload Video
                          </button>
                        </div>
                      )}

                      {/* Upload progress section */}
                      {currentStep && getActiveProcess() === 'upload' && (
                        <div className="bg-white p-4 rounded-lg border border-gray-200 mt-4">
                          <div className="mb-2 flex justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              {currentStep === 'validating' && 'Validating file...'}
                              {currentStep === 'uploading' && 'Uploading file...'}
                              {currentStep === 'processing' && 'Processing upload...'}
                              {currentStep === 'completed' && 'Upload completed successfully!'}
                              {currentStep === 'error' && 'Error occurred'}
                            </span>
                            <span className="text-sm text-gray-500">
                              {currentStep === 'uploading' && `${uploadProgress}%`}
                            </span>
                          </div>
                          
                          {(currentStep === 'uploading' || currentStep === 'processing') && (
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div 
                                className="bg-gradient-to-r from-pink-500 to-purple-600 h-2.5 rounded-full"
                                style={{ width: `${currentStep === 'processing' ? 100 : uploadProgress}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Step 2: Preview & Caption
                  <div className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-6 rounded-xl">
                        <h3 className="text-lg font-medium text-gray-800 mb-4">Video Preview</h3>
                        
                        <div className="bg-black rounded-lg overflow-hidden aspect-[9/16] flex items-center justify-center">
                          {videoUrl && (
                            <video
                              ref={videoRef}
                              className="w-full h-full"
                              src={videoUrl}
                              controls
                              autoPlay
                              loop
                              playsInline
                            />
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-6 rounded-xl">
                        <h3 className="text-lg font-medium text-gray-800 mb-4">Add Caption</h3>
                        
                        <div className="mb-4">
                          <textarea
                            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                            placeholder="Write a caption for your video..."
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            maxLength={300}
                            rows={5}
                          />
                          <div className="text-right text-sm text-gray-500 mt-1">
                            {caption.length}/300
                          </div>
                        </div>
                        
                        <div className="flex justify-between mt-6">
                          <button
                            className="px-6 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                            onClick={() => setPostStep(1)}
                            disabled={isLoading}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back
                          </button>
                          
                          <button
                            className="px-6 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-medium flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                            onClick={(e) => handlePostVideo(e)}
                            disabled={isLoading || !videoUrl}
                          >
                            <TikTokSimpleIcon width="18" height="18" />
                            Post to TikTok
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 mt-4 rounded-r-lg">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Error occurred</h3>
                        <p className="text-sm text-red-700 mt-1">{uploadError}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 