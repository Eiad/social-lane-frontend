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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Set the basic user info from Firebase
          const basicUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL
          };
          
          setUser(basicUser);
          
          // Save user to our database and get extended user info
          try {
            // Create or update user in our database
            await createOrUpdateUser(basicUser);
            
            // Get the latest user data from our database
            const userResponse = await getUserByUid(firebaseUser.uid);
            if (userResponse?.success && userResponse?.data) {
              setDbUser(userResponse.data);
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
      return { success: false, error: error.message };
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
      return { success: false, error: error.message };
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