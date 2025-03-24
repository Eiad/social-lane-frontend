import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';
import ProtectedRoute from '../src/components/ProtectedRoute';
import styles from '../styles/Twitter.module.css';

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
  const [isLoading, setIsLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadDetails, setUploadDetails] = useState(null);
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
  const [isFetchingUserInfo, setIsFetchingUserInfo] = useState(false);
  const [selectedUsername, setSelectedUsername] = useState('Twitter Account');
  const [selectedProfileImage, setSelectedProfileImage] = useState('');
  const [authSuccess, setAuthSuccess] = useState(false);
  const [caption, setCaption] = useState('');
  const [postError, setPostError] = useState(null);
  const [debugInfo, setDebugInfo] = useState('Loading debug info...');
  const [altUserId, setAltUserId] = useState('');
  const [isDisconnecting, setIsDisconnecting] = useState(false);

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

  // Get Twitter accounts from socialMediaData
  const getTwitterAccounts = () => {
    try {
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (!socialMediaDataStr) {
        return [];
      }
      
      const socialMediaData = JSON.parse(socialMediaDataStr);
      if (!socialMediaData?.twitter || !Array.isArray(socialMediaData.twitter)) {
        return [];
      }
      
      return socialMediaData.twitter.filter(account => 
        account && account.accessToken && account.accessTokenSecret
      );
    } catch (error) {
      console.error('Error getting Twitter accounts from socialMediaData:', error);
        return [];
      }
  };

  // Save Twitter accounts to socialMediaData
  const saveTwitterAccounts = (accounts) => {
    try {
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      let socialMediaData = {};
      
      if (socialMediaDataStr) {
        socialMediaData = JSON.parse(socialMediaDataStr);
      }
      
      socialMediaData.twitter = accounts;
          localStorage.setItem('socialMediaData', JSON.stringify(socialMediaData));
      localStorage.setItem('socialMediaDataUpdated', Date.now().toString());
      
      console.log('Saved Twitter accounts to socialMediaData:', accounts);
    } catch (error) {
      console.error('Error saving Twitter accounts to socialMediaData:', error);
    }
  };

  // Save Twitter accounts to the database
  const saveTwitterAccountsToDatabase = async (firebaseUid, accounts) => {
    try {
      // Ensure we have a valid Firebase UID
      if (!firebaseUid) {
        firebaseUid = localStorage?.getItem('firebaseUid');
        if (!firebaseUid) {
          console.error('No Firebase UID provided or found in localStorage, cannot save to database');
          window.showToast?.error?.('Cannot save Twitter accounts: Missing user ID');
        return;
      }
      }
      
      console.log('Saving Twitter accounts to database for user:', firebaseUid);
      
      // Prepare account data
      const accountsData = accounts.map(account => ({
          accessToken: account.accessToken,
        accessTokenSecret: account.accessTokenSecret,
          userId: account.userId,
          username: account.username,
          name: account.name || account.username,
        profileImageUrl: account.profileImageUrl
      }));
      
      // Send to API
      const response = await fetch(`${API_BASE_URL}/users/${firebaseUid}/social/twitter`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accounts: accountsData
          })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save Twitter accounts to database');
      }
      
      console.log('Successfully saved Twitter accounts to database');
    } catch (error) {
      console.error('Error saving Twitter accounts to database:', error);
    }
  };

  // Handle Twitter authentication
  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      
      // Get the auth URL from the backend
      console.log('Requesting Twitter auth URL from:', `${apiUrl}/twitter/auth`);
      
      const response = await fetch(`${apiUrl}/twitter/auth`)
        .catch(error => {
          console.error('Network error requesting auth URL:', error);
          throw new Error('Network error. Please check your connection and try again.');
        });
      
      if (!response?.ok) {
        console.error('Failed to get auth URL, status:', response?.status);
        const errorText = await response?.text?.() || 'Unknown error';
        throw new Error(`Failed to connect to Twitter (${response?.status || 'unknown status'}): ${errorText}`);
      }
      
      const data = await response?.json?.()
        .catch(error => {
          console.error('Error parsing auth URL response:', error);
          throw new Error('Invalid response from server. Please try again later.');
        });
      
      if (data?.authUrl) {
        console.log('Redirecting to Twitter auth URL...');
        
        // Save current timestamp for validation after redirect
        localStorage.setItem('twitterAuthTimestamp', Date.now().toString());
        
        // Redirect to the Twitter auth URL
        window.location.href = data.authUrl;
      } else {
        console.error('Failed to get auth URL:', data);
        throw new Error(data?.error || 'Failed to connect to Twitter. Please try again.');
      }
    } catch (error) {
      console.error('Error connecting to Twitter:', error?.message);
      setAuthError(error?.message || 'Network error. Please check your connection and try again.');
      setIsLoading(false);
      window.showToast?.error?.(error?.message || 'Error connecting to Twitter');
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
  const handlePost = async () => {
      setIsPosting(true);
    setPostError(null);
    setPostSuccess(false);

    try {
      if (!videoUrl) {
        throw new Error('No video selected');
      }
      
      // Get the Twitter account from socialMediaData
      const twitterAccounts = getTwitterAccounts();
      
      if (twitterAccounts.length === 0) {
        throw new Error('No Twitter account connected. Please connect your Twitter account first.');
      }
      
      const selectedAccount = twitterAccounts[0]; // Use the first account
      
      console.log('Selected account details:', {
        hasAccount: !!selectedAccount,
        hasAccessToken: !!selectedAccount?.accessToken,
        hasAccessTokenSecret: !!selectedAccount?.accessTokenSecret,
        username: selectedAccount?.username
      });
      
      if (!selectedAccount?.accessToken || !selectedAccount?.accessTokenSecret) {
        throw new Error('Twitter account not connected properly. Please reconnect your account.');
      }
      
      const payload = {
          videoUrl,
          text: caption || '',
          accessToken: selectedAccount.accessToken,
          accessTokenSecret: selectedAccount.accessTokenSecret,
        userId: selectedAccount.userId || null
      };
      
      console.log('Posting to Twitter with payload:', {
        hasAccessToken: !!payload.accessToken,
        hasAccessTokenSecret: !!payload.accessTokenSecret,
        videoUrl: !!payload.videoUrl,
        hasText: !!payload.text
      });
      
      const response = await axios.post(`${apiUrl}/twitter/post-video`, payload);
      
      if (response?.data?.message) {
      setPostSuccess(true);
        setCaption('');
        setVideoUrl('');
        setFile(null);
        setUploadedFile(null);
      } else {
        throw new Error('Failed to post to Twitter');
      }
    } catch (error) {
      console.error('Error posting to Twitter:', error);
      setPostError(`Failed to post to Twitter: ${error.message || error?.response?.data?.error || 'Unknown error'}`);
    } finally {
      setIsPosting(false);
    }
  };

  // Disconnect all Twitter accounts
  const disconnectTwitter = async () => {
    try {
      setIsDisconnecting(true); // Set loading state
      
      // Get Twitter accounts from socialMediaData before clearing
      const twitterAccounts = getTwitterAccounts();
      
      if (twitterAccounts.length === 0) {
        console.warn('No Twitter accounts to disconnect');
        window.showToast?.warning?.('No Twitter accounts to disconnect');
        return;
      }
      
      console.log(`Disconnecting all ${twitterAccounts.length} Twitter accounts`);
      
      // Remove all Twitter accounts from socialMediaData
      saveTwitterAccounts([]);
      console.log('Removed all Twitter accounts from socialMediaData');
      
      // Remove Twitter accounts from database
      const firebaseUid = localStorage?.getItem('firebaseUid');
      if (firebaseUid && twitterAccounts.length > 0) {
        // For each Twitter account, call the API to remove it
        const removalPromises = twitterAccounts.map(async (account) => {
          if (!account?.userId) return { success: false, error: 'No userId in account' };
          
          try {
            console.log(`Removing Twitter account ${account.userId} from database for user ${firebaseUid}`);
            
            // Try both endpoint formats in parallel for best chance of success
            const results = await Promise.allSettled([
              // Primary endpoint (path parameter style)
              fetch(`${API_BASE_URL}/users/${firebaseUid}/social/twitter/${account.userId}`, {
                method: 'DELETE',
              }),
              
              // Fallback endpoint (query parameter style)
              fetch(`${API_BASE_URL}/users/${firebaseUid}/social/twitter?userId=${account.userId}`, {
                method: 'DELETE',
              })
            ]);
            
            // Check results - we only need one to succeed
            const successfulResult = results.find(r => r.status === 'fulfilled' && r.value.ok);
            
            if (successfulResult) {
              console.log(`Successfully removed Twitter account ${account.userId} from database`);
              return { success: true };
            } else {
              // Both failed, collect error info
              const errors = results
                .filter(r => r.status === 'rejected' || !r.value.ok)
                .map(r => {
                  if (r.status === 'rejected') return r.reason?.message || 'Request failed';
                  return `API error (${r.value.status})`;
                });
              
              console.error(`All removal attempts failed for account ${account.userId}:`, errors);
              return { success: false, error: errors.join(', ') };
            }
          } catch (error) {
            console.error(`Error removing Twitter account ${account.userId} from database:`, error);
            return { success: false, error: error.message };
          }
        });
        
        // Wait for all removal attempts to complete
        const results = await Promise.all(removalPromises);
        
        // Check overall success
        const allSucceeded = results.every(r => r.success);
        if (!allSucceeded) {
          const failures = results.filter(r => !r.success);
          console.warn(`${failures.length} Twitter account removal(s) failed:`, failures);
          
          // Try to force update as a last resort
          try {
            console.log('Trying force update to clear Twitter accounts');
            await fetch(`${API_BASE_URL}/users/${firebaseUid}/force-update`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                providerData: {
                  twitter: []
                }
              })
            });
            console.log('Force update successful');
          } catch (forceUpdateError) {
            console.error('Error with force update:', forceUpdateError);
          }
        }
      } else {
        console.log('No Firebase UID or Twitter accounts to remove from database');
      }
      
      // Reset UI states
      setAuthSuccess(false);
      setVideoUrl('');
      setFile(null);
      setCaption('');
      setPostSuccess(false);
      setPostError(null);
      setIsPosting(false);
      setSelectedUsername('Twitter Account');
      setSelectedProfileImage('');
      
      // Refresh debug info
      await refreshDebugInfo();
      
      window.showToast?.success?.('All Twitter accounts disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting Twitter accounts:', error);
      window.showToast?.error?.('Error disconnecting Twitter accounts: ' + error.message);
    } finally {
      setIsDisconnecting(false); // Reset loading state
    }
  };

  // Load Twitter accounts from database
  const loadTwitterAccountsFromDB = async () => {
    try {
      if (typeof window === 'undefined') return;
      
      console.log('Attempting to load Twitter accounts from DB');
      // Always prioritize Firebase UID
      const firebaseUid = localStorage?.getItem('firebaseUid');
        
      if (!firebaseUid) {
        console.warn('No Firebase UID found in localStorage, cannot load Twitter accounts');
        window.showToast?.warning?.('Not logged in with Firebase. Please log in to load your Twitter accounts.');
        return;
      }
      
      console.log('Fetching user data for Firebase UID:', firebaseUid);
      setIsFetchingUserInfo(true);
      
      // Try to fetch user data with retries for maximum reliability
      let userData = null;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts && !userData) {
        try {
          attempts++;
          console.log(`Fetching user data attempt ${attempts}/${maxAttempts}`);
          
          // API endpoint to get user data
          const response = await fetch(`${apiUrl}/users/${firebaseUid}`);
      
      if (!response.ok) {
        const errorText = await response.text();
            throw new Error(`Failed to fetch user data (status: ${response.status}, message: ${errorText})`);
      }
      
      const data = await response.json();
          console.log(`User data fetch attempt ${attempts} successful:`, data?.success ? 'Success' : 'Failed');
          
          if (data?.success && data?.data) {
            userData = data;
            console.log('Successfully loaded user data');
          } else {
            throw new Error('Invalid user data format received');
          }
        } catch (attemptError) {
          console.error(`Error fetching user data attempt ${attempts}:`, attemptError);
          
          if (attempts < maxAttempts) {
            // Exponential backoff
            const delay = Math.pow(2, attempts) * 500;
            console.log(`Retrying after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw attemptError; // Re-throw the last error after all attempts
          }
        }
      }
      
      if (!userData) {
        throw new Error('Failed to fetch user data after multiple attempts');
      }
      
      console.log('Received user data from API:', userData);
      
      // Process the user data and store Twitter accounts
      if (userData?.data) {
        const twitterData = userData.data.providerData && userData.data.providerData.twitter;
        
        if (twitterData) {
          console.log('Found Twitter data in user data:', twitterData);
          
          // Initialize socialMediaData structure
        let socialMediaData = {};
        try {
            const existingData = localStorage.getItem('socialMediaData');
          if (existingData) {
            socialMediaData = JSON.parse(existingData);
          }
          } catch (error) {
            console.error('Error parsing existing socialMediaData:', error);
          }
          
          // Process Twitter accounts
          const twitterAccounts = Array.isArray(twitterData) ? twitterData : [twitterData];
          
          console.log(`Processing ${twitterAccounts.length} Twitter accounts from database`);
          
          // Map accounts to standardized format
          const formattedAccounts = twitterAccounts
            .filter(account => account)
            .map(account => ({
              accessToken: account.accessToken || account.access_token,
              accessTokenSecret: account.accessTokenSecret || account.access_token_secret,
              userId: account.userId || account.user_id,
              username: account.username || account.screen_name || '',
              name: account.name || account.displayName || account.username || 'Twitter User',
              profileImageUrl: account.profileImageUrl || account.profile_image_url || ''
            }))
            .filter(account => account.accessToken && account.accessTokenSecret);
          
          console.log('Formatted Twitter accounts:', formattedAccounts.map(acc => ({
            userId: acc.userId,
            username: acc.username,
            name: acc.name,
            hasProfileImage: !!acc.profileImageUrl
          })));
          
          if (formattedAccounts.length > 0) {
            // Store in socialMediaData structure
            socialMediaData.twitter = formattedAccounts;
            localStorage.setItem('socialMediaData', JSON.stringify(socialMediaData));
            localStorage.setItem('socialMediaDataUpdated', Date.now().toString());
            
            console.log('Stored Twitter accounts in socialMediaData:', formattedAccounts);
            window.showToast?.success?.(`${formattedAccounts.length} Twitter account(s) loaded successfully`);
            
            // Update UI state
            setAuthSuccess(true);
            setSelectedUsername(formattedAccounts[0].username || 'Twitter Account');
            setSelectedProfileImage(formattedAccounts[0].profileImageUrl || '');
            
            // Refresh debug info
            refreshDebugInfo();
            return formattedAccounts;
          } else {
            console.warn('No valid Twitter accounts found in user data');
            window.showToast?.warning?.('No valid Twitter accounts found in your profile');
          }
        } else {
          console.log('No Twitter data found in user data');
          window.showToast?.info?.('No Twitter accounts found in your profile');
        }
      } else {
        console.warn('Invalid user data format received');
        window.showToast?.warning?.('Could not retrieve your account information');
      }
      return null;
    } catch (error) {
      console.error('Error loading Twitter accounts from DB:', error);
      window.showToast?.error?.('Failed to load Twitter accounts: ' + error.message);
      return null;
    } finally {
      setIsFetchingUserInfo(false);
    }
  };

  // Handle the Twitter callback after authentication
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if user is authenticated
    const firebaseUid = localStorage?.getItem('firebaseUid');
    if (!firebaseUid) {
      console.warn('No Firebase UID found in localStorage for Twitter callback processing');
      return;
    }

    // Process URL parameters for Twitter authentication
    const params = new URLSearchParams(window.location.search);
    
    // Check if we have any relevant parameters that indicate a Twitter callback
    const hasCallbackParams = params.has('accessToken') || params.has('access_token') || 
                             params.has('error') || params.has('denied');
    
    if (!hasCallbackParams) {
      // Not a Twitter callback, skip processing
      return;
    }
    
    console.log('Twitter callback detected, processing parameters...');
    
    // Handle both formats - camelCase and snake_case
    const accessToken = params.get('accessToken') || params.get('access_token');
    const accessTokenSecret = params.get('accessTokenSecret') || params.get('access_token_secret');
    const userId = params.get('userId') || params.get('user_id');
    const username = params.get('username') || params.get('screen_name');
    const name = params.get('name');
    const profileImageUrl = params.get('profileImageUrl') || params.get('profile_image_url');
    const error = params.get('error');
    const denied = params.get('denied');

    // Clear the query parameters after processing 
    if (window.history && window.history.replaceState) {
      console.log('Clearing URL parameters after processing');
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // Handle authentication denial
    if (denied) {
      console.error('Twitter authentication denied by user');
      window.showToast?.error?.('Twitter authentication was denied');
      setAuthError('Authentication was denied. Please try again.');
      return;
    }

    // Handle authentication errors
    if (error) {
      console.error('Twitter authentication error:', error);
      window.showToast?.error?.(`Twitter authentication failed: ${error}`);
      setAuthError(`Authentication failed: ${error}`);
      return;
    }

    // Validate required tokens
    if (!accessToken || !accessTokenSecret || !userId) {
      console.error('Missing required Twitter credentials:', {
        hasAccessToken: !!accessToken,
        hasAccessTokenSecret: !!accessTokenSecret,
        hasUserId: !!userId
      });
      
      window.showToast?.error?.('Incomplete Twitter authentication data received');
      setAuthError('Authentication failed: Incomplete data received from Twitter');
      return;
    }

    // Log the received data (safely)
    console.log('Twitter credentials received:', {
      accessToken: accessToken ? `${accessToken.substring(0, 5)}...` : 'missing',
      accessTokenSecret: accessTokenSecret ? `${accessTokenSecret.substring(0, 5)}...` : 'missing',
      userId,
      username,
      name,
      hasProfileImage: !!profileImageUrl,
      tokenLength: accessToken?.length || 0,
      secretLength: accessTokenSecret?.length || 0
    });

    // Create account data object with all required fields and defaults
    const accountData = {
      accessToken,
      accessTokenSecret,
      userId,
      username: username || '',
      name: name || username || 'Twitter User',
      profileImageUrl: profileImageUrl || ''
    };

    // Store in localStorage first
    console.log('Storing Twitter account data in localStorage...');
    (async () => {
      try {
        const saved = await storeTwitterAccount(accountData);
        
        if (saved) {
          console.log('Twitter account stored in localStorage successfully');
          window.showToast?.success?.('Twitter account connected successfully');
          
          // Update UI state immediately
          setAuthSuccess(true);
          setSelectedUsername(username || 'Twitter Account');
          setSelectedProfileImage(profileImageUrl || '');
          
          // Verify the account was saved correctly
          await refreshDebugInfo();
        } else {
          console.error('Failed to store Twitter account in localStorage');
          window.showToast?.error?.('Failed to store Twitter account information');
        }
      } catch (error) {
        console.error('Error in Twitter callback processing:', error);
        window.showToast?.error?.('Error processing Twitter login: ' + error.message);
      }
    })();
  }, []);

  // Function to store Twitter account in localStorage and database
  const storeTwitterAccount = async (accountData) => {
    try {
      // Validate required fields
      if (!accountData?.accessToken || !accountData?.accessTokenSecret || !accountData?.userId) {
        console.error('Missing required Twitter account fields:', {
          hasAccessToken: !!accountData?.accessToken,
          hasAccessTokenSecret: !!accountData?.accessTokenSecret,
          hasUserId: !!accountData?.userId
        });
        window.showToast?.error?.('Cannot connect Twitter account: Missing required data');
        return false;
      }

      // Normalize the account data
      const normalizedAccount = {
        accessToken: accountData?.accessToken || accountData?.access_token,
        accessTokenSecret: accountData?.accessTokenSecret || accountData?.access_token_secret,
        userId: accountData?.userId || accountData?.user_id,
        username: accountData?.username || accountData?.screen_name || '',
        name: accountData?.name || accountData?.display_name || accountData?.username || '',
        profileImageUrl: accountData?.profileImageUrl || accountData?.profile_image_url || ''
      };

      // Log what we're storing (don't log full tokens)
      console.log('Storing Twitter account:', {
        accessToken: normalizedAccount.accessToken ? `${normalizedAccount.accessToken.substring(0, 5)}...` : 'MISSING',
        accessTokenLength: normalizedAccount.accessToken?.length || 0,
        accessTokenSecret: normalizedAccount.accessTokenSecret ? `${normalizedAccount.accessTokenSecret.substring(0, 5)}...` : 'MISSING',
        accessTokenSecretLength: normalizedAccount.accessTokenSecret?.length || 0,
        userId: normalizedAccount.userId,
        username: normalizedAccount.username
      });

      // Get existing Twitter accounts from socialMediaData
      const existingAccounts = getTwitterAccounts();
      
      // Check if account already exists by userId
      const existingIndex = existingAccounts.findIndex(
        acc => acc?.userId === normalizedAccount.userId
      );
      
      // Update or add the account
      if (existingIndex >= 0) {
        // Update existing account
        existingAccounts[existingIndex] = normalizedAccount;
        console.log(`Updated existing Twitter account for ${normalizedAccount.username || normalizedAccount.userId}`);
      } else {
        // Add new account
        existingAccounts.push(normalizedAccount);
        console.log(`Added new Twitter account for ${normalizedAccount.username || normalizedAccount.userId}`);
      }
      
      // Save to socialMediaData
      saveTwitterAccounts(existingAccounts);
      
      // Save to database
      console.log('Saving Twitter account to database...');
      const saveSuccess = await saveTwitterAccountToDB(normalizedAccount);
      
      if (saveSuccess) {
        console.log('Twitter account saved successfully to database');
        window.showToast?.success?.('Twitter account connected successfully!');
        
        // Update UI with new account
        if (normalizedAccount.username) {
          setSelectedUsername(normalizedAccount.username);
        }
        if (normalizedAccount.profileImageUrl) {
          setSelectedProfileImage(normalizedAccount.profileImageUrl);
        }
        setAuthSuccess(true);
        
        return true;
      } else {
        console.error('Failed to save Twitter account to database');
        window.showToast?.error?.('Failed to save Twitter account to database');
        return false;
      }
    } catch (error) {
      console.error('Error storing Twitter account:', error);
      window.showToast?.error?.(`Error connecting Twitter account: ${error?.message}`);
      return false;
    }
  };

  // Direct database update function for forcing Twitter account updates
  const forceUpdateUserData = async () => {
    try {
      // Get the Twitter accounts from localStorage
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (!socialMediaDataStr) {
        window.showToast?.warning?.('No socialMediaData found in localStorage');
        return;
      }
      
      const socialMediaData = JSON.parse(socialMediaDataStr);
      if (!socialMediaData?.twitter || !Array.isArray(socialMediaData.twitter) || socialMediaData.twitter.length === 0) {
        window.showToast?.warning?.('No Twitter accounts found in localStorage');
        return;
      }
      
      // Get the Firebase UID
      const firebaseUid = localStorage?.getItem('firebaseUid');
      if (!firebaseUid) {
        window.showToast?.error?.('Firebase UID not found in localStorage');
        return;
      }
      
      // Prepare direct update payload
      const payload = {
        providerData: {
          twitter: socialMediaData.twitter
        }
      };
      
      console.log('Force updating user data with payload:', payload);
      window.showToast?.info?.('Attempting force update...');
      
      // Use the force-update endpoint
      const response = await fetch(`${API_BASE_URL}/users/${firebaseUid}/force-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
      
              const data = await response.json();
      console.log('Force update response:', data);
      
      if (data.success) {
        window.showToast?.success?.('User data force updated successfully');
        
        // Verify the update
        if (data.data?.providerData?.twitter && data.data.providerData.twitter.length > 0) {
          console.log('Twitter accounts verified in response:', data.data.providerData.twitter);
        } else {
          console.warn('No Twitter accounts found in response after update');
          window.showToast?.warning?.('Update succeeded but Twitter accounts not found in response');
        }
      } else {
        throw new Error('Update failed: ' + (data.error || 'Unknown error'));
      }
      
      // Refresh debug info
      await refreshDebugInfo();
    } catch (error) {
      console.error('Error in force update:', error);
      window.showToast?.error?.('Force update failed: ' + error.message);
    }
  };
  
  // Render debug section
  const renderDebugSection = () => {
    return (
      <div className="bg-gray-900 p-4 mt-6 rounded-lg text-xs">
        <h3 className="text-white text-sm font-bold mb-2">Debug & Troubleshooting</h3>
        <div className="flex space-x-2 mb-3">
          <button
            className="bg-gray-700 text-white px-3 py-1 rounded text-xs"
            onClick={refreshDebugInfo}
          >
            Refresh Debug Info
          </button>
          <button
            className="bg-yellow-600 text-white px-3 py-1 rounded text-xs"
            onClick={testSaveTwitterAccountToDB}
          >
            Test Save Twitter Account
          </button>
          <button
            className="bg-purple-600 text-white px-3 py-1 rounded text-xs"
            onClick={forceUpdateUserData}
          >
            Force Update Twitter Accounts
          </button>
        </div>
        
        <div className="bg-gray-800 p-3 rounded overflow-auto max-h-64">
          <pre className="text-gray-300 whitespace-pre-wrap">{debugInfo}</pre>
        </div>
        
        <div className="mt-4">
          <h4 className="text-white text-xs font-bold mb-2">Import Twitter Accounts from Alternate User ID</h4>
          <div className="flex space-x-2">
            <input
              type="text"
              value={altUserId}
              onChange={(e) => setAltUserId(e.target.value)}
              placeholder="Enter User ID"
              className="bg-gray-800 text-white px-3 py-1 rounded text-xs flex-1"
            />
            <button
              className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
              onClick={importTwitterAccounts}
              disabled={isFetchingUserInfo}
            >
              {isFetchingUserInfo ? 'Importing...' : 'Import Twitter Accounts'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Function to directly save a Twitter account to the database
  const saveTwitterAccountToDB = async (accountData) => {
    try {
      // Get Firebase UID for the API call
      const firebaseUid = localStorage?.getItem('firebaseUid');
      if (!firebaseUid) {
        console.error('No Firebase UID found in localStorage, cannot save Twitter account');
        window.showToast?.error?.('Authentication error. Please log in again.');
        return false;
      }

      // Normalize the account data to handle both camelCase and snake_case formats
      const normalizedAccount = {
        accessToken: accountData?.accessToken || accountData?.access_token,
        accessTokenSecret: accountData?.accessTokenSecret || accountData?.access_token_secret,
        userId: accountData?.userId || accountData?.user_id,
        username: accountData?.username || accountData?.screen_name || '',
        name: accountData?.name || accountData?.display_name || accountData?.username || '',
        profileImageUrl: accountData?.profileImageUrl || accountData?.profile_image_url || ''
      };

      // Log what we're sending (without exposing full tokens)
      console.log('Saving Twitter account to database:', {
        accessToken: normalizedAccount.accessToken ? `${normalizedAccount.accessToken.substring(0, 5)}...` : 'MISSING',
        accessTokenLength: normalizedAccount.accessToken?.length || 0,
        accessTokenSecret: normalizedAccount.accessTokenSecret ? `${normalizedAccount.accessTokenSecret.substring(0, 5)}...` : 'MISSING',
        accessTokenSecretLength: normalizedAccount.accessTokenSecret?.length || 0,
        userId: normalizedAccount.userId,
        username: normalizedAccount.username
      });

      // Validate required fields
      if (!normalizedAccount.accessToken || !normalizedAccount.accessTokenSecret || !normalizedAccount.userId) {
        console.error('Missing required Twitter account fields:', {
          hasAccessToken: !!normalizedAccount.accessToken,
          hasAccessTokenSecret: !!normalizedAccount.accessTokenSecret,
          hasUserId: !!normalizedAccount.userId
        });
        window.showToast?.error?.('Invalid Twitter account data');
        return false;
      }

      // API endpoint for storing Twitter accounts
      const apiUrl = `${API_BASE_URL}/users/${firebaseUid}/social/twitter`;
      
      // Try multiple formats for maximum compatibility with the backend
      
      // 1. Try direct array format first (standard method)
      console.log('Attempting to save with array format payload...');
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([normalizedAccount])
        });
        
        if (!response?.ok) {
          console.warn(`Save with array format failed with status: ${response?.status}`);
          const errorText = await response?.text?.();
          console.warn('Error response:', errorText);
          // Continue to next method
        } else {
          const responseData = await response?.json?.();
          console.log('Save response (array format):', responseData);
          
          if (responseData?.success) {
            console.log('Twitter account saved successfully with array format');
            return true;
          }
        }
      } catch (error) {
        console.warn('Error saving with array format:', error?.message);
        // Continue to next method
      }
      
      // 2. Try wrapped format as fallback
      console.log('Trying alternative payload format with accounts wrapper...');
      try {
        const altResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ accounts: [normalizedAccount] })
        });
        
        if (!altResponse?.ok) {
          console.warn(`Save with wrapped format failed with status: ${altResponse?.status}`);
          const errorText = await altResponse?.text?.();
          console.warn('Error response:', errorText);
          // Continue to next method
        } else {
          const altResponseData = await altResponse?.json?.();
          console.log('Save response (wrapped format):', altResponseData);
          
          if (altResponseData?.success) {
            console.log('Twitter account saved successfully with wrapped format');
            return true;
          }
        }
      } catch (error) {
        console.warn('Error saving with wrapped format:', error?.message);
        // Continue to next method
      }

      // 3. Try direct single account format
      console.log('Trying direct single account format...');
      try {
        const singleResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(normalizedAccount)
        });
        
        if (!singleResponse?.ok) {
          console.warn(`Save with direct format failed with status: ${singleResponse?.status}`);
          const errorText = await singleResponse?.text?.();
          console.warn('Error response:', errorText);
          // Continue to next method
        } else {
          const singleResponseData = await singleResponse?.json?.();
          console.log('Save response (direct format):', singleResponseData);
          
          if (singleResponseData?.success) {
            console.log('Twitter account saved successfully with direct format');
            return true;
          }
        }
      } catch (error) {
        console.warn('Error saving with direct format:', error?.message);
        // Continue to final method
      }
      
      // 4. Last resort - try force update endpoint
      console.log('Trying force-update endpoint as last resort...');
      try {
        const forceUpdateResponse = await fetch(`${API_BASE_URL}/users/${firebaseUid}/force-update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            providerData: {
              twitter: [normalizedAccount]
            }
          })
        });
        
        if (!forceUpdateResponse?.ok) {
          console.warn(`Force update failed with status: ${forceUpdateResponse?.status}`);
          const errorText = await forceUpdateResponse?.text?.();
          console.warn('Error response:', errorText);
          // All methods failed
        } else {
          const forceUpdateData = await forceUpdateResponse?.json?.();
          console.log('Force update response:', forceUpdateData);
          
          if (forceUpdateData?.success) {
            console.log('Twitter account saved successfully via force update');
            return true;
          }
        }
      } catch (error) {
        console.error('Error with force update:', error?.message);
        // All methods failed
      }
      
      console.error('All save attempts failed');
      window.showToast?.error?.('Failed to save Twitter account after multiple attempts');
      return false;
    } catch (error) {
      console.error('Error in saveTwitterAccountToDB:', error);
      window.showToast?.error?.(`Failed to save Twitter account: ${error?.message}`);
      return false;
    }
  };

  // Function to test saving Twitter account to DB
  const testSaveTwitterAccountToDB = async () => {
    try {
      // Get the Twitter accounts from localStorage
      const twitterAccounts = getTwitterAccounts();
      
      if (twitterAccounts.length === 0) {
        window.showToast?.warning?.('No Twitter accounts found in localStorage');
        return;
      }
      
      console.log('Testing save of account:', {
        userId: twitterAccounts[0].userId,
        username: twitterAccounts[0].username,
        hasAccessToken: !!twitterAccounts[0].accessToken,
        hasAccessTokenSecret: !!twitterAccounts[0].accessTokenSecret
      });
      
      window.showToast?.info?.('Attempting to save Twitter account to database...');
      
      // Call the save function
      const result = await saveTwitterAccountToDB(twitterAccounts[0]);
      
      if (result) {
        window.showToast?.success?.('Test save successful!');
        await refreshDebugInfo();
      } else {
        window.showToast?.error?.('Test save failed!');
      }
    } catch (error) {
      console.error('Error in test save:', error);
      window.showToast?.error?.('Test save error: ' + error.message);
    }
  };

  // Refresh debug info
  const refreshDebugInfo = async () => {
    try {
      let debug = '';
      
      // Add Firebase UID
      const firebaseUid = localStorage?.getItem('firebaseUid');
      debug += `Firebase UID: ${firebaseUid || 'Not found'}\n\n`;
      
      // Add socialMediaData Twitter accounts
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (socialMediaDataStr) {
        try {
          const socialMediaData = JSON.parse(socialMediaDataStr);
          
          // Twitter accounts
          if (socialMediaData.twitter && Array.isArray(socialMediaData.twitter)) {
            debug += `Twitter Accounts (${socialMediaData.twitter.length}):\n`;
            
            socialMediaData.twitter.forEach((account, index) => {
              debug += `\nAccount #${index + 1}:\n`;
              debug += `- userId: ${account.userId || 'Missing'}\n`;
              debug += `- username: ${account.username || 'Missing'}\n`;
              debug += `- name: ${account.name || 'Missing'}\n`;
              debug += `- accessToken: ${account.accessToken ? `${account.accessToken.substring(0, 5)}... (${account.accessToken.length} chars)` : 'Missing'}\n`;
              debug += `- accessTokenSecret: ${account.accessTokenSecret ? `${account.accessTokenSecret.substring(0, 5)}... (${account.accessTokenSecret.length} chars)` : 'Missing'}\n`;
              debug += `- profileImageUrl: ${account.profileImageUrl ? 'Present' : 'Missing'}\n`;
            });
          } else {
            debug += 'No Twitter accounts found in socialMediaData\n';
          }
        } catch (error) {
          debug += `Error parsing socialMediaData: ${error.message}\n`;
        }
      } else {
        debug += 'socialMediaData not found in localStorage\n';
      }
      
      // Get user data from API if logged in
      if (firebaseUid) {
        try {
          debug += '\n--- Database Information ---\n';
          
          const response = await fetch(`${apiUrl}/users/${firebaseUid}`);
          
          if (response.ok) {
            const userData = await response.json();
            
            if (userData.success && userData.data) {
              // Check Twitter accounts
              const twitterData = userData.data.providerData?.twitter;
              
              if (twitterData) {
                const accounts = Array.isArray(twitterData) ? twitterData : [twitterData];
                
                debug += `\nTwitter Accounts in DB (${accounts.length}):\n`;
                
                accounts.forEach((account, index) => {
                  debug += `\nDB Account #${index + 1}:\n`;
                  debug += `- userId: ${account.userId || account.user_id || 'Missing'}\n`;
                  debug += `- username: ${account.username || account.screen_name || 'Missing'}\n`;
                  debug += `- name: ${account.name || account.display_name || 'Missing'}\n`;
                  debug += `- accessToken: ${account.accessToken || account.access_token ? 
                    `Present (${(account.accessToken || account.access_token).length} chars)` : 'Missing'}\n`;
                  debug += `- accessTokenSecret: ${account.accessTokenSecret || account.access_token_secret ? 
                    `Present (${(account.accessTokenSecret || account.access_token_secret).length} chars)` : 'Missing'}\n`;
                });
              } else {
                debug += 'No Twitter accounts found in database\n';
              }
            } else {
              debug += `Invalid user data format received: ${JSON.stringify(userData)}\n`;
            }
          } else {
            debug += `Failed to fetch user data from API: ${response.status} ${response.statusText}\n`;
          }
        } catch (error) {
          debug += `Error fetching user data from API: ${error.message}\n`;
        }
      }
      
      setDebugInfo(debug);
    } catch (error) {
      console.error('Error refreshing debug info:', error);
      setDebugInfo(`Error refreshing debug info: ${error.message}`);
    }
  };

  // Import Twitter accounts from alternate user ID
  const importTwitterAccounts = async () => {
    try {
      if (!altUserId || altUserId.trim() === '') {
        window.showToast?.warning?.('Please enter a valid User ID');
        return;
      }
      
      setIsFetchingUserInfo(true);
      window.showToast?.info?.(`Importing Twitter accounts from user ${altUserId}...`);
      
      // Fetch user data from the provided user ID
      const response = await fetch(`${apiUrl}/users/${altUserId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user data for ${altUserId} (${response.status})`);
      }
      
      const userData = await response.json();
      
      if (!userData.success || !userData.data) {
        throw new Error('Invalid user data received');
      }
      
      // Check for Twitter accounts
      const twitterData = userData.data.providerData?.twitter;
      
      if (!twitterData) {
        throw new Error('No Twitter accounts found for this user ID');
      }
      
      // Process Twitter accounts
      const twitterAccounts = Array.isArray(twitterData) ? twitterData : [twitterData];
      
      if (twitterAccounts.length === 0) {
        throw new Error('No Twitter accounts found for this user ID');
      }
      
      console.log(`Found ${twitterAccounts.length} Twitter accounts to import`);
      
      // Format the accounts
      const formattedAccounts = twitterAccounts.map(account => ({
        accessToken: account.accessToken || account.access_token,
        accessTokenSecret: account.accessTokenSecret || account.access_token_secret,
        userId: account.userId || account.user_id,
        username: account.username || account.screen_name || '',
        name: account.name || account.display_name || account.username || 'Twitter User',
        profileImageUrl: account.profileImageUrl || account.profile_image_url || ''
      })).filter(account => account.accessToken && account.accessTokenSecret && account.userId);
      
      if (formattedAccounts.length === 0) {
        throw new Error('No valid Twitter accounts found');
      }
      
      // Get existing accounts from socialMediaData
      const existingAccounts = getTwitterAccounts();
      
      // Add imported accounts, checking for duplicates
      let added = 0;
      let updated = 0;
      const updatedAccounts = [...existingAccounts];
      
      for (const account of formattedAccounts) {
        const existingIndex = updatedAccounts.findIndex(
          a => a && a.userId === account.userId
        );
        
        if (existingIndex >= 0) {
          // Update existing account
          updatedAccounts[existingIndex] = account;
          updated++;
          console.log(`Updated existing account for ${account.username}`);
        } else {
          // Add new account
          updatedAccounts.push(account);
          added++;
          console.log(`Added new account for ${account.username}`);
        }
      }
      
      // Save to socialMediaData
      saveTwitterAccounts(updatedAccounts);
      
      window.showToast?.success?.(`Imported ${formattedAccounts.length} Twitter accounts (${added} new, ${updated} updated)`);
      
      // Update UI if accounts were imported
      if (updatedAccounts.length > 0) {
        setAuthSuccess(true);
        setSelectedUsername(updatedAccounts[0].username || 'Twitter Account');
        setSelectedProfileImage(updatedAccounts[0].profileImageUrl || '');
      }
      
      // Now save to database if we have any accounts
      if (updatedAccounts.length > 0) {
        try {
          // Get Firebase UID
          const firebaseUid = localStorage?.getItem('firebaseUid');
          if (!firebaseUid) {
            throw new Error('Firebase UID not found. Cannot save to database.');
          }
          
          // Use force update for the most reliable update
          const updateResponse = await fetch(`${API_BASE_URL}/users/${firebaseUid}/force-update`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              providerData: {
                twitter: updatedAccounts
              }
            })
          });
          
          if (updateResponse.ok) {
            window.showToast?.success?.('Twitter accounts saved to database');
          } else {
            throw new Error(`Database update failed (${updateResponse.status})`);
          }
        } catch (saveError) {
          console.error('Error saving imported accounts to database:', saveError);
          window.showToast?.warning?.('Accounts imported to localStorage but not saved to database. Try the Force Update button.');
        }
      }
      
      // Refresh debug info
      await refreshDebugInfo();
      
      // Clear the input
      setAltUserId('');
    } catch (error) {
      console.error('Error importing Twitter accounts:', error);
      window.showToast?.error?.('Failed to import Twitter accounts: ' + error.message);
    } finally {
      setIsFetchingUserInfo(false);
    }
  };

  // Initialize UI on component mount
  useEffect(() => {
    // Initialize UI based on existing accounts
    const initializeUI = async () => {
      // Get Twitter accounts to determine current state
      const twitterAccounts = getTwitterAccounts();
      
      // If we have Twitter accounts, update the UI
      if (twitterAccounts.length > 0) {
        const account = twitterAccounts[0]; // Get the first account
        setAuthSuccess(true);
        setSelectedUsername(account.username || 'Twitter Account');
        setSelectedProfileImage(account.profileImageUrl || '');
        console.log('Twitter account detected, initializing UI with:', account.username);
      } else {
        // No accounts, so reset UI
        setAuthSuccess(false);
        setSelectedUsername('Twitter Account');
        setSelectedProfileImage('');
        console.log('No Twitter accounts found during initialization');
      }
      
      // Load debug info
      await refreshDebugInfo();
    };
    
    // Set API URL
    setApiUrl(API_BASE_URL);
    
    // Run initialization
    initializeUI();
  }, []);

  // Disconnect a specific Twitter account
  const disconnectTwitterAccount = async (accountToRemove) => {
    try {
      if (!accountToRemove?.userId) {
        console.error('Cannot disconnect account: Missing userId');
        window.showToast?.error?.('Cannot disconnect account: Missing user ID');
        return;
      }
      
      setIsDisconnecting(true);
      
      console.log('Disconnecting Twitter account:', accountToRemove.username || accountToRemove.userId);
      
      // Get existing accounts from socialMediaData
      const twitterAccounts = getTwitterAccounts();
      if (twitterAccounts.length === 0) {
        console.warn('No Twitter accounts found in socialMediaData');
        window.showToast?.warning?.('No Twitter accounts found');
        return;
      }
      
      // Filter out the account to remove
      const updatedAccounts = twitterAccounts.filter(account => 
        account.userId !== accountToRemove.userId
      );
      
      console.log(`Removed account ${accountToRemove.userId} from socialMediaData. ${updatedAccounts.length} accounts remaining.`);
      
      // Save updated accounts to socialMediaData
      saveTwitterAccounts(updatedAccounts);
      
      // Remove from database
      const firebaseUid = localStorage?.getItem('firebaseUid');
      if (firebaseUid) {
        try {
          console.log(`Removing Twitter account ${accountToRemove.userId} from database for user ${firebaseUid}`);
          
          // Try both endpoint formats in parallel for best chance of success
          const results = await Promise.allSettled([
            // Primary endpoint (path parameter style)
            fetch(`${API_BASE_URL}/users/${firebaseUid}/social/twitter/${accountToRemove.userId}`, {
              method: 'DELETE',
            }),
            
            // Fallback endpoint (query parameter style)
            fetch(`${API_BASE_URL}/users/${firebaseUid}/social/twitter?userId=${accountToRemove.userId}`, {
              method: 'DELETE',
            })
          ]);
          
          // Check results - we only need one to succeed
          const successfulResult = results.find(r => r.status === 'fulfilled' && r.value.ok);
          
          if (successfulResult) {
            console.log(`Successfully removed Twitter account ${accountToRemove.userId} from database`);
          } else {
            // Both failed, collect error info
            const errors = results
              .filter(r => r.status === 'rejected' || !r.value.ok)
              .map(r => {
                if (r.status === 'rejected') return r.reason?.message || 'Request failed';
                return `API error (${r.value.status})`;
              });
            
            console.error(`All removal attempts failed for account ${accountToRemove.userId}:`, errors);
            
            // If database removal failed but we have other accounts, try to update the database with the current accounts
            if (updatedAccounts.length > 0) {
              try {
                // Use force update as a last resort
                await fetch(`${API_BASE_URL}/users/${firebaseUid}/force-update`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    providerData: {
                      twitter: updatedAccounts
                    }
                  })
                });
                console.log('Force updated user data with remaining accounts');
              } catch (forceUpdateError) {
                console.error('Error in force update:', forceUpdateError);
              }
            }
          }
        } catch (error) {
          console.error(`Error removing Twitter account ${accountToRemove.userId} from database:`, error);
          window.showToast?.error?.(`Error removing account from database: ${error.message}`);
        }
      }
      
      // Update UI state if there are no more accounts
      if (updatedAccounts.length === 0) {
        setAuthSuccess(false);
        setSelectedUsername('Twitter Account');
        setSelectedProfileImage('');
      } else {
        // Update UI with first remaining account
        setSelectedUsername(updatedAccounts[0]?.username || 'Twitter Account');
        setSelectedProfileImage(updatedAccounts[0]?.profileImageUrl || '');
      }
      
      // Refresh debug info
      await refreshDebugInfo();
      
      window.showToast?.success?.('Twitter account disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting Twitter account:', error);
      window.showToast?.error?.('Error disconnecting Twitter account: ' + error.message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Twitter Integration</title>
        <meta name="description" content="Connect your Twitter account to post videos" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.header}>
        <div className={styles.logoContainer}>
          <TwitterIcon className={styles.twitterIcon} />
          <h1 className={styles.title}>Twitter Integration</h1>
        </div>
        <Link href="/social-posting" className={styles.backButton}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"></path>
            <path d="M12 19l-7-7 7-7"></path>
          </svg>
          Back to Home
        </Link>
      </div>

      <main className={styles.main}>
        <div className={styles.connectTwitter}>
          <h2 className={styles.sectionTitle}>Connect to Twitter</h2>
          <p className={styles.sectionDescription}>
            Authenticate with Twitter to post videos to your account.
          </p>

          {authError && (
            <div className={styles.errorMessage}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{authError}</span>
            </div>
          )}

          {!authSuccess ? (
            <button 
              className={styles.connectButton}
              onClick={handleConnect} 
              disabled={isLoading}
            >
              <TwitterIcon className={styles.buttonIcon} />
              <span>{isLoading ? 'Connecting...' : 'Connect Twitter Account'}</span>
            </button>
          ) : (
            <div className={styles.connectionsContainer}>
              <div className={styles.accountsHeader || 'flex justify-between items-center mb-3'}>
                <h3 className={styles.connectedAccountsTitle || 'text-lg font-medium'}>Connected Accounts</h3>
                {getTwitterAccounts().length > 1 && (
                  <button 
                    className={styles.disconnectAllButton || 'text-sm text-red-600 hover:text-red-800 flex items-center'}
                    onClick={disconnectTwitter}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? 'Disconnecting...' : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                          <polyline points="16 17 21 12 16 7"></polyline>
                          <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        Disconnect All
                      </>
                    )}
                  </button>
                )}
              </div>
              
              {/* Display all connected accounts */}
              {getTwitterAccounts().map((account, index) => (
                <div key={account.userId || index} className={styles.connectedAccount}>
                  <div className={styles.accountInfo}>
                    <div className={styles.accountAvatar}>
                      {account.profileImageUrl ? (
                        <img src={account.profileImageUrl} alt={account.username} className={styles.avatarImage} />
                      ) : (
                        <div className={styles.avatarPlaceholder}>
                          {account.username?.charAt(0)?.toUpperCase() || 'T'}
                        </div>
                      )}
                    </div>
                    <div className={styles.accountDetails}>
                      <h3 className={styles.accountName}>{account.username || "Twitter Account"}</h3>
                      <span className={styles.accountType}>Twitter Account</span>
                    </div>
                  </div>
                  <button 
                    className={styles.disconnectButton}
                    onClick={() => disconnectTwitterAccount(account)}
                    disabled={isDisconnecting}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    <span>Disconnect</span>
                  </button>
                </div>
              ))}
              
              {/* Add another account button */}
              <button 
                className={styles.addAccountButton || 'mt-4 flex items-center justify-center w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded'}
                onClick={handleConnect}
                disabled={isLoading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                <span>{isLoading ? 'Connecting...' : 'Add Another Twitter Account'}</span>
              </button>
            </div>
          )}
          
          {/* Button to manually load Twitter accounts from database */}
          <div className={styles.syncSection || 'mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50'}>
            <h3 className={styles.syncTitle || 'text-lg font-medium mb-2'}>Sync Twitter Account</h3>
            <p className={styles.syncDescription || 'text-sm text-gray-600 mb-3'}>
              If your Twitter account isn&apos;t showing correctly after login, click below to manually load it from the database.
            </p>
            <button 
              className={styles.syncButton || 'bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded flex items-center'}
              onClick={loadTwitterAccountsFromDB}
              disabled={isFetchingUserInfo}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              {isFetchingUserInfo ? 'Loading...' : 'Reload Twitter Account'}
            </button>
            
            {/* Button to test Twitter account saving to DB */}
            <div className="mt-4">
              <button 
                className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded flex items-center"
                onClick={testSaveTwitterAccountToDB}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
                Test Save to DB
              </button>
            </div>
            
            {/* Debug section - show current Twitter account data */}
            <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium mb-2">Debug Info</h3>
                <button 
                  className="text-sm text-blue-500 hover:text-blue-700"
                  onClick={refreshDebugInfo}
                >
                  Refresh
                </button>
              </div>
              
              <div className="text-xs font-mono bg-black text-green-400 p-2 rounded mt-2 max-h-60 overflow-auto">
                {debugInfo}
              </div>
              
              {/* Button to import Twitter accounts from alt user ID */}
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">Fix User ID Issues</h4>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="border p-1 text-sm rounded flex-1"
                    placeholder="Alternate User ID"
                    value={altUserId}
                    onChange={(e) => setAltUserId(e.target.value)}
                  />
                  <button 
                    className="bg-purple-500 hover:bg-purple-600 text-white text-sm py-1 px-2 rounded"
                    onClick={importTwitterAccounts}
                    disabled={!altUserId}
                  >
                    Import
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  If your Twitter account was saved to a different user ID, enter it above and click Import.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 