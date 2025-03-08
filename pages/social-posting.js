import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/SocialPosting.module.css';
import { TikTokSimpleIcon, TwitterIcon } from '../src/components/icons/SocialIcons';

const API_BASE_URL = 'https://sociallane-backend.mindio.chat';

export default function SocialPosting() {
  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
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
  const [tiktokAccounts, setTiktokAccounts] = useState([]);
  const [selectedTiktokAccounts, setSelectedTiktokAccounts] = useState([]);

  useEffect(() => {
    const storedUserId = localStorage?.getItem('userId');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = crypto.randomUUID();
      localStorage?.setItem('userId', newUserId);
      setUserId(newUserId);
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
  };

  const handleTikTokAccountToggle = (account) => {
    setSelectedTiktokAccounts(prev => {
      const isSelected = prev.some(acc => acc.openId === account.openId);
      if (isSelected) {
        return prev.filter(acc => acc.openId !== account.openId);
      }
      return [...prev, account];
    });
  };

  const handlePlatformToggle = (platform) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platform)) {
        if (platform === 'tiktok') {
          setSelectedTiktokAccounts([]);
        }
        return prev.filter(p => p !== platform);
      }
      return [...prev, platform];
    });
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target?.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadedFile(selectedFile.name);
      setUploadError(null);
      setVideoUrl('');
      setPostSuccess(false);
    }
  };

  const handleChangeFile = () => {
    setFile(null);
    setUploadedFile(null);
    
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
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      if (!file.type?.startsWith('video/')) {
        throw new Error('Please select a video file');
      }

      if (file.size > 500 * 1024 * 1024) {
        throw new Error('File size exceeds 500MB limit');
      }

      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentCompleted = Math.round((event.loaded * 100) / event.total);
          setUploadProgress(percentCompleted);
        }
      });

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
        
        xhr.onerror = () => reject(new Error('Network error during upload'));
      });

      xhr.open('POST', '/api/upload', true);
      xhr.send(formData);
      
      const data = await uploadPromise;
      
      if (data?.success && data?.url) {
        setVideoUrl(data.url);
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePost = async () => {
    if (!videoUrl || selectedPlatforms.length === 0) return;

    if (selectedPlatforms.includes('tiktok') && selectedTiktokAccounts.length === 0) {
      window.showToast?.warning?.('Please select at least one TikTok account to post to');
      return;
    }

    try {
      setIsPosting(true);
      setUploadError(null);
      setPlatformResults({});
      
      const twitterAccessToken = localStorage?.getItem('twitter_access_token');
      let twitterAccessTokenSecret = localStorage?.getItem('twitter_access_token_secret');
      if (!twitterAccessTokenSecret) {
        twitterAccessTokenSecret = localStorage?.getItem('twitter_refresh_token');
        if (twitterAccessTokenSecret) {
          localStorage?.setItem('twitter_access_token_secret', twitterAccessTokenSecret);
        }
      }
      
      if (selectedPlatforms.includes('twitter') && (!twitterAccessToken || !twitterAccessTokenSecret)) {
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
            ...(selectedPlatforms.includes('tiktok') ? {
              tiktok_accounts: selectedTiktokAccounts.map(account => ({
                accessToken: account.accessToken,
                refreshToken: account.refreshToken,
                openId: account.openId
              }))
            } : {}),
            ...(selectedPlatforms.includes('twitter') && twitterAccessToken ? {
              twitter_access_token: twitterAccessToken,
              twitter_access_token_secret: twitterAccessTokenSecret
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
          
          if (!response.ok) {
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
          throw new Error('Failed to schedule post: ' + error.message);
        }
      }

      const results = {};
      
      if (selectedPlatforms.includes('tiktok')) {
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
                accessToken: account.accessToken,
                refreshToken: account.refreshToken,
                caption
              }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
              results.tiktok.push({
                success: true,
                accountId: account.openId,
                username: account.username,
                message: data.message
              });
            } else {
              throw new Error(data.error || 'Failed to post to TikTok');
            }
          } catch (error) {
            results.tiktok.push({
              success: false,
              accountId: account.openId,
              username: account.username,
              error: error.message
            });
          }
        }
      }
      
      if (selectedPlatforms.includes('twitter') && twitterAccessToken && twitterAccessTokenSecret) {
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
          
          const data = await response.json();
          
          if (response.ok) {
            results.twitter = { success: true, message: data.message };
          } else {
            throw new Error(data.error || 'Failed to post to Twitter');
          }
        } catch (error) {
          results.twitter = { success: false, error: error.message };
        }
      }
      
      setPlatformResults(results);
      
      const allSuccess = Object.values(results).every(result => {
        if (Array.isArray(result)) {
          return result.every(r => r.success);
        }
        return result.success;
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
      setUploadError(error.message);
      window.showToast?.error?.(error.message);
    } finally {
      setIsPosting(false);
    }
  };

  const renderTikTokAccounts = () => {
    if (!selectedPlatforms.includes('tiktok')) return null;
    
    if (tiktokAccounts.length === 0) {
      return (
        <div className={styles.noAccountsMessage}>
          <p>No TikTok accounts connected.</p>
          <Link href="/tiktok">
            <button className={styles.connectButton}>
              <TikTokSimpleIcon width="20" height="20" />
              Connect TikTok Account
            </button>
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
                onChange={() => handleTikTokAccountToggle(account)}
                className={styles.accountCheckbox}
              />
            </div>
          ))}
        </div>
        <Link href="/tiktok">
          <button className={styles.addAccountButton}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Add Another TikTok Account
          </button>
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
              <h2>Upload Your Video</h2>
              <p className={styles.stepDescription}>
                Share your creativity with the world. Upload a video in MP4 or MOV format.
              </p>
            </div>
            <div className={styles.uploadSection}>
              {!uploadedFile && !isUploading && (
                <div 
                  className={styles.uploadDropzone}
                  onClick={handleUploadClick}
                >
                  <div className={styles.uploadIcon}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </div>
                  <p className={styles.uploadText}>
                    Drag and drop your video here
                  </p>
                  <p className={styles.uploadHint}>
                    or <span className={styles.uploadLink}>browse files</span>
                  </p>
                  <div className={styles.uploadSpecs}>
                    <div className={styles.uploadSpec}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                      MP4, MOV
                    </div>
                    <div className={styles.uploadSpec}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      Up to 500MB
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="video/*"
                    className={styles.fileInput}
                  />
                </div>
              )}

              {uploadedFile && (
                <div className={styles.uploadedFileCard}>
                  <div className={styles.uploadedFileInfo}>
                    <div className={styles.uploadedFileIcon}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                      </svg>
                    </div>
                    <div className={styles.uploadedFileDetails}>
                      <h5>{uploadedFile}</h5>
                      <span>{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : ''}</span>
                    </div>
                  </div>
                  <div className={styles.uploadActions}>
                    <button 
                      className={styles.changeFileButton}
                      onClick={handleChangeFile}
                      disabled={isUploading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Change
                    </button>
                    <button
                      className={styles.uploadButton}
                      onClick={handleFileUpload}
                      disabled={isUploading}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      Upload
                    </button>
                  </div>
                </div>
              )}

              {isUploading && (
                <div className={styles.progressSection}>
                  <div className={styles.progressStatus}>
                    <div className={styles.progressInfo}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <span className={styles.progressLabel}>Uploading...</span>
                    </div>
                    <span className={styles.progressPercentage}>{uploadProgress}%</span>
                  </div>
                  <div className={styles.progressBarContainer}>
                    <div 
                      className={styles.progressBar} 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case 2:
        return (
          <div className={styles.stepContainer}>
            <div className={styles.platformSection}>
              <h3>Select Platforms</h3>
              <div className={styles.platformButtons}>
                <button
                  className={`${styles.platformButton} ${selectedPlatforms.includes('tiktok') ? styles.selected : ''}`}
                  onClick={() => handlePlatformToggle('tiktok')}
                >
                  <TikTokSimpleIcon width="24" height="24" />
                  TikTok
                </button>
                <button
                  className={`${styles.platformButton} ${selectedPlatforms.includes('twitter') ? styles.selected : ''}`}
                  onClick={() => handlePlatformToggle('twitter')}
                >
                  <TwitterIcon width="24" height="24" />
                  Twitter
                </button>
              </div>
            </div>

            {renderTikTokAccounts()}

            <div className={styles.postActions}>
              <button
                className={styles.backButton}
                onClick={() => setCurrentStep(1)}
              >
                Back
              </button>
              <button
                className={styles.nextButton}
                onClick={() => setCurrentStep(3)}
                disabled={selectedPlatforms.length === 0 || (selectedPlatforms.includes('tiktok') && selectedTiktokAccounts.length === 0)}
              >
                Next
              </button>
            </div>
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
          <div className={styles.stepContainer}>
            <div className={styles.reviewSection}>
              <div className={styles.reviewDetails}>
                <div className={styles.reviewItem}>
                  <h3>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    File
                  </h3>
                  <div className={styles.fileItem}>
                    <div className={styles.fileIcon}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                      </svg>
                    </div>
                    <div className={styles.fileInfo}>
                      <div className={styles.fileName}>{uploadedFile}</div>
                      <div className={styles.fileSize}>{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : ''}</div>
                    </div>
                  </div>
                </div>
                
                <div className={styles.reviewItem}>
                  <h3>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                    Caption
                  </h3>
                  <p className={styles.captionPreview}>{caption || 'No caption added'}</p>
                </div>
                
                <div className={styles.reviewItem}>
                  <h3>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5 0-.28-.03-.56-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                    </svg>
                    Publishing to
                  </h3>
                  <div className={styles.platformsList}>
                    {selectedPlatforms.includes('tiktok') && (
                      <div className={styles.platformAccounts}>
                        <h4>TikTok Accounts</h4>
                        {selectedTiktokAccounts.map(account => (
                          <div key={account.openId} className={styles.accountBadge}>
                            <TikTokSimpleIcon width="18" height="18" />
                            <span>{account.username}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedPlatforms.includes('twitter') && (
                      <div className={styles.platformBadge}>
                        <TwitterIcon width="18" height="18" />
                        <span>Twitter</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className={styles.videoPreviewSection}>
                <div className={styles.videoPreviewContainer}>
                  <video
                    className={styles.videoPreview}
                    src={videoUrl}
                    controls
                    playsInline
                  />
                </div>
              </div>
            </div>

            <div className={styles.schedulingSection}>
              <label className={styles.scheduleToggle}>
                <input
                  type="checkbox"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                />
                Schedule for later
              </label>

              {isScheduled && (
                <div className={styles.dateTimeInputs}>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={styles.dateInput}
                  />
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className={styles.timeInput}
                  />
                </div>
              )}
            </div>

            <div className={styles.postActions}>
              <button
                className={styles.backButton}
                onClick={() => setCurrentStep(3)}
                disabled={isPosting}
              >
                Edit
              </button>
              <button
                className={styles.postButton}
                onClick={handlePost}
                disabled={isPosting || (isScheduled && (!scheduledDate || !scheduledTime))}
              >
                {isPosting ? 'Posting...' : isScheduled ? 'Schedule Post' : 'Post Now'}
              </button>
            </div>

            {uploadError && (
              <div className={styles.errorMessage}>
                {uploadError}
              </div>
            )}

            {Object.keys(platformResults).length > 0 && (
              <div className={styles.resultsSection}>
                <h3>Posting Results</h3>
                {Object.entries(platformResults).map(([platform, result]) => (
                  <div key={platform} className={styles.platformResult}>
                    <h4>{platform.charAt(0).toUpperCase() + platform.slice(1)}</h4>
                    {Array.isArray(result) ? (
                      <div className={styles.accountResults}>
                        {result.map((r, i) => (
                          <div key={i} className={styles.accountResult}>
                            <div className={styles.accountResultHeader}>
                              <TikTokSimpleIcon width="18" height="18" />
                              <span className={styles.accountName}>{r.username}</span>
                            </div>
                            {r.success ? (
                              <span className={styles.success}>{r.message}</span>
                            ) : (
                              <span className={styles.error}>{r.error}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.singleResult}>
                        <div className={styles.resultHeader}>
                          <TwitterIcon width="18" height="18" />
                        </div>
                        {result.success ? (
                          <span className={styles.success}>{result.message}</span>
                        ) : (
                          <span className={styles.error}>{result.error}</span>
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

  return (
    <div className={styles.container}>
      <Head>
        <title>Create Post - Social Lane</title>
        <meta name="description" content="Create and publish social media posts" />
      </Head>

      <main className={styles.main}>
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
  );
} 