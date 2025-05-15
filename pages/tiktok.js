import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.scss';
import tikTokStyles from '../styles/TikTok.module.css';
import Head from 'next/head';
import { TikTokSimpleIcon } from '../src/components/icons/SocialIcons';
import Link from 'next/link';
import axios from 'axios';
import { useLoader } from '../src/context/LoaderContext';
import { getUserLimits } from '../src/services/userService';

// With this approach that safely handles both server and client environments:
const API_BASE_URL = 
  typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_API_URL 
    : 'https://sociallane-backend.mindio.chat';

export default function TikTok() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const [userInfo, setUserInfo] = useState(null);
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [isHovering, setIsHovering] = useState(null);
  const { showLoader, hideLoader } = useLoader();
  const [userLimits, setUserLimits] = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(true);
  const [limitsError, setLimitsError] = useState(null);

  // Function to handle localStorage storage events
  const handleStorageUpdate = useCallback(() => {
    const updated = localStorage?.getItem('socialMediaDataUpdated');
    if (updated) {
      console.log('Social media data updated, refreshing TikTok accounts');
      const refreshedAccounts = getTikTokAccounts();
      setConnectedAccounts(refreshedAccounts);
      setIsAuthenticated(refreshedAccounts.length > 0);
    }
  }, []);

  // Get TikTok accounts from socialMediaData
  const getTikTokAccounts = () => {
    try {
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (!socialMediaDataStr) {
        return [];
      }
      
      const socialMediaData = JSON.parse(socialMediaDataStr);
      if (!socialMediaData?.tiktok || !Array.isArray(socialMediaData.tiktok)) {
        return [];
      }
      
      // Return the accounts with only display info
      // The actual tokens will be retrieved from the database by the backend
      return socialMediaData.tiktok.filter(account => 
        account && account.accountId
      );
    } catch (error) {
      console.error('Error getting TikTok accounts from socialMediaData:', error);
      return [];
    }
  };

  // Save TikTok accounts to socialMediaData
  const saveTikTokAccounts = (accounts) => {
    try {
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      let socialMediaData = {};
      
      if (socialMediaDataStr) {
        socialMediaData = JSON.parse(socialMediaDataStr);
      }
      
      // Only store non-sensitive user info for display purposes
      socialMediaData.tiktok = accounts.map(account => {
        console.log('Processing account for localStorage:', {
          hasAvatarUrl: !!account.avatarUrl,
          hasAvatarUrl100: !!account.avatarUrl100
        });
        
        return {
          // Store the openId as an identifier but NOT the tokens
          accountId: account.accountId || account.openId,
          username: account.username || account.userInfo?.username || 'TikTok User',
          displayName: account.displayName || account.userInfo?.display_name || '',
          // Use original avatarUrl from TikTok
          avatarUrl: account.avatarUrl || account.userInfo?.avatar_url || '',
          // For avatarUrl100, prioritize the account's main property which should already have the R2 URL from DB
          // Only use userInfo properties as fallback
          avatarUrl100: account.avatarUrl100 || '',
          index: account.index || 0
        };
      });
      
      localStorage.setItem('socialMediaData', JSON.stringify(socialMediaData));
      localStorage.setItem('socialMediaDataUpdated', Date.now().toString());
      
      console.log('Saved TikTok user info to socialMediaData (tokens stored only in database)');
      console.log('TikTok accounts saved to localStorage:', socialMediaData.tiktok.map(account => ({
        accountId: account.accountId,
        username: account.username,
        hasDisplayName: !!account.displayName,
        hasAvatarUrl: !!account.avatarUrl,
        hasAvatarUrl100: !!account.avatarUrl100
      })));
    } catch (error) {
      console.error('Error saving TikTok accounts to socialMediaData:', error);
    }
  };

  // Function to save account display info to localStorage and send full data to user record in database
  const saveAccountsToUserRecord = async () => {
    const firebaseUid = localStorage?.getItem('firebaseUid');
    if (!firebaseUid) {
      console.log('Cannot save TikTok accounts to user record: No Firebase UID found');
      return;
    }
    
    // Get display accounts from localStorage
    const displayAccounts = getTikTokAccounts();
    
    if (!displayAccounts || displayAccounts.length === 0) {
      console.log('No TikTok accounts to save to user record');
      return;
    }
    
    // Note: This function no longer has any tokens to send - we're only getting account IDs
    // The backend will need to look up the tokens from its database
    console.log(`Found ${displayAccounts.length} TikTok account IDs to verify in the database`);
    
    // We no longer save tokens from frontend, just notify the backend to check its own database
    // for these accounts and verify they're still valid
    try {
      // Just send the account IDs to ping the backend to verify its stored tokens
      const accountIds = displayAccounts.map(account => ({ accountId: account.accountId }));
      
      const response = await fetch(`/api/users/${firebaseUid}/social/tiktok/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(accountIds)
      });
      
      if (!response?.ok) {
        const errorText = await response.text();
        console.error('Server error verifying TikTok accounts:', response.status, errorText);
        throw new Error(`Failed to verify TikTok accounts: ${response?.status}`);
      }
      
      const data = await response?.json();
      console.log('Successfully verified TikTok accounts in database:', data?.success);
    } catch (error) {
      console.error('Error verifying TikTok accounts in database:', error);
    }
  };

  // Helper function to fetch user accounts from the database
  const fetchUserAccounts = async () => {
    let fetchedSuccessfully = false; // Flag to track success
    // Get current accounts from localStorage FIRST, before any fetch.
    // These might include optimistically added accounts.
    const accountsCurrentlyInStorage = getTikTokAccounts() || [];
    
    try {
      showLoader('Loading your TikTok accounts...');
      
      const uid = localStorage?.getItem('firebaseUid') || localStorage?.getItem('userId');
      if (!uid) {
        console.error('No user ID found, cannot fetch TikTok accounts');
        // If no UID, but we have storage accounts, display them.
        if (accountsCurrentlyInStorage.length > 0) {
            setConnectedAccounts([...accountsCurrentlyInStorage]);
            setIsAuthenticated(true);
            console.log('[FETCH_USER_ACCOUNTS] No UID, using accounts from storage.');
        } else {
            setConnectedAccounts([]);
            setIsAuthenticated(false);
        }
        hideLoader();
        return false; // Cannot fetch successfully without UID
      }
      
      console.log(`Fetching TikTok accounts for user ${uid} from database`);
      
      let hasFetchError = false;
      let response;
      let lastError;
      const MAX_RETRIES = 3;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Attempt ${attempt}/${MAX_RETRIES} to fetch user data`);
          const fetchTimeout = 30000 * attempt;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);
          const cacheBuster = `no-cache=${Date.now()}`;
          
          response = await fetch(`/api/users/${uid}?${cacheBuster}`, {
            signal: controller.signal,
            headers: {
              'Cache-Control': 'no-cache, no-store',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`Error fetching user data: ${response.status}`);
          }
          break;
        } catch (error) {
          lastError = error;
          console.error(`Attempt ${attempt} failed:`, error?.message || error);
          if (attempt === MAX_RETRIES) {
            hasFetchError = true;
          } else {
            const delay = 2000 * Math.pow(2, attempt - 1);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      let userData = null;
      if (response && !hasFetchError) { // Ensure response exists and no prior error flag from retries
        try {
          userData = await response.json();
          console.log('User data fetched:', userData);
        } catch (parseError) {
          console.error('Error parsing user data JSON:', parseError);
          hasFetchError = true; // Mark as fetch error if parsing fails
        }
      }

      // Start of new merge logic section
      let finalAccountsToShow = [];

      if (userData?.success && userData?.data?.providerData?.tiktok) {
        const tiktokAccountsFromServerRaw = userData.data.providerData.tiktok;
        const formattedFromServer = Array.isArray(tiktokAccountsFromServerRaw) 
            ? tiktokAccountsFromServerRaw.map(account => ({
                accountId: account.openId || account.accountId,
                username: account.username || account.userInfo?.username || '',
                displayName: account.displayName || account.userInfo?.display_name || '',
                avatarUrl: account.avatarUrl || account.userInfo?.avatar_url || '',
                avatarUrl100: account.avatarUrl100 || ''
              })) 
            : [];

        // Merge server data with current accounts from storage.
        // Server data is the base. Add any accounts from storage not present in server data.
        const serverAccountMap = new Map(formattedFromServer.map(acc => [acc.accountId, acc]));
        finalAccountsToShow = [...formattedFromServer]; // Start with server accounts

        accountsCurrentlyInStorage.forEach(storageAcc => {
            if (storageAcc.accountId && !serverAccountMap.has(storageAcc.accountId)) {
                finalAccountsToShow.push(storageAcc); // Add optimistic/storage-only account
                console.log(`[FETCH_USER_ACCOUNTS] Merging account from storage (not on server yet): ${storageAcc.accountId}`);
            }
        });
        fetchedSuccessfully = true;
        console.log('[FETCH_USER_ACCOUNTS] Merged server data with storage accounts.');
      } else if (hasFetchError) {
        // Fetch error occurred. Rely entirely on what's in storage.
        console.log('[FETCH_USER_ACCOUNTS] Fetch error. Using accounts from storage.');
        finalAccountsToShow = [...accountsCurrentlyInStorage];
        if (accountsCurrentlyInStorage.length > 0) {
             window.showToast?.warning?.('Could not update account list from server. Displaying locally saved accounts.');
        } else {
            window.showToast?.error?.('Failed to load TikTok accounts from server and no local data available.');
        }
        // fetchedSuccessfully remains false or based on whether accountsCurrentlyInStorage has items
      } else { 
        // No user data for TikTok from server (userData is null, or no success, or no tiktok field) AND no fetch error.
        // This means server authoritatively says no accounts.
        // However, if we have accounts in storage (e.g. just added optimistically), we keep them for now.
        // The merge logic: if formattedFromServer is empty, finalAccountsToShow will be accountsCurrentlyInStorage.
        if (accountsCurrentlyInStorage.length > 0) {
            console.log('[FETCH_USER_ACCOUNTS] Server reports no TikTok accounts, but using accounts from storage.');
            finalAccountsToShow = [...accountsCurrentlyInStorage];
        } else {
            console.log('[FETCH_USER_ACCOUNTS] No TikTok accounts from server and none in storage.');
            finalAccountsToShow = [];
        }
        // If userData.success was true but providerData.tiktok was empty, it's still a success.
        if (userData?.success) fetchedSuccessfully = true; 
      }

      // Update localStorage and React state with the final list
      saveTikTokAccounts(finalAccountsToShow);
      setConnectedAccounts([...finalAccountsToShow]);
      setIsAuthenticated(finalAccountsToShow.length > 0);
      
      if (fetchedSuccessfully) {
        console.log('TikTok accounts state updated. Total accounts shown:', finalAccountsToShow.length);
        // Removed: window.dispatchEvent(new Event('storage')); 
        // saveTikTokAccounts already sets 'socialMediaDataUpdated' which should be used by listeners
      }
      // End of new merge logic section

    } catch (error) {
      console.error('Error fetching user TikTok accounts (outer catch):', error);
      // Fallback to whatever is in storage in case of any unexpected error
      if (accountsCurrentlyInStorage.length > 0) {
        setConnectedAccounts([...accountsCurrentlyInStorage]);
        setIsAuthenticated(true);
        window.showToast?.error?.('An unexpected error occurred. Displaying locally saved accounts.');
      } else {
        setConnectedAccounts([]);
        setIsAuthenticated(false);
        window.showToast?.error?.('Failed to load your TikTok accounts. Please refresh and try again.');
      }
    } finally {
      hideLoader();
    }
    return fetchedSuccessfully;
  };

  // Function to save a single account to the backend
  const saveAccountToBackend = async (accountData) => {
    const firebaseUid = localStorage?.getItem('firebaseUid');
    if (!firebaseUid) {
      console.error('Cannot save TikTok account: No Firebase UID found');
      return;
    }
    
    try {
      console.log(`Saving TikTok account for user ${firebaseUid} to database`);
      
      // Add retry logic with exponential backoff
      let response;
      let lastError;
      const MAX_RETRIES = 3;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Attempt ${attempt}/${MAX_RETRIES} to save TikTok account`);
          
          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 30000 * attempt);
          });
          
          // Create the fetch promise
          const fetchPromise = fetch(`/api/users/${firebaseUid}/social/tiktok`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(accountData)
          });
          
          // Race them
          response = await Promise.race([fetchPromise, timeoutPromise]);
          
          if (!response?.ok) {
            const errorText = await response.text();
            console.error('Server error saving TikTok account:', response.status, errorText);
            throw new Error(`Failed to save TikTok account: ${response?.status}`);
          }
          
          // If successful, break out of retry loop
          break;
        } catch (error) {
          lastError = error;
          console.error(`Attempt ${attempt} failed:`, error?.message || error);
          
          // If we've exhausted all retries, throw the error to be caught by the outer catch
          if (attempt === MAX_RETRIES) {
            throw error;
          }
          
          // Otherwise, wait with exponential backoff before retrying
          const delay = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s, etc.
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      const data = await response?.json();
      console.log('Successfully saved TikTok account to database:', data);

      // Update local state and localStorage with the confirmed new account
      if (data?.success && data?.accounts?.length > 0) {
        // Assuming one account is saved at a time in this particular flow.
        // The 'accountData' parameter of saveAccountToBackend holds the full details sent.
        // The 'data.accounts[0]' from the response has the backend-confirmed basic info.
        const newSavedAccountInfo = data.accounts[0]; 
        
        try {
          let localAccounts = getTikTokAccounts() || [];
          const accountToUpdateOrAdd = {
            accountId: newSavedAccountInfo.accountId, // This is the openId
            username: newSavedAccountInfo.username || accountData.username || 'TikTok User',
            displayName: newSavedAccountInfo.displayName || accountData.displayName || '',
            avatarUrl: accountData.avatarUrl || '', // Use original from input data
            avatarUrl100: accountData.avatarUrl100 || '' // Use R2 URL from input data
          };

          const existingAccountIndex = localAccounts.findIndex(acc => acc.accountId === accountToUpdateOrAdd.accountId);
          if (existingAccountIndex > -1) {
            // Update existing account if it somehow already exists (e.g., due to rapid operations)
            localAccounts[existingAccountIndex] = { ...localAccounts[existingAccountIndex], ...accountToUpdateOrAdd };
          } else {
            localAccounts.push(accountToUpdateOrAdd);
          }
          
          saveTikTokAccounts(localAccounts); // This updates localStorage
          setConnectedAccounts([...localAccounts]); // Update React state
          setIsAuthenticated(localAccounts.length > 0);
          console.log('Optimistically updated localStorage and state with new TikTok account:', accountToUpdateOrAdd);

        } catch (localStorageError) {
          console.error('Error updating localStorage/state after successful save:', localStorageError);
        }
      } else {
        // Fallback or if response structure is not as expected, try previous optimistic update from input data
        console.warn('[TIKTOK SAVE] API response did not contain expected account data, attempting fallback optimistic update.');
        try {
            let localAccounts = getTikTokAccounts() || [];
            const newAccount = {
              accountId: accountData.openId,
              username: accountData.username || 'TikTok User',
              displayName: accountData.displayName || '',
              avatarUrl: accountData.avatarUrl || '',
              avatarUrl100: accountData.avatarUrl100 || ''
            };
            if (!localAccounts.some(acc => acc.accountId === newAccount.accountId)) {
              localAccounts.push(newAccount);
              saveTikTokAccounts(localAccounts);
              setConnectedAccounts([...localAccounts]);
              setIsAuthenticated(localAccounts.length > 0);
              console.log('Fallback: Added new TikTok account to localStorage optimistically.');
            }
        } catch (e) {
            console.error("Fallback optimistic update failed", e)
        }
      }
      
      // Add a delay before fetching all accounts to give the backend time to fully process the user object update
      console.log('Waiting a bit (e.g. 2.5s) before fetching updated full user data...');
      await new Promise(resolve => setTimeout(resolve, 2500)); 
      
      // Now try to fetch full accounts from backend to ensure consistency
      await fetchUserAccounts();
    } catch (error) {
      console.error('Error saving TikTok account to database:', error);
      
      // Even if the save fails, try to use any local data we might have
      const localAccounts = getTikTokAccounts();
      if (localAccounts?.length > 0) {
        setConnectedAccounts(localAccounts);
        setIsAuthenticated(true);
      }
      
      throw error;
    }
  };

  // Then remove the duplicate definition inside the first useEffect
  // Modify the first useEffect to just use the function:
  useEffect(() => {
    setApiUrl(API_BASE_URL);
    const storedAccounts = getTikTokAccounts();
    
    if (storedAccounts && storedAccounts.length > 0) {
      console.log(`Found ${storedAccounts.length} TikTok accounts in localStorage`);
      setConnectedAccounts(storedAccounts);
      setIsAuthenticated(true);
      
      // Verify stored accounts with backend
      saveAccountsToUserRecord();
    } else {
      console.log('No TikTok accounts found in localStorage');
      fetchUserAccounts();
    }
    
    // Listen for possible social media data updates from other components
    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, [handleStorageUpdate]);

  useEffect(() => {
    // Get user ID from localStorage
    const uid = localStorage?.getItem('firebaseUid') || localStorage?.getItem('userId');
    if (!uid) {
      console.error('No user ID found');
      setLimitsLoading(false);
      return;
    }
    
    setUserId(uid);
    
    // Fetch Limits
    const fetchLimits = async () => {
      setLimitsLoading(true);
      setLimitsError(null);
      try {
        console.log(`Fetching limits for user ${uid}`);
        const limitsResponse = await getUserLimits(uid);
        if (limitsResponse?.success && limitsResponse?.data) {
          console.log('User limits received:', limitsResponse.data);
          setUserLimits(limitsResponse.data);
        } else {
          console.error('Failed to fetch user limits:', limitsResponse?.error);
          setLimitsError(limitsResponse?.error || 'Failed to load usage limits.');
        }
      } catch (error) {
        console.error('Error fetching user limits:', error);
        setLimitsError('An error occurred while fetching usage limits.');
      } finally {
        setLimitsLoading(false);
      }
    };

    fetchLimits();

    // Check if there's a connection success parameter in the URL
    // This will detect when we return from the TikTok OAuth flow
    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get('auth_success');
    const connectionError = urlParams.get('connection_error');
    const hasTokenParams = urlParams.has('access_token') && urlParams.has('open_id');
    
    if (authSuccess === 'true' || hasTokenParams) {
      console.log('Detected successful TikTok account connection, refreshing accounts list');
      window.showToast?.success?.('TikTok account connected successfully');
      
      // Clear the auth_success parameter from URL for cleaner UX if no token params
      if (authSuccess === 'true' && !hasTokenParams) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
      
      // Don't remove token params here since they are handled in the token-specific useEffect
      
      // Force a fresh fetch of accounts from the backend
      fetchUserAccounts();
    } else if (connectionError) {
      console.error('TikTok connection error:', connectionError);
      window.showToast?.error?.(`Failed to connect TikTok account: ${connectionError}`);
      
      // Clear the error parameter from URL for cleaner UX
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Add back the token parsing logic to the component to handle direct callback parameters
  useEffect(() => {
    // Check for token in URL (new flow)
    const { access_token, open_id, user_info, error: urlError } = router?.query || {};
    
    if (urlError) {
      window.showToast?.error?.(decodeURIComponent(urlError));
      // Remove the error from URL
      router?.replace('/tiktok', undefined, { shallow: true });
      return;
    }
    
    if (access_token && open_id) {
      console.log('TikTok auth callback received');
      showLoader('Connecting to TikTok...');
      
      try {
        // Parse user info if available
        let userInfoObj = null;
        if (user_info) {
          try {
            userInfoObj = JSON.parse(decodeURIComponent(user_info));
            console.log('Successfully parsed user info:', {
              hasUsername: !!userInfoObj?.username,
              hasDisplayName: !!userInfoObj?.display_name,
              hasAvatarUrl: !!userInfoObj?.avatar_url,
              hasAvatarUrl100: !!userInfoObj?.avatarUrl100,
              hasAvatar_url_100: !!userInfoObj?.avatar_url_100 
            });
          } catch (e) {
            console.error('Failed to parse user_info:', e);
          }
        } else {
          console.warn('No user_info received from TikTok callback');
        }
        
        // Keep original TikTok avatar URL
        const avatarUrl = userInfoObj?.avatarUrl || userInfoObj?.avatar_url || '';
        
        // When connecting a new account, use the avatarUrl100 from R2 (comes from backend)
        // This is created by tiktokService.getUserInfo which uploads to R2
        const avatarUrl100 = userInfoObj?.avatarUrl100 || userInfoObj?.avatar_url_100 || '';
        
        const accountData = {
          accessToken: access_token,
          openId: open_id,
          refreshToken: router?.query?.refresh_token || '',
          username: userInfoObj?.username || 'TikTok User',
          displayName: userInfoObj?.display_name || '',
          // Use original TikTok avatar URL
          avatarUrl: avatarUrl,
          // Use R2 URL for avatarUrl100 (already uploaded by backend during account connection)
          avatarUrl100: avatarUrl100
        };
        
        console.log('Saving account data to backend:', {
          hasUsername: !!accountData.username,
          hasDisplayName: !!accountData.displayName,
          hasAvatarUrl: !!accountData.avatarUrl,
          hasAvatarUrl100: !!accountData.avatarUrl100
        });
        
        // Save token to backend
        saveAccountToBackend(accountData)
          .then(() => {
            window.showToast?.success?.('Successfully connected to TikTok!');
            hideLoader();
          })
          .catch(error => {
            window.showToast?.error?.('Failed to save TikTok account: ' + (error?.message || 'Unknown error'));
            hideLoader();
          });
        
        // Remove the token from URL for security
        router?.replace('/tiktok', undefined, { shallow: true });
      } catch (error) {
        console.error('Error processing TikTok auth callback:', error);
        window.showToast?.error?.('Failed to process TikTok authentication callback');
        hideLoader();
      }
    }
  }, [router?.query]);

  // Fetch accounts when userId is set or accounts change externally
  useEffect(() => {
    if (userId) {
      console.log('Fetching accounts because userId changed or external update detected.');
      fetchUserAccounts();
    }
  }, [userId, handleStorageUpdate]);

  // NEW: Handle redirect back from TikTok authentication
  useEffect(() => {
    const handleTikTokCallback = async () => {
      // Use 'auth_success' as the query parameter
      if (router.query.auth_success === 'true') {
        console.log('Detected successful TikTok authentication callback.');
        showLoader('Finalizing TikTok connection...');
        // Refetch accounts to get the latest data
        await fetchUserAccounts();
        // Clean the URL query parameters
        router.replace('/tiktok', undefined, { shallow: true });
        // hideLoader() is called within fetchUserAccounts finally block
      } else if (router.query.error || router.query.connection_error) {
        // Handle potential error parameters from backend redirect
        const errorMsg = router.query.error || router.query.connection_error || 'Unknown error';
        console.error('TikTok authentication error from redirect:', errorMsg);
        window.showToast?.error?.(`TikTok Connection Error: ${decodeURIComponent(errorMsg)}`);
        // Clean the URL query parameters
        router.replace('/tiktok', undefined, { shallow: true });
      }
    };

    if (router.isReady) {
      handleTikTokCallback();
    }
  }, [router.isReady, router.query, fetchUserAccounts]); // Add fetchUserAccounts dependency

  // --- Derived state for checking limits ---
  const isAccountLimitReached = useMemo(() => {
    if (!userLimits) return false; // Assume not reached if limits not loaded
    
    const limit = userLimits.socialAccounts;
    const currentCount = userLimits.currentSocialAccounts;
    
    // Check if limit is defined (-1 means unlimited)
    if (limit === -1) {
        return false;
    }
    
    // Check if current count meets or exceeds the limit
    return currentCount >= limit;
  }, [userLimits]);

  const accountLimitMessage = useMemo(() => {
    if (!isAccountLimitReached || !userLimits) return null;
    const limit = userLimits.socialAccounts;
    return `You've reached your plan limit of ${limit} connected social account${limit > 1 ? 's' : ''}. Please upgrade or disconnect an existing account.`;
  }, [isAccountLimitReached, userLimits]);

  // --- Connect Handler - Updated ---
  const handleConnect = async () => {
    // Check limit before initiating connection
    if (isAccountLimitReached) {
        console.warn('Account limit reached. Cannot connect new account.');
        window.showToast?.error?.(accountLimitMessage || 'Social account limit reached.');
        return;
    }
    
    if (!userId) {
      console.error('User ID not found, cannot start TikTok connection.');
      window.showToast?.error?.('User ID missing, cannot connect. Please login again.');
      return;
    }
    setIsLoading(true);
    try {
      // Redirect user to backend endpoint to start TikTok OAuth flow
      window.location.href = `${apiUrl}/tiktok/auth?userId=${userId}`;
    } catch (error) {
      console.error('Error redirecting to TikTok auth:', error);
      window.showToast?.error?.('Failed to initiate TikTok connection.');
      setIsLoading(false);
    }
  };

  // Enhance the handleDisconnect function for immediate UI feedback and proper state updates
  const handleDisconnect = async (account) => {
    if (!account?.accountId) {
      console.error('Cannot disconnect account: Missing account ID');
      return;
    }
    
    try {
      // Show global loader instead of local loading state
      showLoader('Disconnecting TikTok account...');
      
      const firebaseUid = localStorage?.getItem('firebaseUid');
      if (!firebaseUid) {
        throw new Error('No user ID found');
      }
      
      console.log(`Disconnecting TikTok account ${account.accountId} for user ${firebaseUid}`);
      
      // Immediately update UI before API call to provide a responsive feel
      const updatedAccounts = connectedAccounts.filter(a => a.accountId !== account.accountId);
      setConnectedAccounts([...updatedAccounts]); // Force a new array reference
      if (updatedAccounts.length === 0) {
        setIsAuthenticated(false);
      }
      
      // Call API to disconnect account
      const response = await fetch(`/api/users/${firebaseUid}/social/tiktok/${account.accountId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response?.ok) {
        const errorText = await response?.text?.() || '';
        console.error('Server error disconnecting TikTok account:', response?.status, errorText);
        
        // Restore original accounts if API call fails
        setConnectedAccounts([...connectedAccounts]); // Force a new array reference
        if (connectedAccounts.length > 0) {
          setIsAuthenticated(true);
        }
        
        throw new Error(`Failed to disconnect TikTok account: ${response?.status}`);
      }
      
      // Remove account from localStorage
      const accounts = getTikTokAccounts() || [];
      const filteredAccounts = accounts.filter(a => a?.accountId !== account?.accountId);
      
      // Clear and re-create the social media data to ensure a fresh state
      localStorage.removeItem('socialMediaData');
      saveTikTokAccounts(filteredAccounts);
      
      // Set a flag to indicate the accounts were updated
      localStorage.setItem('accountsUpdated', Date.now().toString());
      
      // Force refreshing the state with the new data
      setConnectedAccounts([...filteredAccounts]);
      setIsAuthenticated(filteredAccounts.length > 0);
      
      // Trigger a localStorage update event to notify other components
      window.dispatchEvent(new Event('storage'));
      
      console.log('TikTok account disconnected successfully. Remaining accounts:', updatedAccounts.length);
      window.showToast?.success?.('Successfully disconnected TikTok account');
    } catch (error) {
      console.error('Error disconnecting TikTok account:', error);
      window.showToast?.error?.('Failed to disconnect TikTok account: ' + (error?.message || 'Unknown error'));
    } finally {
      // Hide global loader
      hideLoader();
    }
  };

  const goToHome = () => {
    router?.push('/');
  };

  // Render content based on authentication state
  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <Head>
          <title>TikTok Integration | Social Lane</title>
          <meta name="description" content="Connect your TikTok account" />
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
                className="px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-medium flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <TikTokSimpleIcon width="20" height="20" />
                <span>Connect TikTok Account</span>
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
                  // Always prioritize avatarUrl100 (R2 URL) for display
                  // But only use the direct property, not from userInfo
                  const profilePic = account?.avatarUrl100 || account?.avatarUrl || 'https://placehold.co/100x100?text=TikTok';
                  const username = account?.username || 'TikTok Account';
                  const displayName = account?.displayName || username;
                  
                  return (
                    <div 
                      key={account.accountId}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                      onMouseEnter={() => setIsHovering(account.accountId)}
                      onMouseLeave={() => setIsHovering(null)}>
                      <div className="flex flex-col p-4">
                        <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-4 bg-gray-100 flex items-center justify-center">
                          {account?.avatarUrl100 || account?.avatarUrl ? (
                            <img 
                              src={profilePic} 
                              alt={`${displayName}'s profile`} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                // Fall back to default image if both attempts fail
                                e.target.src = 'https://placehold.co/100x100?text=TikTok';
                                console.log(`Failed to load avatar for ${account.accountId}, using placeholder`);
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <h3 className="text-xl font-semibold text-center mb-1">{displayName}</h3>
                        <p className="text-gray-500 text-center text-sm">@{username}</p>
                      </div>
                      
                      <div className="p-4 border-t border-gray-100">
                        {isHovering === account.accountId ? (
                          <button 
                            onClick={() => handleDisconnect(account)}
                            className="w-full py-2 px-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors font-medium text-sm">
                            Disconnect Account
                          </button>
                        ) : (
                          <button 
                            className="w-full py-2 px-4 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-md transition-colors font-medium text-sm">
                            Connected
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {/* Add Account Button - Updated */}
                <div 
                  onClick={!isAccountLimitReached ? handleConnect : undefined}
                  className={`bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${isAccountLimitReached || limitsLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  title={isAccountLimitReached ? accountLimitMessage : (limitsLoading ? 'Loading limits...' : 'Connect a new TikTok account')}
                >
                  <div className="flex flex-col p-4 items-center justify-center">
                    <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-4 bg-gray-100 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-center mb-1">Add TikTok Account</h3>
                    <p className="text-gray-500 text-center text-sm">Connect a new account</p>
                  </div>
                  
                  <div className="p-4 border-t border-gray-100">
                    <button 
                      disabled={isAccountLimitReached || limitsLoading}
                      className="w-full py-2 px-4 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors font-medium text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {limitsLoading ? 'Checking limits...' : (isAccountLimitReached ? 'Limit Reached' : 'Connect Account')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Limit Warning Message */}    
            {isAccountLimitReached && accountLimitMessage && (
                <div className="max-w-4xl mx-auto mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                    <p className="text-sm text-yellow-800">{accountLimitMessage}</p>
                    <Link href="/subscription" className="text-sm font-medium text-primary hover:text-primary-dark underline mt-1 inline-block">
                        Upgrade Plan
                    </Link>
                </div>
            )}

            {/* Post Container - Show if there are any accounts */}
            {connectedAccounts.length > 0 && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">TikTok Accounts Management</h2>
                <p className="text-gray-600 mb-6">
                  Your connected TikTok accounts are shown above. You can connect additional accounts 
                  or disconnect existing ones as needed.
                </p>
                <p className="text-gray-600">
                  To post videos to TikTok, please use the main dashboard where you can upload videos 
                  and select which accounts to post to.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}