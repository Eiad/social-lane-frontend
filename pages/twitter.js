import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Home.module.scss';
import twitterStyles from '../styles/Twitter.module.css';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';

// API base URL
const API_BASE_URL = 'https://sociallane-backend.mindio.chat';

// Twitter icon component
const TwitterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
  </svg>
);

export default function Twitter() {
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
  const fetchUserInfo = async (token) => {
    try {
      const response = await fetch(`${apiUrl}/twitter/user-info`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response?.json();
      if (response?.ok && data?.data) {
        setUserInfo(data.data);
      } else {
        console.error('Failed to fetch user info:', data);
      }
    } catch (error) {
      console.error('Error fetching user info:', error?.message);
    }
  };

  // Check for authentication on page load
  useEffect(() => {
    // Check if we have query parameters from the OAuth callback
    const { access_token, refresh_token, user_id, username, error } = router.query;
    
    if (error) {
      console.error('Authentication error:', error);
      return;
    }
    
    if (access_token) {
      // Store the tokens in state
      setAccessToken(access_token);
      setRefreshToken(refresh_token || null);
      setUserId(user_id || null);
      setUsername(username || null);
      setIsAuthenticated(true);
      
      // Fetch user info
      fetchUserInfo(access_token);
      
      // Clean up the URL to remove the tokens
      router.replace('/twitter', undefined, { shallow: true });
    } else {
      // Check if we have tokens in localStorage
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
        
        // Fetch user info
        fetchUserInfo(storedAccessToken);
      }
    }
  }, [router.query, router]);
  
  // Store tokens in localStorage when they change
  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('twitter_access_token', accessToken);
      if (refreshToken) localStorage.setItem('twitter_refresh_token', refreshToken);
      if (userId) localStorage.setItem('twitter_user_id', userId);
      if (username) localStorage.setItem('twitter_username', username);
    }
  }, [accessToken, refreshToken, userId, username]);

  // Handle Twitter authentication
  const handleConnect = async () => {
    try {
      setIsLoading(true);
      
      // Get the auth URL from the backend
      const response = await fetch(`${apiUrl}/twitter/auth`);
      const data = await response?.json();
      
      if (response?.ok && data?.authUrl) {
        // Store the state for verification later
        localStorage.setItem('twitter_auth_state', data.state);
        
        // Redirect to the Twitter auth URL
        window.location.href = data.authUrl;
      } else {
        console.error('Failed to get auth URL:', data);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error connecting to Twitter:', error?.message);
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
    
    if (!videoUrl || !accessToken) {
      setUploadError('Video URL and authentication are required');
      return;
    }
    
    setIsPosting(true);
    setCurrentStep('preparing');
    setPostSuccess(false);
    
    try {
      setCurrentStep('posting');
      
      // Post the video to Twitter
      const response = await axios.post(`${apiUrl}/twitter/post-media`, {
        videoUrl,
        accessToken,
        text: tweetText || 'Check out this video!'
      });
      
      if (response?.data?.data?.success) {
        setPostSuccess(true);
        setCurrentStep('success');
      } else {
        throw new Error('Failed to post tweet');
      }
    } catch (error) {
      console.error('Error posting tweet:', error?.response?.data || error?.message);
      setUploadError(`Failed to post tweet: ${error?.response?.data?.error || error?.message || 'Unknown error'}`);
      setCurrentStep(null);
    } finally {
      setIsPosting(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    setAccessToken(null);
    setRefreshToken(null);
    setUserId(null);
    setUsername(null);
    setUserInfo(null);
    
    // Clear localStorage
    localStorage.removeItem('twitter_access_token');
    localStorage.removeItem('twitter_refresh_token');
    localStorage.removeItem('twitter_user_id');
    localStorage.removeItem('twitter_username');
  };

  // Go to home page
  const goToHome = () => {
    router.push('/');
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Twitter Integration | Social Lane</title>
        <meta name="description" content="Post videos to Twitter with Social Lane" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span className={styles.titleIcon}><TwitterIcon /></span>
            Twitter Integration
          </h1>
          <div className={styles.nav}>
            <button onClick={goToHome} className={styles.backButton}>
              &larr; Back to Home
            </button>
          </div>
        </div>

        <div className={styles.card}>
          {!isAuthenticated ? (
            <div className={styles.authSection}>
              <h2>Connect to Twitter</h2>
              <p>Authenticate with Twitter to post videos to your account.</p>
              <button 
                onClick={handleConnect} 
                className={styles.connectButton}
                disabled={isLoading}
              >
                {isLoading ? 'Connecting...' : 'Connect Twitter Account'}
              </button>
            </div>
          ) : (
            <div className={styles.authenticatedSection}>
              <div className={styles.userInfo}>
                <h2>Connected to Twitter</h2>
                {userInfo && (
                  <div className={styles.userProfile}>
                    {userInfo.profile_image_url && (
                      <img 
                        src={userInfo.profile_image_url} 
                        alt={userInfo.name} 
                        className={styles.profileImage}
                      />
                    )}
                    <div className={styles.userDetails}>
                      <p className={styles.userName}>{userInfo.name}</p>
                      <p className={styles.userHandle}>@{userInfo.username}</p>
                    </div>
                  </div>
                )}
                <button onClick={handleLogout} className={styles.logoutButton}>
                  Disconnect
                </button>
              </div>

              <div className={styles.uploadSection}>
                {postStep === 1 ? (
                  <>
                    <h3>Upload Video</h3>
                    <p>Select a video to upload and post to Twitter.</p>
                    
                    <div className={styles.uploadControls}>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileChange}
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                      />
                      
                      {!uploadedFile ? (
                        <button 
                          onClick={handleUploadClick} 
                          className={styles.uploadButton}
                          disabled={isUploading}
                        >
                          Select Video
                        </button>
                      ) : (
                        <div className={styles.fileInfo}>
                          <p>Selected: {uploadedFile.name}</p>
                          <button 
                            onClick={handleFileUpload} 
                            className={styles.uploadButton}
                            disabled={isUploading}
                          >
                            {isUploading ? 'Uploading...' : 'Upload Video'}
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {isUploading && (
                      <div className={styles.progressContainer}>
                        <div 
                          className={styles.progressBar} 
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                        <p>{uploadProgress}% Uploaded</p>
                      </div>
                    )}
                    
                    {uploadError && (
                      <div className={styles.errorMessage}>
                        {uploadError}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h3>Preview & Post</h3>
                    
                    <div className={styles.previewSection}>
                      {videoUrl && (
                        <video 
                          src={videoUrl} 
                          controls 
                          className={styles.videoPreview}
                          ref={videoRef}
                        />
                      )}
                      
                      <div className={styles.captionSection}>
                        <textarea
                          value={tweetText}
                          onChange={(e) => setTweetText(e.target.value)}
                          placeholder="Write your tweet text..."
                          className={styles.captionInput}
                          maxLength={280}
                        />
                        <p className={styles.charCount}>
                          {tweetText.length}/280 characters
                        </p>
                      </div>
                      
                      <div className={styles.postActions}>
                        <button 
                          onClick={() => setPostStep(1)} 
                          className={styles.backButton}
                          disabled={isPosting}
                        >
                          Back
                        </button>
                        <button 
                          onClick={handlePostTweet} 
                          className={styles.postButton}
                          disabled={isPosting || postSuccess}
                        >
                          {isPosting ? 'Posting...' : postSuccess ? 'Posted!' : 'Post to Twitter'}
                        </button>
                      </div>
                    </div>
                    
                    {uploadError && (
                      <div className={styles.errorMessage}>
                        {uploadError}
                      </div>
                    )}
                    
                    {postSuccess && (
                      <div className={styles.successMessage}>
                        <p>Tweet posted successfully!</p>
                        <button 
                          onClick={() => {
                            setPostStep(1);
                            setFile(null);
                            setUploadedFile(null);
                            setVideoUrl('');
                            setTweetText('');
                            setPostSuccess(false);
                          }} 
                          className={styles.newPostButton}
                        >
                          Post Another Video
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 