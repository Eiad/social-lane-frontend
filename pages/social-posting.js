import { useState, useRef } from 'react';
import Head from 'next/head';
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
  const fileInputRef = useRef(null);

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
    // Reset the file state first
    setFile(null);
    setUploadedFile(null);
    
    // Reset the file input value to ensure onChange fires even if selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Trigger the file input click after a small delay to ensure the reset has taken effect
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

  const handlePlatformToggle = (platform) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platform)) {
        return prev.filter(p => p !== platform);
      }
      return [...prev, platform];
    });
  };

  const handlePost = async () => {
    if (!videoUrl || selectedPlatforms.length === 0) return;

    try {
      setIsPosting(true);
      setUploadError(null);
      setPlatformResults({});
      
      const postPromises = [];
      const results = {};

      // Post to TikTok if selected
      if (selectedPlatforms.includes('tiktok')) {
        const tiktokToken = localStorage?.getItem('tiktokAccessToken');
        
        if (!tiktokToken) {
          results.tiktok = { success: false, error: 'Please connect your TikTok account first' };
        } else {
          const tiktokPromise = fetch(`${API_BASE_URL}/tiktok/post-video`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            mode: 'cors',
            body: JSON.stringify({
              videoUrl,
              accessToken: tiktokToken,
              caption
            }),
          }).then(response => {
            if (!response?.ok) {
              throw new Error('Failed to post to TikTok');
            }
            return { success: true };
          }).catch(error => {
            console.error('TikTok posting error:', error);
            return { success: false, error: error?.message || 'Failed to post to TikTok' };
          });
          
          postPromises.push(tiktokPromise.then(result => {
            results.tiktok = result;
          }));
        }
      }

      // Post to Twitter if selected
      if (selectedPlatforms.includes('twitter')) {
        const twitterToken = localStorage?.getItem('twitter_access_token');
        
        if (!twitterToken) {
          results.twitter = { success: false, error: 'Please connect your Twitter account first' };
        } else {
          const twitterPromise = fetch(`${API_BASE_URL}/twitter/post-media`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            mode: 'cors',
            body: JSON.stringify({
              videoUrl,
              accessToken: twitterToken,
              text: caption
            }),
          }).then(response => {
            if (!response?.ok) {
              throw new Error('Failed to post to Twitter');
            }
            return { success: true };
          }).catch(error => {
            console.error('Twitter posting error:', error);
            return { success: false, error: error?.message || 'Failed to post to Twitter' };
          });
          
          postPromises.push(twitterPromise.then(result => {
            results.twitter = result;
          }));
        }
      }

      // Wait for all posting operations to complete
      if (postPromises.length > 0) {
        await Promise.all(postPromises);
      }
      
      setPlatformResults(results);
      
      // Check if any platform was successful
      const anySuccess = Object.values(results).some(result => result?.success);
      
      if (anySuccess) {
        // Show success message for successful platforms
        const successPlatforms = Object.entries(results)
          .filter(([_, result]) => result?.success)
          .map(([platform]) => platform);
          
        window.showToast?.success?.(
          `Posted successfully to ${successPlatforms.join(' and ')}!`
        );
        
        setPostSuccess(true);
        setCurrentStep(5);
      } else {
        // If all failed, show error for the first platform
        const firstError = Object.values(results)[0]?.error || 'Error posting content';
        throw new Error(firstError);
      }
    } catch (error) {
      setUploadError(error?.message || 'Error posting content');
      window.showToast?.error?.(error?.message || 'Error posting content');
    } finally {
      setIsPosting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className={styles.step}>
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
          <div className={styles.step}>
            <div className={styles.stepTitle}>
              <h2>Choose Platforms</h2>
              <p className={styles.stepDescription}>
                Select where you want to share your content.
              </p>
            </div>
            <div className={styles.platformsGrid}>
              <button
                className={`${styles.platformButton} ${selectedPlatforms.includes('tiktok') ? styles.selected : ''}`}
                onClick={() => handlePlatformToggle('tiktok')}
              >
                <div className={styles.platformIcon}>
                  <TikTokSimpleIcon width="32" height="32" />
                </div>
                <div className={styles.platformInfo}>
                  <div className={styles.platformName}>TikTok</div>
                  <div className={styles.platformDescription}>
                    Share short-form videos
                  </div>
                </div>
                <div className={styles.platformCheck}>
                  {selectedPlatforms.includes('tiktok') && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
              </button>
              
              <button
                className={`${styles.platformButton} ${selectedPlatforms.includes('twitter') ? styles.selected : ''}`}
                onClick={() => handlePlatformToggle('twitter')}
              >
                <div className={styles.platformIcon}>
                  <TwitterIcon width="32" height="32" />
                </div>
                <div className={styles.platformInfo}>
                  <div className={styles.platformName}>Twitter</div>
                  <div className={styles.platformDescription}>
                    Share videos with your followers
                  </div>
                </div>
                <div className={styles.platformCheck}>
                  {selectedPlatforms.includes('twitter') && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
              </button>
            </div>
            <div className={styles.stepActions}>
              <button 
                className={styles.backButton} 
                onClick={() => setCurrentStep(1)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                Back
              </button>
              <button
                className={styles.nextButton}
                onClick={() => setCurrentStep(3)}
                disabled={selectedPlatforms.length === 0}
              >
                Next
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className={styles.step}>
            <div className={styles.stepTitle}>
              <h2>Add Details</h2>
              <p className={styles.stepDescription}>
                Write a caption for your post.
              </p>
            </div>
            <div className={styles.detailsForm}>
              <div className={styles.formGroup}>
                <label htmlFor="caption">
                  Caption
                  <span className={styles.captionCounter}>
                    {caption.length}/2200
                  </span>
                </label>
                <div className={styles.captionInputWrapper}>
                  <textarea
                    id="caption"
                    className={styles.captionInput}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write a caption for your post..."
                    maxLength={2200}
                  />
                </div>
              </div>
            </div>
            <div className={styles.stepActions}>
              <button 
                className={styles.backButton} 
                onClick={() => setCurrentStep(2)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                Back
              </button>
              <button
                className={styles.reviewButton}
                onClick={() => setCurrentStep(4)}
              >
                Review
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className={styles.step}>
            <div className={styles.stepTitle}>
              <h2>Review Your Post</h2>
              <p className={styles.stepDescription}>
                Take a final look at your content before sharing it with the world.
              </p>
            </div>
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
                    {selectedPlatforms.map(platform => (
                      <div key={platform} className={styles.platformBadge}>
                        {platform === 'tiktok' && <TikTokSimpleIcon width="18" height="18" />}
                        {platform === 'twitter' && <TwitterIcon width="18" height="18" />}
                        <span>{platform === 'tiktok' ? 'TikTok' : 'Twitter'}</span>
                      </div>
                    ))}
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
            <div className={styles.stepActions}>
              <button 
                className={styles.backButton} 
                onClick={() => setCurrentStep(3)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                Edit
              </button>
              <button
                className={styles.reviewButton}
                onClick={handlePost}
                disabled={isPosting}
              >
                {isPosting ? (
                  <>
                    <svg className={styles.loadingIcon} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="2" x2="12" y2="6"></line>
                      <line x1="12" y1="18" x2="12" y2="22"></line>
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                      <line x1="2" y1="12" x2="6" y2="12"></line>
                      <line x1="18" y1="12" x2="22" y2="12"></line>
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    Publishing...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                      <polyline points="16 6 12 2 8 6"></polyline>
                      <line x1="12" y1="2" x2="12" y2="15"></line>
                    </svg>
                    Post Now
                  </>
                )}
              </button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className={styles.step}>
            <div className={styles.successMessage}>
              <div className={styles.successIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h2>Post Published</h2>
              <p>Your content has been successfully published.</p>
              {Object.entries(platformResults).length > 0 && (
                <div className={styles.platformResults}>
                  {Object.entries(platformResults).map(([platform, result]) => (
                    <div 
                      key={platform} 
                      className={`${styles.platformResult} ${result.success ? styles.success : styles.error}`}
                    >
                      <div className={styles.platformResultIcon}>
                        {result.success ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                          </svg>
                        )}
                      </div>
                      <div className={styles.platformResultInfo}>
                        <span className={styles.platformResultName}>
                          {platform === 'tiktok' ? 'TikTok' : 'Twitter'}
                        </span>
                        <span className={styles.platformResultStatus}>
                          {result.success ? 'Posted successfully' : result.error || 'Failed to post'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                className={styles.newPostButton}
                onClick={() => {
                  setCurrentStep(1);
                  setFile(null);
                  setUploadedFile(null);
                  setVideoUrl('');
                  setSelectedPlatforms([]);
                  setCaption('');
                  setPostSuccess(false);
                  setPlatformResults({});
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                Create Another Post
              </button>
            </div>
          </div>
        );
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
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
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