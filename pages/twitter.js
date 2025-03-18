import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';
import ProtectedRoute from '../src/components/ProtectedRoute';

// API base URL
const API_BASE_URL = 'https://sociallane-backend.mindio.chat';

// Twitter icon component
const TwitterIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
  </svg>
);

export default function TwitterPage() {
  return (
    <ProtectedRoute>
      <Twitter />
    </ProtectedRoute>
  );
}

function Twitter() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState(null);
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
  const [file, setFile] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [tweetText, setTweetText] = useState('');
  const [postStep, setPostStep] = useState(1); // 1: Upload, 2: Preview & Caption
  const [authError, setAuthError] = useState(null);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [accountTokens, setAccountTokens] = useState({});
  const [isHovering, setIsHovering] = useState(null);

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
  const fetchUserInfo = async (token, accountUserId = null) => {
    try {
      console.log('Fetching Twitter user info with token:', token ? `${token.substring(0, 10)}...` : 'missing');
      
      const response = await fetch(`${apiUrl}/twitter/user-info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response?.json();
      console.log('Twitter user info response:', {
        status: response?.status,
        ok: response?.ok,
        hasData: !!data?.data,
        userData: data?.data ? {
          name: data.data.name,
          username: data.data.username,
          has_profile_image: !!data.data.profile_image_url,
          profile_image_prefix: data.data.profile_image_url ? data.data.profile_image_url.substring(0, 20) + '...' : 'missing'
        } : 'No user data'
      });
      
      if (response?.ok && data?.data) {
        if (accountUserId) {
          // Update the specific account's user info
          setConnectedAccounts(prev => prev.map(account => {
            if (account.userId === accountUserId) {
              return {
                ...account,
                userInfo: data.data,
                name: data.data.name,
                username: data.data.username,
                profileImageUrl: data.data.profile_image_url
              };
            }
            return account;
          }));
          
          // Also update profile image in localStorage for this account
          const accountIndex = connectedAccounts.find(acc => acc.userId === accountUserId)?.index;
          if (accountIndex && data.data.profile_image_url) {
            localStorage?.setItem(`twitter${accountIndex}ProfileImage`, data.data.profile_image_url);
          }
        } else {
          // Set as general user info if no specific account
          setUserInfo(data.data);
          
          // If we have a userId but no specific account, try to find the account
          if (userId) {
            const accountIndex = connectedAccounts.find(acc => acc.userId === userId)?.index;
            if (accountIndex && data.data.profile_image_url) {
              localStorage?.setItem(`twitter${accountIndex}ProfileImage`, data.data.profile_image_url);
            }
          }
        }
        
        return data.data;
      } else {
        console.error('Failed to fetch user info:', data);
        // If there's an authentication error, clear stored tokens
        if (response?.status === 401 || data?.error?.includes('Authentication failed')) {
          console.log('Authentication failed when fetching user info, clearing stored tokens');
          handleLogout();
        }
        return null;
      }
    } catch (error) {
      console.error('Error fetching user info:', error?.message);
      return null;
    }
  };

  // Check for authentication on page load
  useEffect(() => {
    // Create an async function for fetching data
    const initializeTwitterAccounts = async () => {
      // Set API URL
      setApiUrl(API_BASE_URL || 'https://sociallane-backend.mindio.chat');
      
      // Check if we have query parameters from the OAuth callback
      const { access_token, refresh_token, user_id, username, name, profile_image_url, error } = router.query;
      
      if (error) {
        console.error('Authentication error from Twitter:', error);
        // Display a more user-friendly error message
        let errorMessage = '';
        if (error === 'invalid_scope') {
          errorMessage = 'Twitter connection failed due to permission scope issues. Please try again or contact support.';
        } else {
          errorMessage = `Twitter authentication failed: ${decodeURIComponent(error)}`;
        }
        setAuthError(errorMessage);
        
        // Clear any previous auth attempts
        const twitterKeys = Object.keys(localStorage).filter(key => key.startsWith('twitter_auth_'));
        twitterKeys.forEach(key => localStorage.removeItem(key));
        
        return;
      }
      
      // Check for accounts in localStorage using the numbered format
      const accounts = [];
      const tokens = {};
      
      // Check if social media data is already loaded from database
      const socialMediaLoaded = localStorage?.getItem('socialMediaLoaded') === 'true';
      const socialMediaLoadTime = parseInt(localStorage?.getItem('socialMediaLoadTime') || '0', 10);
      const oneHourInMs = 60 * 60 * 1000;
      const isTokenFresh = Date.now() - socialMediaLoadTime < oneHourInMs;
      
      // Look for accounts in localStorage using incremental index
      let i = 1;
      while (true) {
        const token = localStorage?.getItem(`twitter${i}AccessToken`);
        const userId = localStorage?.getItem(`twitter${i}UserId`);
        
        if (!token || !userId) break; // Stop when no more tokens found
        
        const refreshToken = localStorage?.getItem(`twitter${i}RefreshToken`);
        const accessTokenSecret = localStorage?.getItem(`twitter${i}AccessTokenSecret`);
        const username = localStorage?.getItem(`twitter${i}Username`) || `Twitter Account ${i}`;
        const name = localStorage?.getItem(`twitter${i}Name`) || username;
        const profileImageUrl = localStorage?.getItem(`twitter${i}ProfileImage`);
        
        // Create userInfo object if we have any user data
        const userInfo = username || name || profileImageUrl ? {
          username,
          name,
          profile_image_url: profileImageUrl
        } : null;
        
        accounts.push({
          accessToken: token,
          accessTokenSecret: accessTokenSecret || refreshToken, // Use refreshToken as accessTokenSecret for backward compatibility
          username,
          name,
          userId,
          refreshToken,
          index: i,
          userInfo,
          profileImageUrl
        });
        
        tokens[userId] = {
          accessToken: token,
          accessTokenSecret: accessTokenSecret || refreshToken,
          refreshToken,
          userId,
          username
        };
        
        i++;
      }
      
      if (accounts.length > 0) {
        setConnectedAccounts(accounts);
        // Initialize with the first account for backward compatibility
        setAccessToken(accounts[0].accessToken);
        setRefreshToken(accounts[0].refreshToken);
        setUserId(accounts[0].userId);
        setUsername(accounts[0].username);
        setIsAuthenticated(true);
        setAccountTokens(tokens);
        
        // Use the first account's user info if available
        if (accounts[0].userInfo) {
          setUserInfo(accounts[0].userInfo);
        }
        
        // Fetch user info for all accounts only if needed
        if (!socialMediaLoaded || !isTokenFresh) {
          for (const account of accounts) {
            if (!account.userInfo) {
              await fetchUserInfo(account.accessToken, account.userId);
            }
          }
        }
      }
      
      if (access_token) {
        // Store the tokens in state
        setAccessToken(access_token);
        setRefreshToken(refresh_token || null);
        setUserId(user_id || null);
        setUsername(username || null);
        setIsAuthenticated(true);
        
        // Create initial user info from URL parameters if available
        if (username || name || profile_image_url) {
          const userInfoFromCallback = {
            username: username || '',
            name: name || '',
            profile_image_url: profile_image_url || ''
          };
          setUserInfo(userInfoFromCallback);
        }
        
        // Fetch user info without await
        fetchUserInfo(access_token, user_id);
        
        // Clean up the URL to remove the tokens
        router.replace('/twitter', undefined, { shallow: true });
      } else if (accounts.length === 0) {
        // If no accounts in the new format, check for legacy tokens as fallback
        const storedAccessToken = localStorage.getItem('twitter_access_token');
        const storedRefreshToken = localStorage.getItem('twitter_refresh_token');
        const storedUserId = localStorage.getItem('twitter_user_id');
        const storedUsername = localStorage.getItem('twitter_username');
        
        if (storedAccessToken) {
          setAccessToken(storedAccessToken);
          setRefreshToken(storedRefreshToken);
          setUserId(storedUserId);
          setUsername(storedUsername);
          setIsAuthenticated(true);
          
          if (!socialMediaLoaded || !isTokenFresh) {
            await fetchUserInfo(storedAccessToken, storedUserId);
          }
        }
      }
    };
    
    // Call the async function
    initializeTwitterAccounts();
  }, [router.query, router]);
  
  // Store tokens in localStorage when they change
  useEffect(() => {
    if (accessToken && userId) {
      // Determine if we need to store a new account or update an existing one
      const existingAccountIndex = connectedAccounts.findIndex(account => account.userId === userId);
      const nextIndex = existingAccountIndex >= 0 ? connectedAccounts[existingAccountIndex].index : connectedAccounts.length + 1;
      
      // Store the Twitter tokens using the numbered format
      localStorage?.setItem(`twitter${nextIndex}AccessToken`, accessToken);
      if (refreshToken) {
        localStorage?.setItem(`twitter${nextIndex}RefreshToken`, refreshToken);
        localStorage?.setItem(`twitter${nextIndex}AccessTokenSecret`, refreshToken);
      }
      if (userId) localStorage?.setItem(`twitter${nextIndex}UserId`, userId);
      if (username) localStorage?.setItem(`twitter${nextIndex}Username`, username);
      
      // If we have user info, store that as well
      if (userInfo) {
        if (userInfo.name) localStorage?.setItem(`twitter${nextIndex}Name`, userInfo.name);
        if (userInfo.profile_image_url) localStorage?.setItem(`twitter${nextIndex}ProfileImage`, userInfo.profile_image_url);
      }
      
      // If this is a new account, add it to the connectedAccounts state
      if (existingAccountIndex < 0) {
        const newAccount = {
          accessToken,
          refreshToken,
          accessTokenSecret: refreshToken,
          userId,
          username: username || `Twitter Account ${nextIndex}`,
          name: userInfo?.name || username || `Twitter Account ${nextIndex}`,
          index: nextIndex,
          userInfo,
          profileImageUrl: userInfo?.profile_image_url
        };
        
        // Update localStorage with profile image if available
        if (userInfo?.profile_image_url) {
          localStorage?.setItem(`twitter${nextIndex}ProfileImage`, userInfo.profile_image_url);
        }
        
        setConnectedAccounts(prev => [...prev, newAccount]);
        
        // Update the accountTokens state
        setAccountTokens(prev => ({
          ...prev,
          [userId]: {
            accessToken,
            refreshToken,
            accessTokenSecret: refreshToken,
            userId,
            username
          }
        }));
      }
      
      // For backward compatibility, also store in the legacy format
      localStorage?.setItem('twitter_access_token', accessToken);
      if (refreshToken) {
        localStorage?.setItem('twitter_refresh_token', refreshToken);
        localStorage?.setItem('twitter_access_token_secret', refreshToken);
      }
      if (userId) localStorage?.setItem('twitter_user_id', userId);
      if (username) localStorage?.setItem('twitter_username', username);
      
      // Also save to user's database record if user is authenticated
      const firebaseUid = localStorage?.getItem('firebaseUid');
      if (firebaseUid) {
        console.log('Saving Twitter tokens to user record with UID:', firebaseUid);
        
        // Get all account data
        const accountsData = connectedAccounts.map(account => ({
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          userId: account.userId,
          username: account.username,
          name: account.name || account.username,
          profileImageUrl: account.profileImageUrl || account.userInfo?.profile_image_url
        }));
        
        // Add this account if it's new
        if (existingAccountIndex < 0) {
          accountsData.push({
            accessToken,
            refreshToken,
            userId,
            username,
            name: userInfo?.name || username,
            profileImageUrl: userInfo?.profile_image_url
          });
        }
        
        // Save to backend
        fetch(`${API_BASE_URL}/users/${firebaseUid}/social/twitter`, {
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
          console.log('Successfully saved Twitter tokens to user record:', data.success);
        })
        .catch(error => {
          console.error('Error saving Twitter tokens to user record:', error);
        });
      } else {
        console.log('No Firebase UID found, skipping token save to user record');
      }
    }
  }, [accessToken, refreshToken, userId, username, userInfo, connectedAccounts]);

  // Handle Twitter authentication
  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      
      // Get the auth URL from the backend
      console.log('Requesting Twitter auth URL from:', `${apiUrl}/twitter/auth`);
      const response = await fetch(`${apiUrl}/twitter/auth`);
      const data = await response?.json();
      
      if (response?.ok && data?.authUrl) {
        // Store the state for verification later
        localStorage.setItem('twitter_auth_state', data.state);
        console.log('Redirecting to Twitter auth URL...');
        
        // Redirect to the Twitter auth URL
        window.location.href = data.authUrl;
      } else {
        console.error('Failed to get auth URL:', data);
        setAuthError(data?.error || 'Failed to connect to Twitter. Please try again.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error connecting to Twitter:', error?.message);
      setAuthError('Network error. Please check your connection and try again.');
      setIsLoading(false);
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFile = e.target?.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadedFile(selectedFile);
      setUploadError(null);
      setVideoUrl('');
      setPostSuccess(false);
    }
  };

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!file) return;
    
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);
    setCurrentStep('validating');
    
    try {
      // Validate file type
      if (!file.type?.startsWith('video/')) {
        throw new Error('Please select a video file');
      }
      
      // Validate file size (500MB max)
      if (file.size > 500 * 1024 * 1024) {
        throw new Error('File size exceeds 500MB limit');
      }
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      setCurrentStep('uploading');
      
      // Upload the file
      const response = await axios.post(`${apiUrl}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });
      
      setCurrentStep('processing');
      
      if (response?.data?.url) {
        setUploadedFileUrl(response.data.url);
        setVideoUrl(response.data.url);
        setUploadDetails(response.data);
        setCurrentStep('completed');
        setPostStep(2); // Move to preview & caption step
      } else {
        throw new Error('Upload failed: No URL returned');
      }
    } catch (error) {
      console.error('Upload error:', error?.message);
      setUploadError(error?.message || 'Upload failed');
      setCurrentStep(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle posting to Twitter
  const handlePostTweet = async (e) => {
    e?.preventDefault();
    
    if (!uploadedFileUrl) {
      window.showToast?.error?.('Please upload a video first');
      return;
    }
    
    // Use the first connected account if there are multiple
    const activeAccount = connectedAccounts.length > 0 ? connectedAccounts[0] : null;
    
    if (!activeAccount && !accessToken) {
      window.showToast?.error?.('Not connected to Twitter. Please connect your account first.');
      return;
    }
    
    try {
      setIsPosting(true);
      setCurrentStep('preparing');
      setUploadError(null);
      
      // Get the tokens for the active account
      const accountAccessToken = activeAccount?.accessToken || accessToken;
      const accountAccessTokenSecret = activeAccount?.accessTokenSecret || refreshToken;
      const accountUserId = activeAccount?.userId || userId;
      
      const response = await fetch(`${apiUrl}/twitter/post-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoUrl: uploadedFileUrl,
          accessToken: accountAccessToken,
          accessTokenSecret: accountAccessTokenSecret,
          userId: accountUserId,
          text: tweetText || ''
        })
      });
      
      if (!response.ok) {
        // Check for authentication error
        if (response.status === 401) {
          throw new Error('Twitter authentication failed. Please reconnect your Twitter account and try again.');
        }
        
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post tweet');
      }
      
      const data = await response.json();
      console.log('Posted tweet successfully:', data);
      
      setPostSuccess(true);
      setCurrentStep('success');
      window.showToast?.success?.('Successfully posted to Twitter!');
      
      // Add a short delay before redirecting
      setTimeout(() => {
        goToHome();
      }, 3000);
    } catch (error) {
      console.error('Error posting tweet:', error);
      setUploadError(error.message || 'Failed to post tweet');
      setCurrentStep('error');
      window.showToast?.error?.(error.message || 'Failed to post tweet');
    } finally {
      setIsPosting(false);
    }
  };

  // Handle logout
  const handleLogout = async (accountToRemove) => {
    try {
      if (!accountToRemove) {
        // Get Firebase UID for API calls
        const firebaseUid = localStorage?.getItem('firebaseUid');
        
        // Remove all Twitter accounts from the database first
        if (firebaseUid && connectedAccounts?.length > 0) {
          // Create a copy of the array to avoid modification during iteration
          const accountsToRemove = [...connectedAccounts];
          
          // Remove each account from the database
          for (const account of accountsToRemove) {
            if (account?.userId) {
              try {
                const response = await fetch(`${API_BASE_URL}/users/${firebaseUid}/social/twitter?userId=${account.userId}`, {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
                
                if (!response.ok) {
                  console.error(`Failed to remove Twitter account ${account.username} (${account.userId}) from database:`, await response.text());
                } else {
                  console.log(`Successfully removed Twitter account ${account.username} (${account.userId}) from database`);
                }
              } catch (error) {
                console.error(`Error removing Twitter account ${account.username} (${account.userId}) from database:`, error);
              }
            }
          }
        }
        
        // Clear all accounts from localStorage
        // Clear legacy format
        localStorage?.removeItem('twitter_access_token');
        localStorage?.removeItem('twitter_refresh_token');
        localStorage?.removeItem('twitter_access_token_secret');
        localStorage?.removeItem('twitter_user_id');
        localStorage?.removeItem('twitter_username');
        
        // Clear numbered format
        connectedAccounts.forEach(account => {
          localStorage?.removeItem(`twitter${account.index}AccessToken`);
          localStorage?.removeItem(`twitter${account.index}RefreshToken`);
          localStorage?.removeItem(`twitter${account.index}AccessTokenSecret`);
          localStorage?.removeItem(`twitter${account.index}UserId`);
          localStorage?.removeItem(`twitter${account.index}Username`);
          localStorage?.removeItem(`twitter${account.index}Name`);
          localStorage?.removeItem(`twitter${account.index}ProfileImage`);
        });
        
        setConnectedAccounts([]);
        setAccountTokens({});
        setAccessToken(null);
        setRefreshToken(null);
        setUserId(null);
        setUsername(null);
        setIsAuthenticated(false);
        
        window.showToast?.success?.('All Twitter accounts disconnected successfully');
        return;
      }
      
      // Remove specific account
      // Get Firebase UID for API call
      const firebaseUid = localStorage?.getItem('firebaseUid');
      if (firebaseUid && accountToRemove.userId) {
        // Call the backend to remove the Twitter account
        const response = await fetch(`${API_BASE_URL}/users/${firebaseUid}/social/twitter?userId=${accountToRemove.userId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.error('Failed to remove Twitter account from database:', await response.text());
        } else {
          console.log('Successfully removed Twitter account from database');
        }
      }
      
      // Remove account from localStorage
      localStorage?.removeItem(`twitter${accountToRemove.index}AccessToken`);
      localStorage?.removeItem(`twitter${accountToRemove.index}RefreshToken`);
      localStorage?.removeItem(`twitter${accountToRemove.index}AccessTokenSecret`);
      localStorage?.removeItem(`twitter${accountToRemove.index}UserId`);
      localStorage?.removeItem(`twitter${accountToRemove.index}Username`);
      localStorage?.removeItem(`twitter${accountToRemove.index}Name`);
      localStorage?.removeItem(`twitter${accountToRemove.index}ProfileImage`);
      
      // Update connected accounts
      setConnectedAccounts(prev => prev.filter(acc => acc.userId !== accountToRemove.userId));
      
      // Update accountTokens
      setAccountTokens(prev => {
        const newTokens = {...prev};
        delete newTokens[accountToRemove.userId];
        return newTokens;
      });
      
      // If this was the only or last account, clear authentication state
      if (connectedAccounts.length <= 1) {
        // Also clear legacy format as it's no longer needed
        localStorage?.removeItem('twitter_access_token');
        localStorage?.removeItem('twitter_refresh_token');
        localStorage?.removeItem('twitter_access_token_secret');
        localStorage?.removeItem('twitter_user_id');
        localStorage?.removeItem('twitter_username');
        
        setAccessToken(null);
        setRefreshToken(null);
        setUserId(null);
        setUsername(null);
        setIsAuthenticated(false);
      } else {
        // Set the first remaining account as the current one
        const firstAccount = connectedAccounts.find(acc => acc.userId !== accountToRemove.userId);
        if (firstAccount) {
          setAccessToken(firstAccount.accessToken);
          setRefreshToken(firstAccount.refreshToken);
          setUserId(firstAccount.userId);
          setUsername(firstAccount.username);
          setUserInfo(firstAccount.userInfo);
          
          // Also update legacy format for backward compatibility
          localStorage?.setItem('twitter_access_token', firstAccount.accessToken);
          if (firstAccount.refreshToken) {
            localStorage?.setItem('twitter_refresh_token', firstAccount.refreshToken);
            localStorage?.setItem('twitter_access_token_secret', firstAccount.refreshToken);
          }
          if (firstAccount.userId) localStorage?.setItem('twitter_user_id', firstAccount.userId);
          if (firstAccount.username) localStorage?.setItem('twitter_username', firstAccount.username);
        }
      }
      
      window.showToast?.success?.('Twitter account disconnected successfully');
    } catch (error) {
      console.error('Error logging out from Twitter:', error);
      window.showToast?.error?.('Failed to disconnect Twitter account');
    }
  };

  // Refresh Twitter credentials
  const refreshTwitterCredentials = async (specificUserId = null) => {
    try {
      setIsLoading(true);
      
      // If we have a specific account to refresh
      if (specificUserId) {
        const account = connectedAccounts.find(acc => acc.userId === specificUserId);
        if (!account?.refreshToken) {
          window.showToast?.warning?.('No refresh token available for this account. Please reconnect it.');
          setIsLoading(false);
          return;
        }
        
        await refreshSingleAccount(account);
        return;
      }
      
      // If no specific account, refresh all connected accounts
      if (connectedAccounts.length === 0) {
        window.showToast?.warning?.('No Twitter accounts connected.');
        setIsLoading(false);
        return;
      }
      
      // Refresh all accounts
      let successCount = 0;
      let failureCount = 0;
      
      for (const account of connectedAccounts) {
        try {
          if (!account?.refreshToken) {
            console.log(`Skipping account ${account.username} (${account.userId}) - no refresh token`);
            failureCount++;
            continue;
          }
          
          const success = await refreshSingleAccount(account);
          if (success) successCount++;
          else failureCount++;
        } catch (accountError) {
          console.error(`Error refreshing account ${account.username} (${account.userId}):`, accountError);
          failureCount++;
        }
      }
      
      // Show summary message
      if (successCount > 0 && failureCount === 0) {
        window.showToast?.success?.(`Successfully refreshed ${successCount} Twitter account${successCount !== 1 ? 's' : ''}`);
      } else if (successCount > 0 && failureCount > 0) {
        window.showToast?.warning?.(`Refreshed ${successCount} account${successCount !== 1 ? 's' : ''}, but ${failureCount} failed`);
      } else {
        window.showToast?.error?.(`Failed to refresh any Twitter accounts`);
      }
    } catch (error) {
      console.error('Error refreshing Twitter credentials:', error?.message);
      window.showToast?.error?.(error?.message || 'Error refreshing Twitter credentials');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to refresh a single account
  const refreshSingleAccount = async (account) => {
    try {
      const response = await fetch(`${apiUrl}/twitter/refresh-credentials?refreshToken=${encodeURIComponent(account.refreshToken)}`);
      const data = await response?.json();
      
      if (response?.ok && data?.success && data?.data?.access_token) {
        // Update the stored tokens for this account
        const newAccessToken = data.data.access_token;
        const newRefreshToken = data.data.refresh_token;
        
        // Update in state
        setConnectedAccounts(prev => prev.map(acc => {
          if (acc.userId === account.userId) {
            return {
              ...acc,
              accessToken: newAccessToken,
              refreshToken: newRefreshToken,
              accessTokenSecret: newRefreshToken
            };
          }
          return acc;
        }));
        
        // Update account tokens state
        setAccountTokens(prev => ({
          ...prev,
          [account.userId]: {
            ...prev[account.userId],
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            accessTokenSecret: newRefreshToken
          }
        }));
        
        // Update localStorage
        localStorage?.setItem(`twitter${account.index}AccessToken`, newAccessToken);
        if (newRefreshToken) {
          localStorage?.setItem(`twitter${account.index}RefreshToken`, newRefreshToken);
          localStorage?.setItem(`twitter${account.index}AccessTokenSecret`, newRefreshToken);
        }
        
        // If this is the current active account, also update legacy format and state
        if (account.userId === userId) {
          localStorage?.setItem('twitter_access_token', newAccessToken);
          if (newRefreshToken) {
            localStorage?.setItem('twitter_refresh_token', newRefreshToken);
            localStorage?.setItem('twitter_access_token_secret', newRefreshToken);
          }
          
          setAccessToken(newAccessToken);
          setRefreshToken(newRefreshToken);
        }
        
        // Update the database
        const firebaseUid = localStorage?.getItem('firebaseUid');
        if (firebaseUid) {
          // Get all updated account data
          const updatedAccounts = connectedAccounts.map(acc => {
            if (acc.userId === account.userId) {
              return {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                userId: acc.userId,
                username: acc.username,
                name: acc.name || acc.username,
                profileImageUrl: acc.profileImageUrl || acc.userInfo?.profile_image_url
              };
            }
            return {
              accessToken: acc.accessToken,
              refreshToken: acc.refreshToken,
              userId: acc.userId,
              username: acc.username,
              name: acc.name || acc.username,
              profileImageUrl: acc.profileImageUrl || acc.userInfo?.profile_image_url
            };
          });
          
          // Save to backend
          try {
            const dbResponse = await fetch(`${API_BASE_URL}/users/${firebaseUid}/social/twitter`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(updatedAccounts)
            });
            
            if (!dbResponse.ok) {
              console.error('Failed to update Twitter tokens in database:', await dbResponse.text());
            } else {
              console.log('Successfully updated Twitter tokens in database');
            }
          } catch (dbError) {
            console.error('Error updating Twitter tokens in database:', dbError);
          }
        }
        
        // Fetch updated user info with new token
        await fetchUserInfo(newAccessToken, account.userId);
        
        return true;
      } else {
        console.error(`Failed to refresh Twitter credentials for account ${account.username} (${account.userId}):`, data);
        
        // If authentication failed completely for this account, consider removing it
        if (response?.status === 401 || (data?.error && data.error.includes('authentication'))) {
          console.log(`Authentication failed for account ${account.username} (${account.userId}), might need to reconnect`);
          // Don't automatically remove, let user decide
        }
        
        return false;
      }
    } catch (error) {
      console.error(`Error refreshing account ${account.username} (${account.userId}):`, error);
      return false;
    }
  };

  // Refresh all Twitter tokens - used by the Refresh Tokens button
  const refreshAllTokens = () => {
    refreshTwitterCredentials();
  };

  // Go to home page
  const goToHome = () => {
    router.push('/');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
      <Head>
        <title>Twitter Integration | Social Lane</title>
        <meta name="description" content="Post videos to Twitter with Social Lane" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="py-8">
        {/* Header with back button */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-blue-400"><TwitterIcon className="w-8 h-8" /></span>
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Twitter Integration
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
          {!isAuthenticated ? (
            <div className="flex flex-col items-center py-12 px-4">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Connect to Twitter</h2>
              <p className="text-gray-600 mb-8 text-center max-w-md">
                Authenticate with Twitter to post videos to your account.
              </p>
              {authError && (
                <div className="w-full max-w-md bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-600">
                  <p>{authError}</p>
                </div>
              )}
              <button 
                onClick={handleConnect} 
                className="px-6 py-3 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-medium flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
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
                    <TwitterIcon className="w-5 h-5" />
                    <span>Connect Twitter Account</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Accounts Management Section */}
              <div className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-4 md:mb-0">Your Twitter Accounts</h2>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={refreshAllTokens} 
                      className="px-4 py-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-70"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Refreshing...</span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Refresh Tokens</span>
                        </>
                      )}
                    </button>
                    
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
                    const profilePic = account.profileImageUrl || account?.userInfo?.profile_image_url || null;
                    // Fix the name/username issue by using account-specific data
                    const name = account?.userInfo?.name || account.name || `Twitter Account ${account.index}`;
                    const accountUsername = account?.userInfo?.username || account.username || `twitter_user_${account.index}`;
                    
                    return (
                      <div 
                        key={account.userId}
                        className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="bg-gradient-to-r from-blue-400 to-sky-500 p-4 flex justify-center">
                          <div className="w-16 h-16 rounded-full bg-white p-1 flex items-center justify-center overflow-hidden">
                            {profilePic ? (
                              <img 
                                src={profilePic} 
                                alt={`${name} profile`}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                                <TwitterIcon className="w-8 h-8" />
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="p-4 text-center">
                          <h3 className="font-bold text-gray-800 mb-1">{name}</h3>
                          <p className="text-gray-500 text-sm">@{accountUsername}</p>
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
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors text-center h-full"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium">Connect another account</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 