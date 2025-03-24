import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { createOrUpdateUser, getUserByUid } from '../services/userService';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(false);

  // Store social media tokens from user data to localStorage
  const storeSocialMediaTokens = (userData) => {
    if (!userData?.providerData) {
      console.log('No providerData found in user object:', userData);
      return;
    }
    
    try {
      console.log('Processing user data to store social tokens. providerData structure:', userData.providerData);
      
      // Store Firebase UID for consistent identification
      if (userData.uid) {
        // Always use Firebase UID as the primary identifier (this is the format rSbXTmT85KWnqo6Qng7Qcp9wzFq2)
        localStorage?.setItem('firebaseUid', userData.uid);
        localStorage?.setItem('userId', userData.uid); // Ensure userId is always the same as Firebase UID
        console.log('Stored Firebase UID in localStorage as both firebaseUid and userId:', userData.uid);
      }
      
      // Store Twitter tokens if available
      const twitterData = userData.providerData.twitter;
      if (twitterData) {
        // Mark that social media data was loaded from DB
        localStorage?.setItem('socialMediaLoaded', 'true');
        localStorage?.setItem('socialMediaLoadTime', Date.now().toString());
        
        if (Array.isArray(twitterData)) {
          console.log('Found Twitter accounts array:', twitterData.length);
          
          // Clear existing Twitter accounts
          clearAllTwitterStorage();
          
          // Store new Twitter accounts with handle-based keys
          twitterData.forEach((account) => {
            // Get handle from username and convert to lowercase for consistent storage
            const handle = (account.username || '').toLowerCase();
            
            if (!handle) {
              console.warn('Skipping Twitter account with no handle/username');
              return;
            }
            
            console.log(`Storing Twitter account for @${handle}:`, {
              hasAccessToken: !!account.accessToken,
              hasUserId: !!account.userId,
              hasAccessTokenSecret: !!account.accessTokenSecret
            });
            
            // Store with handle as identifier
            if (account.accessToken) localStorage?.setItem(`twitterAccessToken_${handle}`, account.accessToken);
            if (account.userId) localStorage?.setItem(`twitterUserId_${handle}`, account.userId);
            if (account.accessTokenSecret) localStorage?.setItem(`twitterAccessTokenSecret_${handle}`, account.accessTokenSecret);
            if (account.username) localStorage?.setItem(`twitterUsername_${handle}`, account.username); // Store original case
            if (account.name) localStorage?.setItem(`twitterName_${handle}`, account.name);
            if (account.profileImageUrl) localStorage?.setItem(`twitterProfileImage_${handle}`, account.profileImageUrl);
          });
          
          // Set legacy format only for the first account (for backward compatibility)
          if (twitterData.length > 0) {
            // Legacy format sync removed as we're transitioning to socialMediaData only
          }
        } else if (twitterData.accessToken && twitterData.username) {
          // Handle single object format
          console.log('Found Twitter data (single object)');
          
          // Clear existing Twitter accounts
          clearAllTwitterStorage();
          
          // Get handle from username and convert to lowercase
          const handle = (twitterData.username || '').toLowerCase();
          
          if (handle) {
            // Store with handle as identifier
            if (twitterData.accessToken) localStorage?.setItem(`twitterAccessToken_${handle}`, twitterData.accessToken);
            if (twitterData.userId) localStorage?.setItem(`twitterUserId_${handle}`, twitterData.userId);
            if (twitterData.accessTokenSecret) localStorage?.setItem(`twitterAccessTokenSecret_${handle}`, twitterData.accessTokenSecret);
            if (twitterData.username) localStorage?.setItem(`twitterUsername_${handle}`, twitterData.username); // Store original case
            if (twitterData.name) localStorage?.setItem(`twitterName_${handle}`, twitterData.name);
            if (twitterData.profileImageUrl) localStorage?.setItem(`twitterProfileImage_${handle}`, twitterData.profileImageUrl);
            
            // Legacy format sync removed as we're transitioning to socialMediaData only
          } else {
            console.warn('Cannot store Twitter account without username/handle');
          }
        } else {
          console.log('Invalid Twitter data format or missing username');
        }
      } else {
        console.log('No Twitter data found in user object');
      }
      
      // Store TikTok tokens if available
      const tiktokAccounts = userData.providerData.tiktok;
      if (tiktokAccounts && Array.isArray(tiktokAccounts)) {
        console.log('Found TikTok accounts:', tiktokAccounts.length);
        
        // Mark that social media data was loaded from DB
        localStorage?.setItem('socialMediaLoaded', 'true');
        localStorage?.setItem('socialMediaLoadTime', Date.now().toString());
        
        // Get existing accounts from localStorage
        const existingAccounts = [];
        let i = 1;
        while (true) {
          const token = localStorage?.getItem(`tiktok${i}AccessToken`);
          const openId = localStorage?.getItem(`tiktok${i}OpenId`);
          if (!token || !openId) break;
          
          existingAccounts.push({
            accessToken: token,
            openId,
            refreshToken: localStorage?.getItem(`tiktok${i}RefreshToken`),
            username: localStorage?.getItem(`tiktok${i}Username`),
            displayName: localStorage?.getItem(`tiktok${i}DisplayName`),
            avatarUrl: localStorage?.getItem(`tiktok${i}AvatarUrl`),
            avatarUrl100: localStorage?.getItem(`tiktok${i}AvatarUrl100`),
            index: i
          });
          i++;
        }
        
        // Merge backend accounts with existing accounts
        const mergedAccounts = [...existingAccounts];
        const existingOpenIds = new Set(existingAccounts.map(acc => acc.openId));
        
        tiktokAccounts.forEach(account => {
          if (!existingOpenIds.has(account.openId)) {
            const nextIndex = mergedAccounts.length + 1;
            mergedAccounts.push({
              ...account,
              index: nextIndex
            });
          }
        });
        
        // Store merged accounts in localStorage
        mergedAccounts.forEach((account, index) => {
          const accountIndex = index + 1;
          console.log(`Storing TikTok account ${accountIndex}:`, {
            hasAccessToken: !!account.accessToken,
            hasOpenId: !!account.openId,
            hasRefreshToken: !!account.refreshToken,
            username: account.username || `TikTok Account ${accountIndex}`
          });
          
          if (account.accessToken) localStorage?.setItem(`tiktok${accountIndex}AccessToken`, account.accessToken);
          if (account.openId) localStorage?.setItem(`tiktok${accountIndex}OpenId`, account.openId);
          if (account.refreshToken) localStorage?.setItem(`tiktok${accountIndex}RefreshToken`, account.refreshToken);
          if (account.username) localStorage?.setItem(`tiktok${accountIndex}Username`, account.username);
          if (account.displayName) localStorage?.setItem(`tiktok${accountIndex}DisplayName`, account.displayName);
          if (account.avatarUrl) localStorage?.setItem(`tiktok${accountIndex}AvatarUrl`, account.avatarUrl);
          if (account.avatarUrl100) localStorage?.setItem(`tiktok${accountIndex}AvatarUrl100`, account.avatarUrl100);
        });
      } else {
        console.log('No TikTok accounts found in user object or not an array:', tiktokAccounts);
      }
    } catch (error) {
      console.error('Error storing social media tokens:', error);
    }
  };

  // Update the utility functions
  const clearAllTwitterStorage = () => {
    try {
      console.log('Clearing all Twitter storage');
      
      // Clear handle-based format
      const keysToClear = [];
      
      // Find all Twitter keys in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
            key.startsWith('twitterAccessToken_') || 
            key.startsWith('twitterUserId_') ||
            key.startsWith('twitterAccessTokenSecret_') ||
            key.startsWith('twitterUsername_') ||
            key.startsWith('twitterName_') ||
            key.startsWith('twitterProfileImage_')
          )) {
          keysToClear.push(key);
        }
      }
      
      // Clear all found keys
      keysToClear.forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Clear numbered format (for backwards compatibility during migration)
      let i = 1;
      while (localStorage?.getItem(`twitter${i}AccessToken`)) {
        localStorage?.removeItem(`twitter${i}AccessToken`);
        localStorage?.removeItem(`twitter${i}UserId`);
        localStorage?.removeItem(`twitter${i}AccessTokenSecret`);
        localStorage?.removeItem(`twitter${i}Username`);
        localStorage?.removeItem(`twitter${i}Name`);
        localStorage?.removeItem(`twitter${i}ProfileImage`);
        i++;
      }
      
      // Clear legacy format
      localStorage?.removeItem('twitter_access_token');
      localStorage?.removeItem('twitter_access_token_secret');
      localStorage?.removeItem('twitter_refresh_token');
      localStorage?.removeItem('twitter_user_id');
      localStorage?.removeItem('twitter_username');
      
      console.log('Twitter storage cleared');
    } catch (error) {
      console.error('Error clearing Twitter storage:', error);
    }
  };

  const clearTwitterStorage = () => {
    try {
      console.log('Clearing Twitter storage');
      
      // Clear socialMediaData structure
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      
      if (socialMediaDataStr) {
        const socialMediaData = JSON.parse(socialMediaDataStr);
        
        if (socialMediaData) {
          socialMediaData.twitter = [];
          localStorage?.setItem('socialMediaData', JSON.stringify(socialMediaData));
        }
      }
      
      // Check for each account
      let i = 0;
      while (localStorage?.getItem(`twitter_account_${i}`)) {
        localStorage?.removeItem(`twitter_account_${i}`);
        i++;
      }
      
      // Clear legacy format
      localStorage?.removeItem('twitter_access_token');
      localStorage?.removeItem('twitter_access_token_secret');
      localStorage?.removeItem('twitter_refresh_token');
      localStorage?.removeItem('twitter_user_id');
      localStorage?.removeItem('twitter_username');
      
      console.log('Twitter storage cleared');
    } catch (error) {
      console.error('Error clearing Twitter storage:', error);
    }
  };

  // Store social media tokens in the unified socialMediaData structure
  const storeSocialMediaDataStructure = (userData) => {
    try {
      console.log('Starting storage of social media data. Full userData:', userData);
      
      if (!userData) {
        console.warn('userData is null or undefined');
        return;
      }
      
      // Store Firebase UID for consistent identification
      if (userData.uid) {
        // Always use Firebase UID as the primary identifier
        localStorage?.setItem('firebaseUid', userData.uid);
        localStorage?.setItem('userId', userData.uid); // Ensure userId is always the same as Firebase UID
        console.log('Stored Firebase UID in localStorage as both firebaseUid and userId:', userData.uid);
      } else if (userData.data?.uid) {
        // Alternative path if uid is nested in data object
        localStorage?.setItem('firebaseUid', userData.data.uid);
        localStorage?.setItem('userId', userData.data.uid);
        console.log('Stored nested Firebase UID in localStorage as both firebaseUid and userId:', userData.data.uid);
      }
      
      // Check for different possible structures in the API response
      const providerData = userData.providerData || userData.data?.providerData || userData;
      
      console.log('Extracted providerData:', providerData);
      
      if (!providerData) {
        console.warn('No providerData found in userData');
        return;
      }
      
      // Initialize or get existing socialMediaData
      let socialMediaData = {};
      try {
        const existingData = localStorage.getItem('socialMediaData');
        if (existingData) {
          socialMediaData = JSON.parse(existingData);
          console.log('Found existing socialMediaData:', socialMediaData);
        }
      } catch (error) {
        console.error('Error parsing existing socialMediaData:', error);
        socialMediaData = {};
      }
      
      // Process Twitter accounts - handle different potential structures
      const twitterData = providerData.twitter || userData.twitter || (userData.data && userData.data.twitter);
      
      if (twitterData) {
        console.log('Found Twitter data:', twitterData);
        
        const twitterAccounts = Array.isArray(twitterData) 
          ? twitterData 
          : [twitterData];
          
        console.log(`Processing ${twitterAccounts.length} Twitter accounts`);
        
        // Map each account to our standardized format
        const formattedAccounts = twitterAccounts
          .filter(account => account) // Filter out null/undefined accounts
          .map(account => ({
            accessToken: account.accessToken || account.access_token,
            accessTokenSecret: account.accessTokenSecret || account.access_token_secret,
            userId: account.userId || account.user_id,
            username: account.username || account.screen_name,
            name: account.name || account.displayName || account.username || '',
            profileImageUrl: account.profileImageUrl || account.profile_image_url || ''
          }))
          .filter(account => account.accessToken && account.accessTokenSecret);
        
        console.log(`Formatted ${formattedAccounts.length} valid Twitter accounts:`, formattedAccounts);
        
        // Only update if we have valid accounts
        if (formattedAccounts.length > 0) {
          socialMediaData.twitter = formattedAccounts;
          console.log(`Stored ${socialMediaData.twitter.length} valid Twitter accounts in socialMediaData`);
          
          // Set a flag to indicate we successfully loaded Twitter data
          localStorage.setItem('twitterStorageMigrated', 'true');
        } else {
          console.warn('No valid Twitter accounts found to store');
        }
      } else {
        console.log('No Twitter data found');
      }
      
      // Save the unified structure to localStorage
      localStorage.setItem('socialMediaData', JSON.stringify(socialMediaData));
      localStorage.setItem('socialMediaDataUpdated', Date.now().toString());
      
      console.log('Final socialMediaData stored in localStorage:', socialMediaData);
      return socialMediaData;
    } catch (error) {
      console.error('Error storing social media data in unified structure:', error);
      return null;
    }
  };

  // Authentication state effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setLoading(true);
        
        if (user) {
          setUser(user);
          
          // Get user data from database
          try {
            let userData = await getUserByUid(user.uid);
            
            // If user not found in database, create it
            if (!userData?.success || !userData?.data) {
              console.log('User not found in database, creating...', user.uid);
              // Prepare user data for database
              const userToCreate = {
                uid: user.uid,
                email: user?.email,
                displayName: user?.displayName,
                photoURL: user?.photoURL
              };
              // Create or update user in database
              userData = await createOrUpdateUser(userToCreate);
              console.log('User created in database:', userData);
            }
            
            setDbUser(userData?.data);
            
            // Store social media tokens from user data
            storeSocialMediaTokens(userData);
            
            // Store in the new unified socialMediaData structure
            storeSocialMediaDataStructure(userData);
            
            // Set the flag indicating auth is complete
            window.sessionStorage.setItem('authComplete', 'true');
            
            // Check for post-login redirect
            if (redirectAfterLogin) {
              window.location.href = '/social-posting';
              setRedirectAfterLogin(false);
            }
          } catch (error) {
            console.error('Error fetching/creating user data:', error);
          }
        } else {
          setUser(null);
          setDbUser(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [redirectAfterLogin]);

  // Add an effect to ensure userId and firebaseUid are always synchronized
  useEffect(() => {
    // This effect runs only in the browser
    if (typeof window === 'undefined') return;
    
    try {
      // Get current values
      const firebaseUid = localStorage?.getItem('firebaseUid');
      const userId = localStorage?.getItem('userId');
      
      if (firebaseUid) {
        // If firebaseUid exists but doesn't match userId, update userId
        if (!userId || userId !== firebaseUid) {
          localStorage?.setItem('userId', firebaseUid);
          console.log('Synchronized userId to match firebaseUid:', firebaseUid);
        }
      } else if (userId) {
        // If userId exists but no firebaseUid, use userId as firebaseUid
        localStorage?.setItem('firebaseUid', userId);
        console.log('Synchronized firebaseUid to match userId:', userId);
      }
      // If neither exists, we'll wait for auth to set them
    } catch (error) {
      console.error('Error synchronizing user IDs:', error);
    }
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Immediately set the Firebase UID in localStorage for consistent identification
      if (result?.user?.uid) {
        localStorage?.setItem('firebaseUid', result.user.uid);
        localStorage?.setItem('userId', result.user.uid); // Ensure userId is always the same as Firebase UID
        console.log('Set Firebase UID in localStorage after Google login:', result.user.uid);
      }
      
      // Create or update user in database immediately after Google login
      if (result?.user) {
        try {
          const userToCreate = {
            uid: result.user.uid,
            email: result.user?.email,
            displayName: result.user?.displayName,
            photoURL: result.user?.photoURL
          };
          const userData = await createOrUpdateUser(userToCreate);
          console.log('User created/updated in database after Google login:', userData);
        } catch (error) {
          console.error('Error creating user after Google login:', error);
        }
      }
      
      setRedirectAfterLogin(true);
      return { success: true };
    } catch (error) {
      console.error('Error signing in with Google:', error);
      return { success: false, error: error?.message };
    } finally {
      setLoading(false);
    }
  };

  // Clear user identification data from localStorage
  const clearUserIdentification = () => {
    try {
      console.log('Clearing user identification data from localStorage');
      
      // Remove user IDs
      localStorage?.removeItem('firebaseUid');
      localStorage?.removeItem('userId');
      localStorage?.removeItem('userEmail');
      localStorage?.removeItem('userName');
      
      // Mark authentication as incomplete
      window.sessionStorage?.removeItem('authComplete');
      
      console.log('User identification data cleared from localStorage');
    } catch (error) {
      console.error('Error clearing user identification data:', error);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      // Clear user identification data before logging out
      clearUserIdentification();
      
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      return { success: false, error: error?.message };
    } finally {
      setLoading(false);
    }
  };

  // Combine the basic Firebase user with our extended database user info
  const combinedUser = user ? {
    ...user,
    role: dbUser?.role || 'Free',
    isPro: dbUser?.role === 'Pro',
    subscriptionStartDate: dbUser?.subscriptionStartDate,
    subscriptionEndDate: dbUser?.subscriptionEndDate,
    // Add any other properties you want to expose from dbUser
  } : null;

  return (
    <AuthContext.Provider value={{ 
      user: combinedUser, 
      loading, 
      redirectAfterLogin,
      setRedirectAfterLogin,
      signInWithGoogle, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
}; 