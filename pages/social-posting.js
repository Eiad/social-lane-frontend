import { useState, useRef, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/SocialPosting.module.css';
import { TikTokSimpleIcon, TwitterIcon } from '../src/components/icons/SocialIcons';
import ProtectedRoute from '../src/components/ProtectedRoute';
import Navigation from '../src/components/Navigation';
import axios from 'axios';

const API_BASE_URL = 'https://sociallane-backend.mindio.chat';

function SocialPosting() {
  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [caption, setCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [platformResults, setPlatformResults] = useState({});
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [userId, setUserId] = useState('');
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [tiktokAccounts, setTiktokAccounts] = useState([]);
  const [selectedTiktokAccounts, setSelectedTiktokAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  useEffect(() => {
    // Use Firebase UID if available, otherwise fallback to stored userId or generate a new one
    const firebaseUid = localStorage?.getItem('firebaseUid');
    if (firebaseUid) {
      setUserId(firebaseUid);
      localStorage?.setItem('userId', firebaseUid); // Ensure userId is also set to the Firebase UID
    } else {
      const storedUserId = localStorage?.getItem('userId');
      if (storedUserId) {
        setUserId(storedUserId);
      } else {
        const newUserId = crypto.randomUUID();
        localStorage?.setItem('userId', newUserId);
        setUserId(newUserId);
      }
    }
    
    // Load TikTok accounts on component mount
    loadTikTokAccounts();
    
    // If Twitter is connected, add it to selected platforms
    const twitterConnected = localStorage?.getItem('twitter_access_token');
    if (twitterConnected) {
      setSelectedPlatforms(prev => {
        if (!prev.includes('twitter')) {
          return [...prev, 'twitter'];
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    loadTikTokAccounts();
  }, []);

  const loadTikTokAccounts = () => {
    const accounts = [];
    let i = 1;
    while (true) {
      const token = localStorage?.getItem(`tiktok${i}AccessToken`);
      const openId = localStorage?.getItem(`tiktok${i}OpenId`);
      const refreshToken = localStorage?.getItem(`tiktok${i}RefreshToken`);
      const username = localStorage?.getItem(`tiktok${i}Username`);
      
      if (!token || !openId) break;
      
      accounts.push({
        accessToken: token,
        openId,
        refreshToken,
        username: username || `TikTok Account ${i}`,
        index: i
      });
      i++;
    }
    
    setTiktokAccounts(accounts);
    
    // If we found TikTok accounts, update selectedPlatforms
    if (accounts.length > 0) {
      setSelectedPlatforms(prev => {
        if (!prev.includes('tiktok')) {
          return [...prev, 'tiktok'];
        }
        return prev;
      });
    }
  };

  const handleTikTokAccountToggle = (account) => {
    if (!account?.openId) return;
    
    setSelectedTiktokAccounts(prev => {
      const isSelected = prev.some(acc => acc?.openId === account?.openId);
      const newSelectedAccounts = isSelected 
        ? prev.filter(acc => acc?.openId !== account?.openId)
        : [...prev, account];
      
      // Also update selectedPlatforms based on if we have any accounts selected
      if (newSelectedAccounts.length > 0 && !selectedPlatforms.includes('tiktok')) {
        setSelectedPlatforms(prev => [...prev, 'tiktok']);
      } else if (newSelectedAccounts.length === 0 && selectedPlatforms.includes('tiktok')) {
        setSelectedPlatforms(prev => prev.filter(p => p !== 'tiktok'));
      }
      
      return newSelectedAccounts;
    });
  };

  const handlePlatformToggle = (platform) => {
    console.log(`Toggling platform: ${platform}`);
    
    setSelectedPlatforms(prev => {
      // Check if the platform is already selected
      if (prev.includes(platform)) {
        // If platform is TikTok, clear selected TikTok accounts
        if (platform === 'tiktok') {
          setSelectedTiktokAccounts([]);
        }
        // Remove the platform from the selected platforms
        return prev.filter(p => p !== platform);
      }
      // Add the platform to the selected platforms
      return [...prev, platform];
    });
  };

  const handleFileChange = (e) => {
    const selectedFile = e?.target?.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadedFile(selectedFile?.name);
      setUploadError(null);
      setVideoUrl('');
      setPostSuccess(false);
    }
  };

  const handleChangeFile = () => {
    // Don't allow changing file during upload or processing
    if (isUploading || isProcessing) return;
    
    setFile(null);
    setUploadedFile(null);
    setVideoUrl('');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleUploadClick = () => {
    // Don't allow clicking during upload or processing
    if (isUploading || isProcessing) return;
    
    fileInputRef.current?.click();
  };

  const handleFileUpload = async () => {
    if (!file) return;
    
    setUploadError(null);
    setIsUploading(true);
    setIsProcessing(false);
    setUploadProgress(0);
    
    try {
      if (!file?.type?.startsWith('video/')) {
        throw new Error('Please select a video file');
      }
      
      if (file?.size > 500 * 1024 * 1024) {
        throw new Error('File size exceeds 500MB limit');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event?.lengthComputable) {
          const percentCompleted = Math.round((event?.loaded * 100) / (event?.total || 1));
          setUploadProgress(percentCompleted);
          
          // Set processing state when upload reaches 100%
          if (percentCompleted === 100) {
            setIsProcessing(true);
          }
        }
      });

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = function() {
          if (xhr?.status >= 200 && xhr?.status < 300) {
            try {
              const response = JSON.parse(xhr?.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr?.status}`));
          }
        };
        
        xhr.onerror = () => reject(new Error('Network error during upload'));
      });

      xhr.open('POST', '/api/upload', true);
      xhr.send(formData);
      
      const data = await uploadPromise;
      
      if (data?.success && data?.url) {
        setVideoUrl(data?.url);
        window.showToast?.success?.('File uploaded successfully');
        setCurrentStep(2);
      } else {
        throw new Error('Failed to get upload URL');
      }
    } catch (error) {
      setUploadError(error?.message || 'Error uploading file');
      window.showToast?.error?.(error?.message || 'Error uploading file');
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
      if (fileInputRef?.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePost = async () => {
    if (!videoUrl || selectedPlatforms?.length === 0) return;
    
    if (selectedPlatforms?.includes('tiktok') && selectedTiktokAccounts?.length === 0) {
      window.showToast?.warning?.('Please select at least one TikTok account to post to');
      return;
    }
    
    try {
      setIsPosting(true);
      setUploadError(null);
      setPlatformResults({});
      
      const twitterAccessToken = localStorage?.getItem('twitter_access_token');
      let twitterAccessTokenSecret = localStorage?.getItem('twitter_access_token_secret');
      const twitterRefreshToken = localStorage?.getItem('twitter_refresh_token');
      
      if (!twitterAccessTokenSecret) {
        twitterAccessTokenSecret = twitterRefreshToken;
        if (twitterAccessTokenSecret) {
          localStorage?.setItem('twitter_access_token_secret', twitterAccessTokenSecret);
        }
      }
      
      if (selectedPlatforms?.includes('twitter') && (!twitterAccessToken || !twitterAccessTokenSecret)) {
        window.showToast?.warning?.('Twitter credentials are missing. Please connect your Twitter account first.');
      }
      
      if (isScheduled && scheduledDate && scheduledTime) {
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        
        if (scheduledDateTime <= new Date()) {
          throw new Error('Scheduled time must be in the future');
        }
        
        console.log('Scheduling post to:', `${API_BASE_URL}/posts`);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);
          
          const requestBody = {
            video_url: videoUrl,
            post_description: caption,
            platforms: selectedPlatforms,
            userId: userId,
            isScheduled: true,
            scheduledDate: scheduledDateTime.toISOString(),
            ...(selectedPlatforms?.includes('tiktok') ? {
              tiktok_accounts: selectedTiktokAccounts?.map(account => ({
                accessToken: account?.accessToken,
                refreshToken: account?.refreshToken,
                openId: account?.openId
              }))
            } : {}),
            ...(selectedPlatforms?.includes('twitter') && twitterAccessToken ? {
              twitter_access_token: twitterAccessToken,
              twitter_access_token_secret: twitterAccessTokenSecret,
              twitter_refresh_token: twitterRefreshToken
            } : {})
          };
          
          const response = await fetch(`${API_BASE_URL}/posts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify(requestBody),
          });
          
          clearTimeout(timeoutId);
          
          if (!response?.ok) {
            throw new Error('Failed to schedule post');
          }
          
          setPostSuccess(true);
          window.showToast?.success?.('Post scheduled successfully!');
          
          setVideoUrl('');
          setUploadedFile(null);
          setSelectedPlatforms([]);
          setSelectedTiktokAccounts([]);
          setCaption('');
          setCurrentStep(1);
          setIsScheduled(false);
          setScheduledDate('');
          setScheduledTime('');
          
          return;
        } catch (error) {
          console.error('Error scheduling post:', error);
          throw new Error('Failed to schedule post: ' + error?.message);
        }
      }
      
      const results = {};
      
      if (selectedPlatforms?.includes('tiktok')) {
        results.tiktok = [];
        
        for (const account of selectedTiktokAccounts) {
          try {
            const response = await fetch(`${API_BASE_URL}/tiktok/post-video`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                videoUrl,
                accessToken: account?.accessToken,
                refreshToken: account?.refreshToken,
                caption
              }),
            });
            
            const data = await response?.json();
            
            if (response?.ok) {
              results.tiktok.push({
                success: true,
                accountId: account?.openId,
                username: account?.username,
                message: data?.message
              });
            } else {
              throw new Error(data?.error || 'Failed to post to TikTok');
            }
          } catch (error) {
            results.tiktok.push({
              success: false,
              accountId: account?.openId,
              username: account?.username,
              error: error?.message
            });
          }
        }
      }
      
      if (selectedPlatforms?.includes('twitter') && twitterAccessToken && twitterAccessTokenSecret) {
        try {
          const response = await fetch(`${API_BASE_URL}/twitter/post-video`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              videoUrl,
              accessToken: twitterAccessToken,
              accessTokenSecret: twitterAccessTokenSecret,
              text: caption
            }),
          });
          
          const data = await response?.json();
          
          if (response?.ok) {
            results.twitter = { success: true, message: data?.message };
          } else {
            throw new Error(data?.error || 'Failed to post to Twitter');
          }
        } catch (error) {
          results.twitter = { success: false, error: error?.message };
        }
      }
      
      setPlatformResults(results);
      
      const allSuccess = Object.values(results).every(result => {
        if (Array.isArray(result)) {
          return result.every(r => r?.success);
        }
        return result?.success;
      });
      
      if (allSuccess) {
        setPostSuccess(true);
        window.showToast?.success?.('Posted successfully to all platforms!');
        
        setVideoUrl('');
        setUploadedFile(null);
        setSelectedPlatforms([]);
        setSelectedTiktokAccounts([]);
        setCaption('');
        setCurrentStep(1);
      } else {
        window.showToast?.warning?.('Some posts failed. Check the results for details.');
      }
    } catch (error) {
      console.error('Error posting:', error);
      setUploadError(error?.message);
      window.showToast?.error?.(error?.message);
    } finally {
      setIsPosting(false);
    }
  };

  const filteredTiktokAccounts = useMemo(() => {
    return tiktokAccounts.filter(account => 
      account.username?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tiktokAccounts, searchTerm]);

  const filteredTwitterAccounts = useMemo(() => {
    const twitterUsername = localStorage?.getItem('twitter_username');
    if (!twitterUsername) return [];
    return twitterUsername.toLowerCase().includes(searchTerm.toLowerCase()) ? [twitterUsername] : [];
  }, [searchTerm]);

  const renderTikTokAccounts = () => {
    if (!selectedPlatforms.includes('tiktok')) return null;
    
    if (tiktokAccounts.length === 0) {
      return (
        <div className={styles.noAccountsMessage}>
          <p>No TikTok accounts connected.</p>
          <Link href="/tiktok" legacyBehavior>
            <a className={styles.connectLink}>
              <button className={styles.connectButton} type="button">
                <TikTokSimpleIcon width="20" height="20" />
                Connect TikTok Account
              </button>
            </a>
          </Link>
        </div>
      );
    }

    return (
      <div className={styles.accountsSection}>
        <h3>Select TikTok Accounts</h3>
        <div className={styles.accountsList}>
          {tiktokAccounts.map(account => (
            <div 
              key={account.openId}
              className={`${styles.accountCard} ${
                selectedTiktokAccounts.some(acc => acc.openId === account.openId) 
                  ? styles.selectedAccount 
                  : ''
              }`}
              onClick={() => handleTikTokAccountToggle(account)}
            >
              <div className={styles.accountInfo}>
                <TikTokSimpleIcon width="24" height="24" />
                <span className={styles.accountName}>{account.username}</span>
              </div>
              <input
                type="checkbox"
                checked={selectedTiktokAccounts.some(acc => acc.openId === account.openId)}
                onChange={(e) => {
                  e.stopPropagation();
                  handleTikTokAccountToggle(account);
                }}
                className={styles.accountCheckbox}
              />
            </div>
          ))}
        </div>
        <Link href="/tiktok" legacyBehavior>
          <a className={styles.connectLink}>
            <button className={styles.addAccountButton} type="button">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              Add Another TikTok Account
            </button>
          </a>
        </Link>
      </div>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className={styles.stepContainer}>
            <div className={styles.stepTitle}>
              <h2>Upload Your Media</h2>
            </div>
            <div className={styles.uploadArea}>
              {videoUrl ? (
                <div className={styles.videoPreviewContainer}>
                  <video 
                    className={styles.videoPreview} 
                    src={videoUrl} 
                    controls 
                    ref={videoRef}
                  />
                  <div className={styles.videoControls}>
                    <button 
                      className={styles.changeFileButton} 
                      onClick={handleChangeFile}
                      disabled={isUploading || isProcessing}
                      style={{ opacity: isUploading || isProcessing ? 0.6 : 1, cursor: isUploading || isProcessing ? 'not-allowed' : 'pointer' }}
                    >
                      Change Video
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div 
                    className={`${styles.dropzone} ${isUploading ? styles.uploadingState : ''}`}
                    onClick={!isUploading && !isProcessing ? handleUploadClick : undefined}
                    style={{ cursor: isUploading || isProcessing ? 'default' : 'pointer' }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className={styles.fileInput}
                      onChange={handleFileChange}
                      accept="video/*"
                      disabled={isUploading || isProcessing}
                    />
                    {isUploading ? (
                      <div className={styles.uploadingContainer}>
                        <div className={styles.progressRing}>
                          <svg className={styles.progressCircle} viewBox="0 0 120 120">
                            <circle
                              className={styles.progressCircleTrack}
                              cx="60"
                              cy="60"
                              r="54"
                              fill="none"
                              strokeWidth="12"
                            />
                            <circle
                              className={`${styles.progressCircleIndicator} ${isProcessing ? styles.processingAnimation : ''}`}
                              cx="60"
                              cy="60"
                              r="54"
                              fill="none"
                              strokeWidth="12"
                              strokeDasharray="339.292"
                              strokeDashoffset={isProcessing ? 0 : 339.292 * (1 - (uploadProgress || 0) / 100)}
                              style={{transition: 'stroke-dashoffset 0.3s ease'}}
                            />
                          </svg>
                          <div className={styles.progressPercentage}>
                            {isProcessing ? '' : `${uploadProgress || 0}%`}
                          </div>
                        </div>
                        <p className={styles.uploadingText}>
                          {isProcessing ? 'Media uploaded successfully, Now we\'re Processing your video...' : 'Uploading your video...'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <h3>Drag & Drop Your Video</h3>
                        <p>or click to browse</p>
                        <div className={styles.uploadSpecs}>
                          <span>Supported formats: MP4, MOV</span>
                          <span>Max file size: 500MB</span>
                        </div>
                      </>
                    )}
                  </div>
                  {uploadedFile && !videoUrl && !isUploading && (
                    <div className={styles.uploadControls}>
                      <div className={styles.selectedFileInfo}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <path d="M12 18v-6"></path>
                          <path d="M8 15h8"></path>
                        </svg>
                        <div className={styles.fileDetails}>
                          <span className={styles.fileName}>{uploadedFile}</span>
                          <span className={styles.fileSize}>{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : ''}</span>
                        </div>
                      </div>
                      <button 
                        className={styles.uploadButton} 
                        onClick={handleFileUpload}
                        disabled={!file || isUploading}
                      >
                        {isUploading ? 'Uploading...' : 'Upload Video'}
                      </button>
                    </div>
                  )}
                </>
              )}
              {uploadError && (
                <div className={styles.errorMessage}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12" y2="16"></line>
                  </svg>
                  <p>{uploadError}</p>
                </div>
              )}
            </div>
            {videoUrl && (
              <div className={styles.nextButtonContainer}>
                <button 
                  className={styles.nextButton} 
                  onClick={() => setCurrentStep(2)}
                >
                  Next: Choose Platforms
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className={styles.stepContainer}>
            <div className={styles.stepTitle}>
              <h2>Select Accounts</h2>
            </div>
            
            <div className={styles.searchContainer}>
              <div className={styles.searchInputWrapper}>
                <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input 
                  type="text" 
                  className={styles.searchInput} 
                  placeholder="Search accounts..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className={styles.filterButton}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 14 14 12.46 22 3"></polygon>
                </svg>
              </button>
            </div>
            
            <div className={styles.platformsGrid}>
              {/* TikTok Section */}
              <div className={styles.platformCard}>
                <div className={styles.platformHeader}>
                  <div className={styles.platformIcon}>
                    <TikTokSimpleIcon width="24" height="24" />
                  </div>
                  <span className={styles.platformName}>TikTok</span>
                </div>
                
                <div className={styles.accountsList}>
                  {tiktokAccounts.length === 0 ? (
                    <div className={styles.noAccountsMessage}>
                      <p>No TikTok accounts connected.</p>
                      <Link href="/tiktok" legacyBehavior>
                        <a className={styles.connectLink}>
                          <button className={styles.connectAccountButton} type="button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19"></line>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Connect TikTok Account
                          </button>
                        </a>
                      </Link>
                    </div>
                  ) : (
                    <>
                      {filteredTiktokAccounts.map(account => (
                        <div 
                          key={account.openId}
                          className={`${styles.accountRow} ${selectedTiktokAccounts.some(acc => acc.openId === account.openId) ? styles.selectedAccountRow : ''}`}
                          onClick={(e) => {
                            e.preventDefault();
                            handleTikTokAccountToggle(account);
                          }}
                        >
                          <div className={styles.accountInfo}>
                            <div className={styles.accountAvatar}>
                              {account.username?.charAt(0).toUpperCase() || 'T'}
                            </div>
                            <span className={styles.accountName}>{account.username}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedTiktokAccounts.some(acc => acc.openId === account.openId)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleTikTokAccountToggle(account);
                            }}
                            className={styles.accountCheckbox}
                          />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
              
              {/* Twitter Section */}
              <div className={styles.platformCard}>
                <div className={styles.platformHeader}>
                  <div className={styles.platformIcon}>
                    <TwitterIcon width="24" height="24" />
                  </div>
                  <span className={styles.platformName}>Twitter / X</span>
                </div>
                
                <div className={styles.accountsList}>
                  {!localStorage?.getItem('twitter_access_token') ? (
                    <div className={styles.noAccountsMessage}>
                      <p>No Twitter account connected.</p>
                      <Link href="/twitter" legacyBehavior>
                        <a className={styles.connectLink}>
                          <button className={styles.connectAccountButton} type="button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19"></line>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Connect Twitter Account
                          </button>
                        </a>
                      </Link>
                    </div>
                  ) : (
                    <div 
                      className={`${styles.accountRow} ${selectedPlatforms.includes('twitter') ? styles.selectedAccountRow : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handlePlatformToggle('twitter');
                      }}
                    >
                      <div className={styles.accountInfo}>
                        <div className={styles.accountAvatar}>
                          {localStorage?.getItem('twitter_username')?.charAt(0).toUpperCase() || 'T'}
                        </div>
                        <span className={styles.accountName}>{localStorage?.getItem('twitter_username') || 'Twitter Account'}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes('twitter')}
                        onChange={(e) => {
                          e.stopPropagation();
                          handlePlatformToggle('twitter');
                        }}
                        className={styles.accountCheckbox}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {videoUrl && (
              <div className={styles.nextButtonContainer}>
                <button 
                  className={styles.nextButton} 
                  onClick={() => setCurrentStep(3)}
                  disabled={!(selectedTiktokAccounts.length > 0 || selectedPlatforms.includes('twitter'))}
                >
                  Next: Add Caption
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div className={styles.stepContainer}>
            <div className={styles.captionSection}>
              <h3>Add Caption</h3>
              <textarea
                className={styles.captionInput}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption for your video..."
                maxLength={2200}
              />
              <div className={styles.captionCounter}>
                {caption.length}/2200
              </div>
            </div>

            <div className={styles.postActions}>
              <button
                className={styles.backButton}
                onClick={() => setCurrentStep(2)}
              >
                Back
              </button>
              <button
                className={styles.nextButton}
                onClick={() => setCurrentStep(4)}
              >
                Review Post
              </button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="w-full max-w-4xl mx-auto px-4">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Review Your Post</h2>
              <p className="text-gray-500">Review your content before publishing to your selected platforms</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-6">
              
            {/* Publishing Section */}
            <div className="overflow-hidden p-6 mb-6">              
              {/* TikTok Accounts */}
              {selectedTiktokAccounts?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">TikTok Accounts</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTiktokAccounts?.map(account => (
                      <div key={account?.openId} className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19.6099 6.90989C17.9366 6.90989 16.5731 5.54646 16.5731 3.87312H12.1379V15.9837C12.1379 17.6477 10.7837 19.0019 9.11969 19.0019C7.45569 19.0019 6.1015 17.6477 6.1015 15.9837C6.1015 14.3197 7.45569 12.9655 9.11969 12.9655C9.51114 12.9655 9.88351 13.0447 10.2276 13.1855V8.69296C9.88351 8.65228 9.5301 8.63213 9.18077 8.63213C5.04351 8.63213 1.67578 12.0091 1.67578 16.1356C1.67578 20.2728 5.05271 23.639 9.18077 23.639C13.3088 23.639 16.6858 20.2728 16.6858 16.1356V9.93228C18.0322 10.9064 19.6743 11.445 21.427 11.445V7.10217C21.4178 7.10217 19.6191 7.10217 19.6099 6.90989Z" fill="black"/>
                        </svg>
                        <span className="text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded">{account?.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Twitter Account */}
              {selectedPlatforms?.includes('twitter') && (
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Twitter / X</h4>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18.901 1.50293H22.581L14.541 10.7825L24 22.4999H16.594L10.794 15.4626L4.156 22.4999H0.474L9.074 12.5626L0 1.50293H7.594L12.837 7.92235L18.901 1.50293ZM17.61 20.4208H19.649L6.486 3.48519H4.298L17.61 20.4208Z" fill="black"/>
                      </svg>
                      <span className="text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded">{localStorage?.getItem('twitter_username') || 'Twitter Account'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>              
           
              {/* Media Section */}
              <div className="bg-white overflow-hidden p-6">
                <div className="cursor-pointer" onClick={() => setShowVideoModal(true)}>
                  <div className="relative aspect-video bg-black rounded-lg mb-3">
                    {videoUrl && (
                      <video
                        className="absolute inset-0 w-full h-full object-cover"
                        src={videoUrl}
                        playsInline
                        muted
                        ref={videoRef}
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-gray-800/60 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="text-gray-800 font-medium">{uploadedFile}</div>
                  <div className="text-sm text-gray-500">{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : ''}</div>
                </div>
              </div>              
            </div>
            {/* Caption Section */}
            <div className="overflow-hidden p-6">
                <div className="flex items-center gap-2 mb-4">

                  <h4 className="font-medium text-gray-700">Post Caption</h4>
                </div>
                <div className="text-gray-700 flex items-center gap-2 px-4 py-2 border-l-4 bg-gray-100">{caption || 'No caption added'}</div>
              </div>   
            
            {/* Schedule for later */}
            <div className="p-4 mb-8">
              <div className="flex items-center justify-start">
                <span className="text-gray-700 text-xl mr-4 font-medium">Schedule post</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                  />
                  <div className={`w-14 h-7 rounded-full transition-colors duration-200 ease-in-out ${isScheduled ? 'bg-gray-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full transition-transform duration-200 ease-in-out ${isScheduled ? 'transform translate-x-7' : ''}`}></div>
                  </div>
                </label>
              </div>

              {isScheduled && (
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between mb-8">
              <button
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => setCurrentStep(3)}
                disabled={isPosting}
              >
                Edit
              </button>
              <button
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handlePost}
                disabled={isPosting || (isScheduled && (!scheduledDate || !scheduledTime))}
              >
                {isPosting ? 'Posting...' : isScheduled ? 'Schedule Post' : 'Post Now'}
              </button>
            </div>

            {uploadError && (
              <div className="p-4 mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-md">
                {uploadError}
              </div>
            )}

            {Object.keys(platformResults).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-6">Posting Results</h3>
                {Object.entries(platformResults).map(([platform, result]) => (
                  <div key={platform} className="mb-6 last:mb-0">
                    <h4 className="text-lg font-medium text-gray-700 mb-3">{platform.charAt(0).toUpperCase() + platform.slice(1)}</h4>
                    {Array.isArray(result) ? (
                      <div className="space-y-3">
                        {result.map((r, i) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <TikTokSimpleIcon width="18" height="18" />
                              <span className="font-medium text-gray-700">{r?.username}</span>
                            </div>
                            {r?.success ? (
                              <span className="text-green-600">{r?.message}</span>
                            ) : (
                              <span className="text-red-600">{r?.error}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <TwitterIcon width="18" height="18" />
                          <span className="font-medium text-gray-700">{localStorage?.getItem('twitter_username') || 'Twitter Account'}</span>
                        </div>
                        {result?.success ? (
                          <span className="text-green-600">{result?.message}</span>
                        ) : (
                          <span className="text-red-600">{result?.error}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // Refresh Twitter credentials
  const refreshTwitterCredentials = async () => {
    try {
      const refreshToken = localStorage?.getItem('twitter_refresh_token');
      
      if (!refreshToken) {
        window.showToast?.warning?.('No Twitter refresh token found. Please reconnect your Twitter account.');
        return;
      }
      
      setIsLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/twitter/refresh-credentials?refreshToken=${encodeURIComponent(refreshToken)}`);
      const data = await response?.json();
      
      if (response?.ok && data?.success && data?.data?.access_token) {
        // Update the stored tokens
        localStorage.setItem('twitter_access_token', data.data.access_token);
        
        if (data.data.refresh_token) {
          localStorage.setItem('twitter_refresh_token', data.data.refresh_token);
          localStorage.setItem('twitter_access_token_secret', data.data.refresh_token);
        }
        
        window.showToast?.success?.('Twitter credentials refreshed successfully');
      } else {
        console.error('Failed to refresh Twitter credentials:', data);
        window.showToast?.error?.('Failed to refresh Twitter credentials');
      }
    } catch (error) {
      console.error('Error refreshing Twitter credentials:', error?.message);
      window.showToast?.error?.(error?.message || 'Error refreshing Twitter credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const renderConnectButtons = () => {
    return (
      <div className={styles.connectButtonsContainer}>
        <div className={styles.platformButtonsRow}>
          <Link href="/tiktok" legacyBehavior>
            <a className={styles.connectLink}>
              <button className={styles.connectPlatformButton} type="button" onClick={(e) => e.preventDefault()}>
                <TikTokSimpleIcon width="24" height="24" />
                Connect TikTok
              </button>
            </a>
          </Link>
          <Link href="/twitter" legacyBehavior>
            <a className={styles.connectLink}>
              <button className={styles.connectPlatformButton} type="button" onClick={(e) => e.preventDefault()}>
                <TwitterIcon width="24" height="24" />
                Connect Twitter
              </button>
            </a>
          </Link>
          <button 
            className={styles.refreshButton} 
            onClick={refreshTwitterCredentials}
            disabled={isLoading}
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            {isLoading ? 'Refreshing...' : 'Refresh Twitter'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Social Post | Social Lane</title>
        <meta name="description" content="Post to social media platforms" />
      </Head>
      
      <Navigation />
      
      <div className={`${styles.container} md:ml-64 transition-all duration-300`}>
      <div className={styles.header}>
            <h1>Create Your Post</h1>
            <div className={styles.steps}>
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`${styles.step} ${currentStep >= step ? styles.active : ''} ${currentStep === step ? styles.current : ''}`}
                >
                  <div className={styles.stepNumber}>{step}</div>
                  <div className={styles.stepLabel}>
                    {step === 1 && 'UPLOAD'}
                    {step === 2 && 'PLATFORMS'}
                    {step === 3 && 'DETAILS'}
                    {step === 4 && 'PUBLISH'}
                  </div>
                </div>
              ))}
            </div>
          </div>        
        <main className={styles.main}>


          <div className={styles.content}>
            {renderStep()}
          </div>

          {uploadError && (
            <div className={styles.errorMessage}>
              <div className={styles.errorIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12" y2="16"></line>
                </svg>
              </div>
              <div className={styles.errorContent}>
                <h4>Error</h4>
                <p>{uploadError}</p>
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowVideoModal(false)}>
          <div className="absolute inset-0 bg-black/70"></div>
          <div 
            className="relative w-11/12 max-w-4xl rounded-xl overflow-hidden shadow-2xl z-10" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-black">
              {videoUrl && (
                <video
                  className="w-full h-auto max-h-[80vh] object-contain"
                  src={videoUrl}
                  controls
                  autoPlay
                  playsInline
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SocialPostingPage() {
  return (
    <ProtectedRoute>
      <SocialPosting />
    </ProtectedRoute>
  );
} 