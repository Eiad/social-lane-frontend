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
        account && account.userId
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
      
      // Store only UI display data, not tokens
      socialMediaData.twitter = accounts.map(account => ({
        userId: account.userId,
        username: account.username,
        name: account.name || account.username,
        profileImageUrl: account.profileImageUrl
      }));

      localStorage.setItem('socialMediaData', JSON.stringify(socialMediaData));
      localStorage.setItem('socialMediaDataUpdated', Date.now().toString());
      
      console.log('Saved Twitter accounts to socialMediaData:', accounts.length);
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
        username: selectedAccount?.username,
        userId: selectedAccount?.userId
      });
      
      // We just need the userId, the backend will look up the tokens
      const payload = {
        videoUrl,
        text: caption || '',
        userId: selectedAccount.userId || localStorage?.getItem('firebaseUid')
      };
      
      console.log('Posting to Twitter with payload:', {
        videoUrl: !!payload.videoUrl,
        hasText: !!payload.text,
        userId: payload.userId
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
      
      
      window.showToast?.success?.('All Twitter accounts disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting Twitter accounts:', error);
      window.showToast?.error?.('Error disconnecting Twitter accounts: ' + error.message);
    } finally {
      setIsDisconnecting(false); // Reset loading state
    }
  };

  // Helper function to fetch Twitter accounts from the database if they're not in localStorage
  const fetchUserTwitterAccounts = async () => {
    try {
      setIsFetchingUserInfo(true);
      
      // Get current user ID from localStorage
      const uid = localStorage?.getItem('firebaseUid') || localStorage?.getItem('userId');
      
      if (!uid) {
        console.error('No user ID found, cannot fetch Twitter accounts');
        setIsFetchingUserInfo(false);
        return null;
      }
      
      console.log(`Fetching Twitter accounts for user ${uid} from database`);
      
      // Call the backend API to get user data including social media accounts
      const response = await fetch(`/api/users/${uid}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching user data: ${response.status}`);
      }
      
      const userData = await response.json();
      
      console.log('User data fetched:', userData);
      
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
          
          // Map accounts to standardized format - without tokens
          const formattedAccounts = twitterAccounts
            .filter(account => account)
            .map(account => ({
              userId: account.userId || account.user_id,
              username: account.username || account.screen_name || '',
              name: account.name || account.displayName || account.username || 'Twitter User',
              profileImageUrl: account.profileImageUrl || account.profile_image_url || ''
            }))
            .filter(account => account.userId); // Only filter by userId now
          
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
        // No accounts in localStorage, try to load from database
        console.log('No Twitter accounts found during initialization, trying database');
        const dbAccounts = await fetchUserTwitterAccounts();
        
        if (!dbAccounts || dbAccounts.length === 0) {
          // No accounts, so reset UI
          setAuthSuccess(false);
          setSelectedUsername('Twitter Account');
          setSelectedProfileImage('');
          console.log('No Twitter accounts found in database either');
        }
      }
      
      // Load debug info
      
    };
    
    // Set API URL
    setApiUrl(API_BASE_URL);
    
    // Run initialization
    initializeUI();
  }, []);

  // Handle Twitter callback after authentication
  useEffect(() => {
    // Check if we're returning from Twitter auth
    const processTwitterCallback = async () => {
      // Check if the URL contains parameters indicating Twitter callback
      const { 
        oauth_token, 
        oauth_verifier, 
        access_token, 
        access_token_secret, 
        user_id, 
        username, 
        name,
        profile_image_url,
        error
      } = router.query;
      
      // Handle error redirects
      if (error) {
        console.error('Twitter authentication error:', error);
        setAuthError(decodeURIComponent(error));
        window.showToast?.error?.(decodeURIComponent(error));
        router.replace('/twitter', undefined, { shallow: true });
        return;
      }
      
      // If we have oauth_token and oauth_verifier, the user has just been redirected back from Twitter
      // but the tokens haven't been processed yet. This is handled by the backend.
      if (oauth_token && oauth_verifier) {
        console.log('Twitter OAuth callback detected. The backend will process this.');
        setIsLoading(true);
        return;
      }
      
      // If we have access token and user data in the URL, the backend has processed the auth
      // and redirected back to us with the data
      if (access_token && access_token_secret && user_id) {
        try {
          console.log('Twitter auth data detected in URL, processing credentials');
          setIsLoading(true);
          setAuthError(null);
          
          // Create account object from URL parameters
          const twitterAccount = {
            accessToken: decodeURIComponent(access_token),
            accessTokenSecret: decodeURIComponent(access_token_secret),
            userId: decodeURIComponent(user_id),
            username: username ? decodeURIComponent(username) : 'Twitter User',
            name: name ? decodeURIComponent(name) : (username ? decodeURIComponent(username) : 'Twitter User'),
            profileImageUrl: profile_image_url ? decodeURIComponent(profile_image_url) : ''
          };
          
          console.log('Processing Twitter account:', {
            userId: twitterAccount.userId,
            username: twitterAccount.username,
            hasToken: !!twitterAccount.accessToken,
            hasSecret: !!twitterAccount.accessTokenSecret
          });
          
          // Get existing accounts (only display data)
          const existingAccounts = getTwitterAccounts();
          
          // Check if account already exists
          const accountExists = existingAccounts.some(acc => acc.userId === twitterAccount.userId);
          
          // Prepare updated accounts list for UI display (without tokens)
          let updatedAccounts;
          if (accountExists) {
            // Update existing account
            updatedAccounts = existingAccounts.map(acc => 
              acc.userId === twitterAccount.userId ? {
                userId: twitterAccount.userId,
                username: twitterAccount.username,
                name: twitterAccount.name,
                profileImageUrl: twitterAccount.profileImageUrl
              } : acc
            );
            console.log('Updated existing Twitter account');
          } else {
            // Add new account
            updatedAccounts = [...existingAccounts, {
              userId: twitterAccount.userId,
              username: twitterAccount.username, 
              name: twitterAccount.name,
              profileImageUrl: twitterAccount.profileImageUrl
            }];
            console.log('Added new Twitter account');
          }
          
          // Save display info to localStorage (without tokens)
          saveTwitterAccounts(updatedAccounts);
          
          // Save complete account data (including tokens) to database
          const firebaseUid = localStorage?.getItem('firebaseUid');
          if (firebaseUid) {
            await saveTwitterAccountsToDatabase(firebaseUid, [twitterAccount]);
          }
          
          // Update UI
          setAuthSuccess(true);
          setSelectedUsername(twitterAccount.username);
          setSelectedProfileImage(twitterAccount.profileImageUrl || '');
          
          // Refresh debug info
          
          
          // Show success message
          window.showToast?.success?.('Twitter account connected successfully!');
          
          // Clear query parameters to avoid reprocessing on page refresh
          router.replace('/twitter', undefined, { shallow: true });
        } catch (error) {
          console.error('Error processing Twitter auth data:', error);
          setAuthError(error?.message || 'Failed to complete Twitter authentication');
          window.showToast?.error?.(error?.message || 'Error connecting Twitter account');
        } finally {
          setIsLoading(false);
          // Clear auth timestamp
          localStorage.removeItem('twitterAuthTimestamp');
        }
      }
    };
    
    if (router.isReady) {
      processTwitterCallback();
    }
  }, [router.isReady, router.query]);

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
      
      
      window.showToast?.success?.('Twitter account disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting Twitter account:', error);
      window.showToast?.error?.('Error disconnecting Twitter account: ' + error.message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Refresh debug info

  // Import Twitter accounts from alternate user ID

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Head>
        <title>Twitter Integration</title>
        <meta name="description" content="Connect your Twitter account to post videos" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="py-8">
        {/* Header with back button */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-blue-500"><TwitterIcon className="w-8 h-8" /></span>
            <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              Twitter Integration
            </span>
          </h1>
          <Link 
            href="/social-posting"
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
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Your Twitter Accounts</h2>
              
              {authError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{authError}</span>
                </div>
              )}
              
              {!authSuccess ? (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 mb-6">
                    <TwitterIcon className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">Connect to Twitter</h3>
                  <p className="text-gray-600 mb-6 text-center max-w-md">
                    Authenticate with Twitter to post videos directly to your account.
                  </p>
                  <button 
                    className="px-6 py-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-medium flex items-center gap-2 transition-all shadow-sm"
                    onClick={handleConnect} 
                    disabled={isLoading}
                  >
                    <TwitterIcon className="w-5 h-5" />
                    <span>{isLoading ? 'Connecting...' : 'Connect Twitter Account'}</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Connected accounts header with disconnect all button */}
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-700">Connected Accounts</h3>
                    {getTwitterAccounts().length > 1 && (
                      <button 
                        className="text-sm text-red-600 hover:text-red-800 flex items-center"
                        onClick={disconnectTwitter}
                        disabled={isDisconnecting}
                      >
                        {isDisconnecting ? 'Disconnecting...' : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V7.414l-5-5H3zM2 4a2 2 0 012-2h5.586a1 1 0 01.707.293l6 6a1 1 0 01.293.707V16a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" clipRule="evenodd" />
                              <path d="M14 10v4a1 1 0 01-1 1H7a1 1 0 01-1-1v-4a1 1 0 011-1h6a1 1 0 011 1z" />
                            </svg>
                            Disconnect All
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  
                  {/* Grid of connected accounts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {getTwitterAccounts().map((account, index) => (
                      <div 
                        key={account.userId || index}
                        className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col p-4">
                          <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-4">
                            {account.profileImageUrl ? (
                              <img 
                                src={account.profileImageUrl} 
                                alt={`${account.username}'s profile`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'https://placehold.co/100x100?text=T';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-500 text-2xl font-bold">
                                {account.username?.charAt(0)?.toUpperCase() || 'T'}
                              </div>
                            )}
                          </div>
                          <h3 className="text-xl font-semibold text-center mb-1">{account.username || "Twitter Account"}</h3>
                          <p className="text-gray-500 text-center text-sm">@{account.username}</p>
                        </div>
                        
                        <div className="p-4 border-t border-gray-100">
                          <button 
                            onClick={() => disconnectTwitterAccount(account)}
                            disabled={isDisconnecting}
                            className="w-full py-2 px-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors font-medium text-sm"
                          >
                            Disconnect Account
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Add Account Button */}
                    <div 
                      onClick={handleConnect}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex flex-col p-4 items-center justify-center">
                        <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-4 bg-gray-100 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-center mb-1">Add Twitter Account</h3>
                        <p className="text-gray-500 text-center text-sm">Connect a new account</p>
                      </div>
                      
                      <div className="p-4 border-t border-gray-100">
                        <button 
                          className="w-full py-2 px-4 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors font-medium text-sm"
                        >
                          Connect Account
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Sync Account Section */}
            <div className="p-6 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Sync Twitter Account</h2>
              <p className="text-gray-600 text-sm mb-4">
                If your Twitter account isn&apos;t showing correctly after login, click below to manually reload it from the database.
              </p>
              <button 
                className="px-4 py-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium flex items-center gap-2 transition-colors shadow-sm"
                onClick={fetchUserTwitterAccounts}
                disabled={isFetchingUserInfo}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isFetchingUserInfo ? 'Loading...' : 'Reload Twitter Account'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 