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
        localStorage?.setItem('firebaseUid', userData.uid);
        localStorage?.setItem('userId', userData.uid); // Also set userId to Firebase UID for consistency
        console.log('Stored Firebase UID in localStorage:', userData.uid);
      }
      
      // Store Twitter tokens if available
      const twitterData = userData.providerData.twitter;
      if (twitterData) {
        console.log('Found Twitter data:', {
          hasAccessToken: !!twitterData.accessToken,
          hasRefreshToken: !!twitterData.refreshToken,
          hasUserId: !!twitterData.userId,
          hasUsername: !!twitterData.username
        });
        
        if (twitterData.accessToken) localStorage?.setItem('twitter_access_token', twitterData.accessToken);
        if (twitterData.refreshToken) {
          localStorage?.setItem('twitter_refresh_token', twitterData.refreshToken);
          localStorage?.setItem('twitter_access_token_secret', twitterData.refreshToken);
        }
        if (twitterData.userId) localStorage?.setItem('twitter_user_id', twitterData.userId);
        if (twitterData.username) localStorage?.setItem('twitter_username', twitterData.username);
      } else {
        console.log('No Twitter data found in user object');
      }
      
      // Store TikTok tokens if available
      const tiktokAccounts = userData.providerData.tiktok;
      if (tiktokAccounts && Array.isArray(tiktokAccounts)) {
        console.log('Found TikTok accounts:', tiktokAccounts.length);
        
        // Clear existing TikTok accounts
        let i = 1;
        while (localStorage?.getItem(`tiktok${i}AccessToken`)) {
          localStorage?.removeItem(`tiktok${i}AccessToken`);
          localStorage?.removeItem(`tiktok${i}OpenId`);
          localStorage?.removeItem(`tiktok${i}RefreshToken`);
          localStorage?.removeItem(`tiktok${i}Username`);
          i++;
        }
        
        // Store new TikTok accounts
        tiktokAccounts.forEach((account, index) => {
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
        });
      } else {
        console.log('No TikTok accounts found in user object or not an array:', tiktokAccounts);
      }
    } catch (error) {
      console.error('Error storing social media tokens:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Set the basic user info from Firebase
          const basicUser = {
            uid: firebaseUser?.uid,
            email: firebaseUser?.email,
            displayName: firebaseUser?.displayName,
            photoURL: firebaseUser?.photoURL
          };
          
          setUser(basicUser);
          
          // Save user to our database and get extended user info
          try {
            // Create or update user in our database
            await createOrUpdateUser(basicUser);
            
            // Get the latest user data from our database
            const userResponse = await getUserByUid(firebaseUser?.uid);
            if (userResponse?.success && userResponse?.data) {
              setDbUser(userResponse?.data);
              
              // Store social media tokens in localStorage
              storeSocialMediaTokens(userResponse?.data);
            }
          } catch (dbError) {
            console.error('Error syncing user with database:', dbError);
            // We still continue with the Firebase user data even if DB sync fails
          }
        } else {
          setUser(null);
          setDbUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setRedirectAfterLogin(true);
      return { success: true };
    } catch (error) {
      console.error('Error signing in with Google:', error);
      return { success: false, error: error?.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
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