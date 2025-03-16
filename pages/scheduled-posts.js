import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { TikTokSimpleIcon, TwitterIcon } from '../src/components/icons/SocialIcons';
import ProtectedRoute from '../src/components/ProtectedRoute';

const API_BASE_URL = 'https://sociallane-backend.mindio.chat';

function ScheduledPosts() {
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
    <>
      <Head>
        <title>Scheduled Posts | Social Lane</title>
        <meta name="description" content="View and manage your scheduled social media posts" />
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        <div className="p-4 md:p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Scheduled Posts</h1>
          
          <div className={`max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 ${!loading && !error && posts.length === 0 ? 'flex items-center justify-center min-h-[calc(60vh-80px)]' : ''}`}>
            {/* Only show header if loading, error, or there are posts */}
            {(loading || error || posts.length > 0) && (
              <div className="text-center mb-8">
                <p className="text-base text-gray-600 mb-6">
                  Manage your upcoming social media posts
                </p>
                <Link href="/social-posting" className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Create New Post
                </Link>
              </div>
            )}

            <div className="w-full">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                  <p className="text-gray-600">Loading scheduled posts...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 text-red-600">
                  <div className="mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                  <p className="text-center mb-4">{error}</p>
                  <button onClick={fetchScheduledPosts} className="px-4 py-2 bg-white border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200">
                    Try Again
                  </button>
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="bg-white rounded-full p-6 mb-6 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </div>
                  <h2 className="text-2xl font-medium text-gray-900 mb-2">No Scheduled Posts</h2>
                  <p className="text-gray-600 mb-8 max-w-md">You don&apos;t have any posts scheduled for publication.</p>
                  <Link href="/social-posting" className="px-6 py-3 bg-primary text-white font-medium rounded-full hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm transition-all duration-200">
                    Create Your First Scheduled Post
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {posts.map(post => (
                    <div key={post._id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100">
                      <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center text-gray-600 text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          {formatDate(post.scheduledDate)}
                        </div>
                        <div className="text-sm font-medium text-primary bg-primary/5 px-3 py-1 rounded-full">
                          {getTimeRemaining(post.scheduledDate)}
                        </div>
                      </div>
                      
                      <div className="p-5">
                        <div className="rounded-lg overflow-hidden bg-gray-100 mb-4 aspect-video">
                          <video src={post.video_url} controls playsInline className="w-full h-full object-cover" />
                        </div>
                        <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                          {post.post_description}
                        </p>
                      </div>
                      
                      <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex space-x-2">
                          {post.platforms?.map(platform => (
                            <span key={platform} className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                              {platform === 'tiktok' && <TikTokSimpleIcon width="12" height="12" />}
                              {platform === 'twitter' && <TwitterIcon width="12" height="12" />}
                              <span>{platform === 'tiktok' ? 'TikTok' : 'Twitter'}</span>
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button 
                            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors duration-200"
                            onClick={() => handleEditPost(post)}
                            aria-label="Edit post"
                            title="Edit post"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button 
                            className="p-2 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors duration-200"
                            onClick={() => handleDeletePost(post._id)}
                            aria-label="Delete post"
                            title="Delete post"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Edit Modal */}
          {isEditModalOpen && editingPost && (
            <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden flex items-center justify-center" aria-modal="true" role="dialog">
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={handleCloseEditModal}></div>
              <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 my-8 z-10 overflow-hidden transform transition-all">
                <div className="flex items-center justify-between px-6 pt-5 pb-2">
                  <h2 className="text-xl font-medium text-gray-900">Edit Scheduled Post</h2>
                  <button 
                    className="text-gray-400 hover:text-gray-500 focus:outline-none rounded-full p-1 hover:bg-gray-100"
                    onClick={handleCloseEditModal}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                
                <div className="p-6 space-y-5">
                  {saveError && (
                    <div className="flex items-center gap-2 p-4 text-red-700 bg-red-50 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>{saveError}</span>
                    </div>
                  )}
                  
                  <div>
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <button
                        type="button"
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full border ${editPlatforms.includes('twitter') 
                          ? 'bg-primary/10 text-primary border-primary/20' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        } transition-colors duration-200`}
                        onClick={() => handlePlatformToggle('twitter')}
                      >
                        <TwitterIcon width="16" height="16" />
                        <span className="font-medium">Twitter</span>
                      </button>
                      <button
                        type="button"
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full border ${editPlatforms.includes('tiktok') 
                          ? 'bg-primary/10 text-primary border-primary/20' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        } transition-colors duration-200`}
                        onClick={() => handlePlatformToggle('tiktok')}
                      >
                        <TikTokSimpleIcon width="16" height="16" />
                        <span className="font-medium">TikTok</span>
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="post-description" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      id="post-description"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow duration-200 resize-none"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Enter your post description"
                      rows={4}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="scheduled-date" className="block text-sm font-medium text-gray-700 mb-1">
                        Date
                      </label>
                      <input
                        id="scheduled-date"
                        type="date"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow duration-200"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="scheduled-time" className="block text-sm font-medium text-gray-700 mb-1">
                        Time
                      </label>
                      <input
                        id="scheduled-time"
                        type="time"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow duration-200"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Video Preview
                    </label>
                    <div className="rounded-lg overflow-hidden bg-gray-100 aspect-video">
                      <video src={editingPost.video_url} controls playsInline className="w-full h-full object-cover" />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Video cannot be changed. Create a new post to use a different video.
                    </p>
                  </div>
                </div>
                
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                  <button 
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
                    onClick={handleCloseEditModal}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button 
                    className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm transition-colors duration-200 disabled:bg-primary/70 disabled:cursor-not-allowed"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        <span>Saving...</span>
                      </div>
                    ) : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function ScheduledPostsPage() {
  return (
    <ProtectedRoute>
      <ScheduledPosts />
    </ProtectedRoute>
  );
} 