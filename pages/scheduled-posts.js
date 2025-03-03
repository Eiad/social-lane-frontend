import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/ScheduledPosts.module.css';
import { TikTokSimpleIcon, TwitterIcon } from '../src/components/icons/SocialIcons';

const API_BASE_URL = 'https://sociallane-backend.mindio.chat';

export default function ScheduledPosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPlatforms, setEditPlatforms] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    // Get user ID from local storage
    const storedUserId = localStorage?.getItem('userId');
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  useEffect(() => {
    // Fetch scheduled posts when userId is available
    if (userId) {
      fetchScheduledPosts();
    }
  }, [userId]);

  const fetchScheduledPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/posts/user/${userId}?isScheduled=true`);
      
      if (!response?.ok) {
        throw new Error('Failed to fetch scheduled posts');
      }
      
      const data = await response.json();
      
      // Filter out completed posts (posts with past scheduled dates)
      const now = new Date();
      const filteredPosts = data.filter(post => {
        const scheduledDate = new Date(post?.scheduledDate);
        return scheduledDate > now || post?.status === 'pending';
      });
      
      // Sort posts by scheduled date (newest first)
      const sortedPosts = filteredPosts.sort((a, b) => {
        return new Date(a?.scheduledDate) - new Date(b?.scheduledDate);
      });
      
      setPosts(sortedPosts);
    } catch (err) {
      console.error('Error fetching scheduled posts:', err);
      setError(err?.message || 'Failed to load scheduled posts');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!confirm('Are you sure you want to delete this scheduled post?')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
        method: 'DELETE',
      });
      
      if (!response?.ok) {
        throw new Error('Failed to delete post');
      }
      
      // Remove the deleted post from state
      setPosts(posts.filter(post => post._id !== postId));
      
      // Show success message
      window.showToast?.success?.('Post deleted successfully');
    } catch (err) {
      console.error('Error deleting post:', err);
      window.showToast?.error?.(err?.message || 'Failed to delete post');
    }
  };

  const handleEditPost = (post) => {
    // Format date and time for the input fields
    const scheduledDate = new Date(post.scheduledDate);
    
    // Ensure we're working with the correct timezone
    // Format date as YYYY-MM-DD for the date input
    const year = scheduledDate.getFullYear();
    const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const day = String(scheduledDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    // Format time as HH:MM for the time input
    const hours = scheduledDate.getHours().toString().padStart(2, '0');
    const minutes = scheduledDate.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;
    
    console.log('Original date:', post.scheduledDate);
    console.log('Parsed date object:', scheduledDate);
    console.log('Formatted date for input:', formattedDate);
    console.log('Formatted time for input:', formattedTime);
    
    // Set the editing state
    setEditingPost(post);
    setEditDescription(post.post_description || '');
    setEditDate(formattedDate);
    setEditTime(formattedTime);
    setEditPlatforms(post.platforms || []);
    setIsEditModalOpen(true);
    setSaveError(null);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingPost(null);
    setSaveError(null);
  };

  const handlePlatformToggle = (platform) => {
    setEditPlatforms(prev => {
      if (prev.includes(platform)) {
        return prev.filter(p => p !== platform);
      }
      return [...prev, platform];
    });
  };

  const handleSaveChanges = async () => {
    if (!editingPost?._id) return;
    
    // Validate inputs
    if (!editDescription.trim()) {
      setSaveError('Description is required');
      return;
    }
    
    if (!editDate || !editTime) {
      setSaveError('Date and time are required');
      return;
    }
    
    if (editPlatforms.length === 0) {
      setSaveError('At least one platform must be selected');
      return;
    }
    
    try {
      setIsSaving(true);
      setSaveError(null);
      
      // Combine date and time into a single Date object
      const scheduledDateTime = new Date(`${editDate}T${editTime}`);
      
      // Check if the scheduled time is in the future
      if (scheduledDateTime <= new Date()) {
        setSaveError('Scheduled time must be in the future');
        return;
      }
      
      // Get tokens from localStorage for the selected platforms
      const updateData = {
        post_description: editDescription,
        platforms: editPlatforms,
        scheduledDate: scheduledDateTime.toISOString(),
      };
      
      // Add tokens for each selected platform
      if (editPlatforms.includes('tiktok')) {
        const tiktokAccessToken = localStorage?.getItem('tiktokAccessToken');
        const tiktokRefreshToken = localStorage?.getItem('tiktokRefreshToken');
        
        if (tiktokAccessToken) {
          updateData.tiktok_access_token = tiktokAccessToken;
        }
        
        if (tiktokRefreshToken) {
          updateData.tiktok_refresh_token = tiktokRefreshToken;
        }
      }
      
      if (editPlatforms.includes('twitter')) {
        const twitterAccessToken = localStorage?.getItem('twitter_access_token');
        const twitterAccessTokenSecret = localStorage?.getItem('twitter_access_token_secret') || 
                                        localStorage?.getItem('twitter_refresh_token');
        
        if (twitterAccessToken) {
          updateData.twitter_access_token = twitterAccessToken;
        }
        
        if (twitterAccessTokenSecret) {
          updateData.twitter_access_token_secret = twitterAccessTokenSecret;
        }
      }
      
      // Send update request
      const response = await fetch(`${API_BASE_URL}/posts/${editingPost._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response?.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Failed to update post: ${response.status} ${response.statusText}`);
      }
      
      const updatedPost = await response.json();
      
      // Update the post in the local state
      setPosts(posts.map(post => 
        post._id === updatedPost._id ? updatedPost : post
      ));
      
      // Close the modal
      setIsEditModalOpen(false);
      setEditingPost(null);
      
      // Show success message
      window.showToast?.success?.('Post updated successfully');
    } catch (err) {
      console.error('Error updating post:', err);
      setSaveError(err?.message || 'Failed to update post');
      window.showToast?.error?.(err?.message || 'Failed to update post');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const getTimeRemaining = (scheduledDate) => {
    const now = new Date();
    const scheduled = new Date(scheduledDate);
    const diffMs = scheduled - now;
    
    if (diffMs <= 0) {
      return 'Processing...';
    }
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ${diffHours} hr${diffHours > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ${diffMinutes} min${diffMinutes > 1 ? 's' : ''}`;
    } else {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Scheduled Posts - Social Lane</title>
        <meta name="description" content="Manage your scheduled social media posts" />
      </Head>

      <main className={`${styles.main} ${!loading && !error && posts.length === 0 ? styles.mainEmpty : ''}`}>
        {/* Only show header if loading, error, or there are posts */}
        {(loading || error || posts.length > 0) && (
          <div className={styles.header}>
            <h1>Scheduled Posts</h1>
            <p className={styles.subtitle}>
              Manage your upcoming social media posts
            </p>
            <Link href="/social-posting" className={styles.createButton}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              Create New Post
            </Link>
          </div>
        )}

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p>Loading scheduled posts...</p>
            </div>
          ) : error ? (
            <div className={styles.errorContainer}>
              <div className={styles.errorIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <p>{error}</p>
              <button onClick={fetchScheduledPosts} className={styles.retryButton}>
                Try Again
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <h2>No Scheduled Posts</h2>
              <p>You don't have any posts scheduled for publication.</p>
              <Link href="/social-posting" className={styles.emptyButton}>
                Create Your First Scheduled Post
              </Link>
            </div>
          ) : (
            <div className={styles.postsGrid}>
              {posts.map(post => (
                <div key={post._id} className={styles.postCard}>
                  <div className={styles.postHeader}>
                    <div className={styles.scheduledTime}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      {formatDate(post.scheduledDate)}
                    </div>
                    <div className={styles.timeRemaining}>
                      {getTimeRemaining(post.scheduledDate)}
                    </div>
                  </div>
                  
                  <div className={styles.postContent}>
                    <div className={styles.videoPreview}>
                      <video src={post.video_url} controls playsInline />
                    </div>
                    <div className={styles.postDescription}>
                      {post.post_description}
                    </div>
                  </div>
                  
                  <div className={styles.postFooter}>
                    <div className={styles.platformsList}>
                      {post.platforms?.map(platform => (
                        <div key={platform} className={styles.platformBadge}>
                          {platform === 'tiktok' && <TikTokSimpleIcon width="16" height="16" />}
                          {platform === 'twitter' && <TwitterIcon width="16" height="16" />}
                          <span>{platform === 'tiktok' ? 'TikTok' : 'Twitter'}</span>
                        </div>
                      ))}
                    </div>
                    <div className={styles.actionButtons}>
                      <button 
                        className={styles.editButton}
                        onClick={() => handleEditPost(post)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                      </button>
                      <button 
                        className={styles.deleteButton}
                        onClick={() => handleDeletePost(post._id)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit Modal */}
      {isEditModalOpen && editingPost && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Edit Scheduled Post</h2>
              <button 
                className={styles.closeButton} 
                onClick={handleCloseEditModal}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className={styles.modalContent}>
              {saveError && (
                <div className={styles.errorMessage}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  {saveError}
                </div>
              )}
              
              <div className={styles.formGroup}>
                <div className={styles.platformButtons}>
                  <button
                    type="button"
                    className={`${styles.platformButton} ${editPlatforms.includes('twitter') ? styles.platformButtonActive : ''}`}
                    onClick={() => handlePlatformToggle('twitter')}
                  >
                    <TwitterIcon width="20" height="20" />
                    Twitter
                  </button>
                  <button
                    type="button"
                    className={`${styles.platformButton} ${editPlatforms.includes('tiktok') ? styles.platformButtonActive : ''}`}
                    onClick={() => handlePlatformToggle('tiktok')}
                  >
                    <TikTokSimpleIcon width="20" height="20" />
                    TikTok
                  </button>
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="post-description">Description</label>
                <textarea
                  id="post-description"
                  className={styles.textarea}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Enter your post description"
                  rows={4}
                />
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="scheduled-date">Date</label>
                  <input
                    id="scheduled-date"
                    type="date"
                    className={styles.input}
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="scheduled-time">Time</label>
                  <input
                    id="scheduled-time"
                    type="time"
                    className={styles.input}
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                  />
                </div>
              </div>
              
              <div className={styles.videoPreviewContainer}>
                <label>Video Preview</label>
                <div className={styles.videoPreviewInModal}>
                  <video src={editingPost.video_url} controls playsInline />
                </div>
                <p className={styles.videoNote}>Video cannot be changed. Create a new post to use a different video.</p>
              </div>
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelButton} 
                onClick={handleCloseEditModal}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                className={styles.saveButton} 
                onClick={handleSaveChanges}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className={styles.buttonSpinner}></div>
                    Saving...
                  </>
                ) : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 