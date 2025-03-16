import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';
import { TikTokSimpleIcon } from '../src/components/icons/SocialIcons';
import ProtectedRoute from '../src/components/ProtectedRoute';

// API base URL
const API_BASE_URL = 'https://sociallane-backend.mindio.chat';

export default function TikTokPage() {
  return (
    <ProtectedRoute>
      <TikTok />
    </ProtectedRoute>
  );
}

function TikTok() {
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

  // Load stored tokens on component mount
  useEffect(() => {
    setApiUrl(API_BASE_URL);
    
    // Check if tokens have already been loaded from the database
    const socialMediaLoaded = localStorage?.getItem('socialMediaLoaded') === 'true';
    const socialMediaLoadTime = parseInt(localStorage?.getItem('socialMediaLoadTime') || '0', 10);
    const oneHourInMs = 60 * 60 * 1000;
    const isTokenFresh = Date.now() - socialMediaLoadTime < oneHourInMs;
    
    // Only proceed with local token loading, not fetching from DB again
    const accounts = [];
    const tokens = {};
    let i = 1;
    
    // Look for tokens in numbered format (tiktok1AccessToken, tiktok2AccessToken...)
    while (true) {
      const token = localStorage?.getItem(`tiktok${i}AccessToken`);
      const openId = localStorage?.getItem(`tiktok${i}OpenId`);
      
      if (!token || !openId) break; // Stop when no more tokens found
      
      const refreshToken = localStorage?.getItem(`tiktok${i}RefreshToken`);
      const username = localStorage?.getItem(`tiktok${i}Username`) || `TikTok Account ${i}`;
      const displayName = localStorage?.getItem(`tiktok${i}DisplayName`) || username;
      const avatarUrl100 = localStorage?.getItem(`tiktok${i}AvatarUrl100`);
      
      // Create userInfo object if we have any user data
      const userInfo = username || displayName || avatarUrl100 ? {
        username,
        display_name: displayName,
        avatar_url_100: avatarUrl100
      } : null;
      
      accounts.push({
        accessToken: token,
        username,
        displayName,
        openId,
        refreshToken,
        index: i,
        userInfo
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
      
      // Fetch user info for all accounts only if needed
      // This avoids unnecessary API calls to TikTok on every page load
      if (!socialMediaLoaded || !isTokenFresh) {
        accounts.forEach(account => {
          if (!account.userInfo) {
            fetchUserInfo(account.accessToken, account.openId);
          }
        });
      }
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
    
    if (access_token) {
      // Find the next available index for the new account
      const nextIndex = connectedAccounts.length + 1; // Start from 1
      
      // Save token to localStorage with numbered format
      localStorage?.setItem(`tiktok${nextIndex}AccessToken`, access_token);
      if (refresh_token) localStorage?.setItem(`tiktok${nextIndex}RefreshToken`, refresh_token);
      if (open_id) localStorage?.setItem(`tiktok${nextIndex}OpenId`, open_id);
      if (username) localStorage?.setItem(`tiktok${nextIndex}Username`, username);
      
      // Store additional user info in localStorage
      if (avatar_url_100) localStorage?.setItem(`tiktok${nextIndex}AvatarUrl100`, avatar_url_100);
      else if (avatar_url) localStorage?.setItem(`tiktok${nextIndex}AvatarUrl100`, avatar_url);
      if (display_name) localStorage?.setItem(`tiktok${nextIndex}DisplayName`, display_name);
      
      // Create user info object from URL parameters if available
      const userInfoFromParams = username || display_name || avatar_url || avatar_url_100 ? {
        username: username || `TikTok Account ${nextIndex}`,
        display_name: display_name || username || `TikTok Account ${nextIndex}`,
        avatar_url: avatar_url || null,
        avatar_url_100: avatar_url_100 || avatar_url || null
      } : null;
      
      const newAccount = {
        accessToken: access_token,
        openId: open_id,
        refreshToken: refresh_token,
        username: username || `TikTok Account ${nextIndex}`,
        displayName: display_name || username || `TikTok Account ${nextIndex}`,
        index: nextIndex,
        userInfo: userInfoFromParams
      };
      
      setConnectedAccounts(prev => [...prev, newAccount]);
      setAccessToken(access_token);
      setOpenId(open_id);
      setIsAuthenticated(true);
      
      window.showToast?.success?.('Successfully connected new TikTok account!');
      
      // Only fetch user info if we don't already have it from URL parameters
      if (!userInfoFromParams) {
        fetchUserInfo(access_token, open_id);
      }
      
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
  const handleLogout = async (accountToRemove) => {
    if (!accountToRemove) return;
    
    try {
      // Get user ID
      const firebaseUid = localStorage?.getItem('firebaseUid');
      if (firebaseUid && accountToRemove.openId) {
        // Call the backend to remove the TikTok account
        const response = await fetch(`${API_BASE_URL}/users/${firebaseUid}/social/tiktok?openId=${accountToRemove.openId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.error('Failed to remove TikTok account from database:', await response.text());
        } else {
          console.log('Successfully removed TikTok account from database');
        }
      }
    } catch (error) {
      console.error('Error removing TikTok account from database:', error);
    }
    
    // Remove account from localStorage using numbered format
    localStorage?.removeItem(`tiktok${accountToRemove.index}AccessToken`);
    localStorage?.removeItem(`tiktok${accountToRemove.index}RefreshToken`);
    localStorage?.removeItem(`tiktok${accountToRemove.index}OpenId`);
    localStorage?.removeItem(`tiktok${accountToRemove.index}Username`);
    localStorage?.removeItem(`tiktok${accountToRemove.index}DisplayName`);
    localStorage?.removeItem(`tiktok${accountToRemove.index}AvatarUrl100`);
    
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
    
    // Show success message
    window.showToast?.success?.('TikTok account disconnected successfully');
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
        // Find the account index
        const accountIndex = connectedAccounts.findIndex(acc => acc?.openId === accountOpenId);
        
        if (accountIndex !== -1) {
          const accountObj = connectedAccounts[accountIndex];
          const userInfo = data.data;
          
          // Store user info in localStorage
          localStorage?.setItem(`tiktok${accountObj.index}Username`, userInfo.username || `TikTok Account ${accountObj.index}`);
          if (userInfo.display_name) localStorage?.setItem(`tiktok${accountObj.index}DisplayName`, userInfo.display_name);
          if (userInfo.avatar_url_100) localStorage?.setItem(`tiktok${accountObj.index}AvatarUrl100`, userInfo.avatar_url_100);
          else if (userInfo.avatar_url) localStorage?.setItem(`tiktok${accountObj.index}AvatarUrl100`, userInfo.avatar_url);
          
          // Update the user info in the connected accounts array
          setConnectedAccounts(prev => {
            const updatedAccounts = [...prev];
            updatedAccounts[accountIndex] = {
              ...updatedAccounts[accountIndex],
              username: userInfo.username || updatedAccounts[accountIndex].username,
              displayName: userInfo.display_name || userInfo.username || updatedAccounts[accountIndex].displayName,
              userInfo: data.data
            };
            return updatedAccounts;
          });
        }
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
      displayName: account.displayName || account.username || `TikTok Account ${account.index}`,
      index: account.index,
      // Include profile information
      avatar_url: account.userInfo?.avatar_url || null,
      avatar_url_100: account.userInfo?.avatar_url_100 || null
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <Head>
          <title>TikTok Integration - Social Lane</title>
          <meta name="description" content="Connect your TikTok account with Social Lane" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <main className="py-8">
          {/* Header with back button */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-pink-500"><TikTokSimpleIcon className="w-8 h-8" /></span>
              <span className="bg-gradient-to-r from-pink-500 to-blue-500 bg-clip-text text-transparent">
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

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-8">
            <div className="flex flex-col items-center py-6 max-w-3xl mx-auto text-center">
              <div className="w-20 h-20 rounded-full bg-pink-100 flex items-center justify-center mb-6">
                <TikTokSimpleIcon className="w-10 h-10 text-pink-500" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Connect to TikTok</h2>
              <p className="text-gray-600 mb-8 max-w-lg">
                Authenticate with TikTok to upload and post videos directly from Social Lane. Manage multiple accounts and schedule your content.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-10">
                <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Direct Upload</h3>
                  <p className="text-gray-600 text-sm">Upload videos directly to TikTok from your dashboard</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Schedule Posts</h3>
                  <p className="text-gray-600 text-sm">Plan and schedule your TikTok content in advance</p>
                </div>
                
                <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-pink-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Analytics & Insights</h3>
                  <p className="text-gray-600 text-sm">Track performance and engagement metrics</p>
                </div>
              </div>
              
              <button 
                onClick={handleConnect} 
                className="px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 to-blue-500 text-white font-medium flex items-center gap-2 transition-transform transform hover:scale-105 disabled:opacity-70 disabled:pointer-events-none"
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
                    <TikTokSimpleIcon className="w-5 h-5" />
                    <span>Connect TikTok Account</span>
                  </>
                )}
              </button>
              
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Secure OAuth2 authentication with TikTok</span>
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
        <title>TikTok Integration - Social Lane</title>
        <meta name="description" content="Post videos to TikTok" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="py-8">
        {/* Header with back button */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-pink-500"><TikTokSimpleIcon className="w-8 h-8" /></span>
            <span className="bg-gradient-to-r from-pink-500 to-blue-500 bg-clip-text text-transparent">
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
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Your TikTok Accounts</h2>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => handleLogout()} 
                    className="px-4 py-2 rounded-full border border-rose-500 text-rose-500 hover:bg-rose-50 flex items-center gap-1.5 text-sm font-medium transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Disconnect All</span>
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {connectedAccounts.map(account => {
                  const profilePic = account?.userInfo?.avatar_url_100 || account?.userInfo?.avatar_url;
                  const username = account?.userInfo?.username || account.username || `TikTok Account ${account.index}`;
                  const displayName = account?.userInfo?.display_name || account.displayName || username;
                  
                  return (
                    <div 
                      key={account.openId}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="bg-gradient-to-r from-pink-500 to-blue-400 p-4 flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-white p-1 flex items-center justify-center overflow-hidden">
                          {profilePic ? (
                            <img 
                              src={profilePic} 
                              alt={`${displayName} profile`}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-pink-100 flex items-center justify-center text-pink-500">
                              <TikTokSimpleIcon className="w-8 h-8" />
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
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:border-pink-400 hover:bg-pink-50 cursor-pointer transition-colors text-center h-full"
                >
                  <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-pink-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">Connect another account</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 
