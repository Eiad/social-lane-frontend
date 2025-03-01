import { useState, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/SocialPosting.module.css';
import { TikTokSimpleIcon } from '../src/components/icons/SocialIcons';

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
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadedFile(selectedFile.name);
      setUploadError(null);
      setVideoUrl('');
      setPostSuccess(false);
    }
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

      // Currently only supporting TikTok
      if (selectedPlatforms.includes('tiktok')) {
        const token = localStorage?.getItem('tiktokAccessToken');
        
        if (!token) {
          throw new Error('Please connect your TikTok account first');
        }

        const response = await fetch(`${API_BASE_URL}/tiktok/post-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          mode: 'cors',
          body: JSON.stringify({
            videoUrl,
            accessToken: token,
            caption
          }),
        });

        if (!response?.ok) {
          throw new Error('Failed to post to TikTok');
        }

        window.showToast?.success?.('Posted successfully to TikTok!');
        setPostSuccess(true);
        setCurrentStep(5);
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
            <h2>Upload Media</h2>
            <div className={styles.uploadSection}>
              {!uploadedFile && !isUploading && (
                <div 
                  className={styles.uploadDropzone}
                  onClick={handleUploadClick}
                >
                  <div className={styles.uploadIcon}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </div>
                  <p className={styles.uploadText}>
                    Click to upload or drag and drop
                  </p>
                  <p className={styles.uploadHint}>
                    Supported formats: MP4, MOV (max 500MB)
                  </p>
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
                    <h5>{uploadedFile}</h5>
                  </div>
                  <div className={styles.uploadActions}>
                    <button 
                      className={styles.changeFileButton}
                      onClick={handleUploadClick}
                      disabled={isUploading}
                    >
                      Change
                    </button>
                    <button
                      className={styles.uploadButton}
                      onClick={handleFileUpload}
                      disabled={isUploading}
                    >
                      Upload
                    </button>
                  </div>
                </div>
              )}

              {isUploading && (
                <div className={styles.progressSection}>
                  <div className={styles.progressBarContainer}>
                    <div 
                      className={styles.progressBar} 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                    <span className={styles.progressText}>
                      {uploadProgress}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className={styles.step}>
            <h2>Select Platforms</h2>
            <div className={styles.platformsGrid}>
              <button
                className={`${styles.platformButton} ${selectedPlatforms.includes('tiktok') ? styles.selected : ''}`}
                onClick={() => handlePlatformToggle('tiktok')}
              >
                <TikTokSimpleIcon width="24" height="24" />
                <span>TikTok</span>
              </button>
              {/* Add more platforms here in the future */}
            </div>
            <div className={styles.stepActions}>
              <button 
                className={styles.backButton} 
                onClick={() => setCurrentStep(1)}
              >
                Back
              </button>
              <button
                className={styles.nextButton}
                onClick={() => setCurrentStep(3)}
                disabled={selectedPlatforms.length === 0}
              >
                Next
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className={styles.step}>
            <h2>Add Details</h2>
            <div className={styles.detailsForm}>
              <div className={styles.formGroup}>
                <label htmlFor="caption">Caption</label>
                <textarea
                  id="caption"
                  className={styles.captionInput}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption for your post..."
                  maxLength={2200}
                />
                <div className={styles.captionCounter}>
                  {caption.length}/2200
                </div>
              </div>
            </div>
            <div className={styles.stepActions}>
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
                Next
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className={styles.step}>
            <h2>Review & Publish</h2>
            <div className={styles.reviewSection}>
              <div className={styles.reviewItem}>
                <h3>Selected Platforms</h3>
                <div className={styles.platformsList}>
                  {selectedPlatforms.map(platform => (
                    <div key={platform} className={styles.platformBadge}>
                      {platform === 'tiktok' && <TikTokSimpleIcon width="16" height="16" />}
                      <span>{platform}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.reviewItem}>
                <h3>Caption</h3>
                <p className={styles.captionPreview}>{caption || 'No caption'}</p>
              </div>
            </div>
            <div className={styles.stepActions}>
              <button 
                className={styles.backButton} 
                onClick={() => setCurrentStep(3)}
              >
                Back
              </button>
              <button
                className={styles.publishButton}
                onClick={handlePost}
                disabled={isPosting}
              >
                {isPosting ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className={styles.step}>
            <div className={styles.successMessage}>
              <div className={styles.successIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h2>Post Published Successfully!</h2>
              <p>Your content has been published to the selected platforms.</p>
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
                }}
              >
                Create New Post
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
          <h1>Create a Post</h1>
          <div className={styles.steps}>
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`${styles.step} ${currentStep >= step ? styles.active : ''} ${currentStep === step ? styles.current : ''}`}
              >
                <div className={styles.stepNumber}>{step}</div>
                <div className={styles.stepLabel}>
                  {step === 1 && 'Upload'}
                  {step === 2 && 'Platforms'}
                  {step === 3 && 'Details'}
                  {step === 4 && 'Publish'}
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
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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