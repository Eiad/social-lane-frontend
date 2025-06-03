import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { TikTokSimpleIcon, TwitterIcon } from '../src/components/icons/SocialIcons';
import ProtectedRoute from '../src/components/ProtectedRoute';
import ConfirmationModal from '../src/components/modals/ConfirmationModal';

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

  // New state for video blob URL in edit modal
  const [editModalBlobUrl, setEditModalBlobUrl] = useState(null);
  const [editModalVideoLoading, setEditModalVideoLoading] = useState(true);
  const [editModalVideoError, setEditModalVideoError] = useState(false);

  // New state for account selection
  const [platformAccountsDetails, setPlatformAccountsDetails] = useState({}); // e.g., { twitter: [{id, name}, ...], tiktok: [...] }
  const [selectedAccounts, setSelectedAccounts] = useState([]); // e.g., [{platform, accountId, name}, ...]
  const [accountSearchQuery, setAccountSearchQuery] = useState(''); // New state for search
  const [collapsedPlatforms, setCollapsedPlatforms] = useState({}); // State for collapsed platform sections

  // State for video player modal
  const [showVideoPlayerModal, setShowVideoPlayerModal] = useState(false);
  const [videoModalUrl, setVideoModalUrl] = useState('');
  const [playerModalBlobUrl, setPlayerModalBlobUrl] = useState(null);
  const [playerModalVideoLoading, setPlayerModalVideoLoading] = useState(true);
  const [playerModalVideoError, setPlayerModalVideoError] = useState(false);

  // State for delete confirmation modal
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState(null);

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

  // Effect to load platform accounts from localStorage
  useEffect(() => {
    try {
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (socialMediaDataStr) {
        const socialMediaData = JSON.parse(socialMediaDataStr);
        const accounts = {};
        if (socialMediaData?.twitter && Array.isArray(socialMediaData.twitter)) {
          accounts.twitter = socialMediaData.twitter.map((acc, index) => {
            // Ensure accountId is always a string for Twitter as well.
            let accountId = acc.userId || acc.id || acc.username;
            if (accountId === null || accountId === undefined || typeof accountId !== 'string') {
                accountId = `twitter-fallback-${index}`;
            } else if (typeof accountId === 'string' && accountId.trim() === '') {
                accountId = `twitter-fallback-${index}`;
            }
            const accountName = acc.name || acc.username || `Twitter Account ${index + 1}`;
            return {
              ...acc,
              id: accountId, 
              name: accountName,
            }
          });
        }
        if (socialMediaData?.tiktok && Array.isArray(socialMediaData.tiktok)) {
          console.log('Raw TikTok accounts from localStorage for modal:', JSON.stringify(socialMediaData.tiktok));
          accounts.tiktok = socialMediaData.tiktok.map((acc, index) => {
            // Ensure accountId is always a string and not null/undefined.
            // Prioritize acc.openId (from providerData), then acc.accountId (often used in frontend localStorage), then acc.id as a generic fallback.
            let accountId = acc.openId || acc.open_id || acc.accountId || acc.id;
            if (accountId === null || accountId === undefined || typeof accountId !== 'string') {
                accountId = `tiktok-fallback-${index}`;
            } else if (typeof accountId === 'string' && accountId.trim() === '') {
                // Handle empty string IDs as well with a fallback
                accountId = `tiktok-fallback-${index}`;
            }

            const accountName = acc.username || acc.display_name || acc.name || `TikTok User ${index + 1}`;
            console.log(`Mapping TikTok account for modal: raw=${JSON.stringify(acc)}, derivedId=${accountId}, derivedName=${accountName}`);
            
            // Determine the best avatar URL, prioritizing avatarUrl100
            const displayAvatarUrl = acc.avatarUrl100 || acc.avatarUrl || acc.profileImageUrl;

            return {
              ...acc, 
              id: accountId, 
              name: accountName,
              displayAvatarUrl: displayAvatarUrl, // Add this for consistent avatar handling
            };
          });
        }
        console.log("Processed platform accounts for modal logic:", accounts);
        setPlatformAccountsDetails(accounts);
      }
    } catch (error) {
      console.error('Error loading social media accounts for modal:', error);
    }
  }, []);

  // Effect to handle blob URL creation/revocation for the edit modal video
  useEffect(() => {
    let objectUrl;
    if (isEditModalOpen && editingPost?.video_url) {
      setEditModalVideoLoading(true);
      setEditModalVideoError(false);
      setEditModalBlobUrl(null); // Reset

      fetch(editingPost.video_url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch video for edit modal: ${response.status} ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          objectUrl = URL.createObjectURL(blob);
          setEditModalBlobUrl(objectUrl);
          setEditModalVideoLoading(false);
        })
        .catch(err => {
          console.error('Error fetching video for edit modal blob URL:', err);
          setEditModalVideoError(true);
          setEditModalVideoLoading(false);
        });
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setEditModalBlobUrl(null);
      }
    };
  }, [isEditModalOpen, editingPost?.video_url]);

  const allVisibleAccounts = useMemo(() => {
    if (!platformAccountsDetails) return [];
    let accounts = [];
    Object.entries(platformAccountsDetails).forEach(([platformName, accs]) => {
      // Include all accounts matching search, regardless of platform collapse state
      if (Array.isArray(accs)) {
        accs.forEach(acc => {
          if (typeof acc.name === 'string' && acc.name.toLowerCase().includes(accountSearchQuery.toLowerCase())) {
            accounts.push({ ...acc, platform: platformName });
          }
        });
      }
    });
    return accounts;
  }, [platformAccountsDetails, accountSearchQuery]);

  const areAllVisibleSelected = useMemo(() => {
    if (!allVisibleAccounts.length) return false;
    return allVisibleAccounts.every(acc =>
      selectedAccounts.some(sa => sa.platform === acc.platform && sa.accountId === acc.id)
    );
  }, [allVisibleAccounts, selectedAccounts]);

  const handleToggleSelectAllVisible = () => {
    if (areAllVisibleSelected) {
      // Unselect all accounts matching the search query
      setSelectedAccounts(prevSelected =>
        prevSelected.filter(sa =>
          !allVisibleAccounts.some(va => va.platform === sa.platform && va.id === sa.accountId)
        )
      );
    } else {
      // Select all accounts matching the search query that are not already selected
      const newSelections = allVisibleAccounts
        .filter(va => !selectedAccounts.some(sa => sa.platform === va.platform && sa.accountId === va.id))
        .map(acc => ({ platform: acc.platform, accountId: acc.id, name: acc.name }));
      setSelectedAccounts(prevSelected => [...prevSelected, ...newSelections]);
    }
  };

  const togglePlatformCollapse = (platformName) => {
    setCollapsedPlatforms(prev => ({
      ...prev,
      [platformName]: !prev[platformName]
    }));
  };

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

  // Handlers for delete confirmation modal
  const openDeleteConfirmModal = (postId) => {
    setDeletingPostId(postId);
    setIsDeleteConfirmModalOpen(true);
  };

  const closeDeleteConfirmModal = () => {
    setDeletingPostId(null);
    setIsDeleteConfirmModalOpen(false);
  };

  const handleDeletePost = async (postId) => {
    // Open the custom confirmation modal instead of using window.confirm
    openDeleteConfirmModal(postId);
  };

  const confirmDeletePost = async () => {
    if (!deletingPostId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/posts/${deletingPostId}`, {
        method: 'DELETE',
      });
      
      if (!response?.ok) {
        throw new Error('Failed to delete post');
      }
      
      // Remove the deleted post from state
      setPosts(posts.filter(post => post._id !== deletingPostId));
      
      // Close the modal
      closeDeleteConfirmModal();
      
      // Show success message
      window.showToast?.success?.('Post deleted successfully');
    } catch (err) {
      console.error('Error deleting post:', err);
      closeDeleteConfirmModal(); // Close modal even on error
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

    // Initialize selectedAccounts based on the accounts actually stored in the post object
    const initialSelected = [];
    if (post) {
      // TikTok accounts from the post
      if (post.tiktok_accounts && Array.isArray(post.tiktok_accounts)) {
        post.tiktok_accounts.forEach(savedAcc => {
          if (savedAcc && (savedAcc.openId || savedAcc.id)) { // Ensure the saved account has an ID
            initialSelected.push({
              platform: 'tiktok',
              // Use the ID from the saved post account; ensure it's a string
              accountId: String(savedAcc.openId || savedAcc.id), 
              name: savedAcc.username || savedAcc.displayName || 'TikTok Account'
            });
          }
        });
      }

      // Twitter accounts from the post
      if (post.twitter_accounts && Array.isArray(post.twitter_accounts)) {
        post.twitter_accounts.forEach(savedAcc => {
          if (savedAcc && (savedAcc.userId || savedAcc.id)) { // Ensure the saved account has an ID
            initialSelected.push({
              platform: 'twitter',
              accountId: String(savedAcc.userId || savedAcc.id),
              name: savedAcc.name || savedAcc.username || 'Twitter Account'
            });
          }
        });
      }
    }
    
    console.log('Initializing modal with selected accounts based on post data:', initialSelected);
    setSelectedAccounts(initialSelected);
    setIsEditModalOpen(true);
    setSaveError(null);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingPost(null);
    setSelectedAccounts([]); // Clear selected accounts on close
    setSaveError(null);
    // Also clear video states for the modal
    setEditModalBlobUrl(null);
    setEditModalVideoLoading(true);
    setEditModalVideoError(false);
  };

  const handleAccountToggle = (platform, accountId, accountName) => {
    setSelectedAccounts(prevSelected => {
      const isSelected = prevSelected.some(acc => acc.platform === platform && acc.accountId === accountId);
      if (isSelected) {
        return prevSelected.filter(acc => !(acc.platform === platform && acc.accountId === accountId));
      } else {
        return [...prevSelected, { platform, accountId, name: accountName }];
      }
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
    
    if (selectedAccounts.length === 0) {
      setSaveError('At least one social media account must be selected');
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
      
      const finalSelectedPlatformNames = [...new Set(selectedAccounts.map(sa => sa.platform))];
      const targetAccountsPayload = {};
      finalSelectedPlatformNames.forEach(platformName => {
        targetAccountsPayload[platformName] = selectedAccounts
          .filter(sa => sa.platform === platformName)
          .map(sa => sa.accountId);
      });
      
      // Get tokens from localStorage for the selected platforms
      const updateData = {
        post_description: editDescription,
        platforms: finalSelectedPlatformNames, // Send array of platform names
        scheduledDate: scheduledDateTime.toISOString(),
        target_accounts: targetAccountsPayload, // Send specific account IDs
      };
      
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

  // Handlers for video player modal
  const handleOpenVideoModal = (url) => {
    setVideoModalUrl(url);
    setShowVideoPlayerModal(true);
    // Reset states for the player modal when opening
    setPlayerModalBlobUrl(null);
    setPlayerModalVideoLoading(true);
    setPlayerModalVideoError(false);
  };

  const handleCloseVideoModal = () => {
    setShowVideoPlayerModal(false);
    setVideoModalUrl('');
    if (playerModalBlobUrl) {
      URL.revokeObjectURL(playerModalBlobUrl);
    }
    setPlayerModalBlobUrl(null);
    setPlayerModalVideoLoading(true); // Reset for next open
    setPlayerModalVideoError(false); // Reset for next open
  };

  // Effect to handle blob URL creation/revocation for the VIDEO PLAYER modal
  useEffect(() => {
    let objectUrl;
    if (showVideoPlayerModal && videoModalUrl) {
      setPlayerModalVideoLoading(true);
      setPlayerModalVideoError(false);
      setPlayerModalBlobUrl(null); // Reset

      fetch(videoModalUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch video for player modal: ${response.status} ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          objectUrl = URL.createObjectURL(blob);
          setPlayerModalBlobUrl(objectUrl);
          setPlayerModalVideoLoading(false);
        })
        .catch(err => {
          console.error('Error fetching video for player modal blob URL:', err);
          setPlayerModalVideoError(true);
          setPlayerModalVideoLoading(false);
        });
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        // Ensure playerModalBlobUrl is also cleared if the component unmounts while modal is open
        // However, handleCloseVideoModal should primarily handle this for explicit closes.
      }
    };
  }, [showVideoPlayerModal, videoModalUrl]);

  return (
    <>
      <Head>
        <title>Scheduled Posts | Social Lane</title>
        <meta name="description" content="View and manage your scheduled social media posts" />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-100 dark:from-slate-900 dark:to-sky-900">
        <div className="p-4 md:p-8 max-w-screen-xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 mb-2">Scheduled Posts</h1>
              <p className="text-base text-slate-600 dark:text-slate-400">
                Here&apos;s an overview of your upcoming social media content.
              </p>
            </div>
            <Link href="/media-posting" className="mt-4 sm:mt-0 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark transition-all duration-200 group">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 transform group-hover:rotate-90 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create New Post
            </Link>
          </div>
          
          <div className={`w-full ${!loading && !error && posts.length === 0 ? 'flex items-center justify-center min-h-[calc(60vh-120px)]' : ''}`}>
            {/* Removed redundant header and create button from here as it's now at the top */}

            <div className="w-full">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary-dark mb-6"></div>
                  <p className="text-xl font-semibold text-slate-700 dark:text-slate-300">Loading scheduled posts...</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Please wait a moment.</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 text-red-600 dark:text-red-400 text-center bg-red-50 dark:bg-red-900/20 p-8 rounded-lg shadow-md">
                  <div className="mb-5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                  <p className="text-xl font-semibold mb-2">{error}</p>
                  <p className="text-sm text-red-500 dark:text-red-300 mb-6">We encountered an issue trying to load your posts.</p>
                  <button onClick={fetchScheduledPosts} className="px-5 py-2.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark transition-all duration-200 shadow-sm">
                    Try Again
                  </button>
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="bg-primary/10 dark:bg-primary/20 rounded-full p-6 mb-8 shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-primary dark:text-primary-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      <path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01"/>
                    </svg>
                  </div>
                  <h2 className="text-3xl font-semibold text-slate-800 dark:text-slate-100 mb-3">No Posts Scheduled Yet</h2>
                  <p className="text-slate-600 dark:text-slate-400 mb-10 max-w-md mx-auto">
                    It looks like your content calendar is empty. Let&apos;s get something scheduled!
                  </p>
                  <Link href="/media-posting" className="px-8 py-3.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
                    Schedule Your First Post
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                  {posts.map(post => (
                    <div key={post._id} className="bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
                      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-700/30">
                        <div className="flex items-center text-slate-600 dark:text-slate-400 text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          {formatDate(post.scheduledDate)}
                        </div>
                        <div className="text-xs font-semibold text-primary-dark dark:text-primary-light bg-primary/10 dark:bg-primary/20 px-3 py-1.5 rounded-full">
                          {getTimeRemaining(post.scheduledDate)}
                        </div>
                      </div>
                      
                      <div className="p-5 flex-grow">
                        <div 
                          className="rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700/50 mb-4 aspect-video relative group cursor-pointer shadow-inner" 
                          onClick={() => post?.video_url && handleOpenVideoModal(post.video_url)}
                        >
                          <video src={post?.video_url} playsInline className="w-full h-full object-cover pointer-events-none" />
                          {post?.video_url && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 group-hover:bg-opacity-50 transition-opacity duration-300">
                              <svg className="w-14 h-14 md:w-16 md:h-16 text-white opacity-80 group-hover:opacity-100 transform group-hover:scale-110 transition-all duration-300" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7 4v16l13-8z" />
                              </svg>
                            </div>
                          )}
                          {!post?.video_url && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-700">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-400 dark:text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.573 3.855A1.002 1.002 0 0116.5 3H20a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h3.5a1 1 0 01.927.645l.386.965A1 1 0 0010.5 6H13a1 1 0 00.927-.645l.386-.965a1 1 0 01.927-.645zM12 12a3 3 0 100-6 3 3 0 000 6z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l3-2.001L15 15" />
                              </svg>
                              <p className="text-slate-500 dark:text-slate-400 text-sm">No media preview</p>
                            </div>
                          )}
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 text-sm mb-1 font-medium leading-relaxed line-clamp-2">
                          {post?.post_description || "No description provided."}
                        </p>
                        {post?.post_description && post?.post_description.length > 100 && ( // Example length check
                           <button className="text-xs text-primary dark:text-primary-light hover:underline">View more</button> // This is a placeholder for potential future expansion
                        )}
                      </div>
                      
                      <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-700/30">
                        <div className="flex items-center space-x-2">
                          {post.platforms?.includes('tiktok') && (
                            <TikTokSimpleIcon width="18" height="18" className="text-slate-600 dark:text-slate-400" />
                          )}
                          {post.platforms?.includes('twitter') && (
                            <TwitterIcon width="18" height="18" className="text-slate-600 dark:text-slate-400" />
                          )}
                          {/* Other platform icons could be added here similarly if available */}
                        </div>
                        <div className="flex items-center space-x-1">
                          <button 
                            className="p-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-primary dark:hover:text-primary-light transition-colors duration-200"
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
                            className="p-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-800/50 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
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
              <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-6xl w-full mx-4 my-8 z-10 overflow-hidden transform transition-all">
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Edit Scheduled Post</h2>
                  <button 
                    className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 focus:outline-none rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={handleCloseEditModal}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                
                <div className="p-6">
                  {saveError && (
                    <div className="col-span-1 md:col-span-2 flex items-center gap-2 p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>{saveError}</span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Publish to Accounts
                        </label>
                        {/* Search Input */}
                        <div className="mb-3">
                          <input 
                            type="text"
                            placeholder="Search accounts..."
                            className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent transition-shadow duration-200 shadow-sm"
                            value={accountSearchQuery}
                            onChange={(e) => setAccountSearchQuery(e.target.value)}
                          />
                        </div>

                        {/* Select/Unselect All Toggle */}
                        {Object.keys(platformAccountsDetails)?.length > 0 && (
                          <div className="flex items-center justify-start mb-3 mt-1">
                            <label htmlFor="select-all-toggle" className="flex items-center cursor-pointer group">
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  id="select-all-toggle"
                                  className="sr-only peer" // Hide default checkbox, add peer for styling
                                  checked={areAllVisibleSelected}
                                  onChange={handleToggleSelectAllVisible}
                                  disabled={allVisibleAccounts.length === 0}
                                />
                                {/* Switch track */}
                                <div className="w-10 h-6 bg-slate-300 dark:bg-slate-600 rounded-full peer-checked:bg-primary dark:peer-checked:bg-primary-light transition-colors duration-200"></div>
                                {/* Switch thumb */}
                                <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 peer-checked:translate-x-4"></div>
                              </div>
                              <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-primary-light transition-colors">
                                {areAllVisibleSelected ? 'Unselect All Shown' : 'Select All Shown'}
                                {allVisibleAccounts.length > 0 || accountSearchQuery ? ` (${allVisibleAccounts.length})` : ''}
                              </span>
                            </label>
                          </div>
                        )}

                        <div className="space-y-4 max-h-[420px] overflow-y-auto p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600">
                          {Object.entries(platformAccountsDetails)
                            .map(([platformName, accounts]) => {
                              // Filter accounts based on search query
                              const filteredAccounts = accounts.filter(account => 
                                account.name?.toLowerCase().includes(accountSearchQuery.toLowerCase())
                              );

                              if (filteredAccounts.length === 0 && accountSearchQuery) {
                                // If search active and no results for this platform, can optionally show nothing or a specific message
                                return null; 
                              }
                              
                              // If no accounts for this platform at all (even without search), it's handled later.

                              return (
                                (accounts && accounts.length > 0) && (
                                <div key={platformName}>
                                  <button
                                    type="button"
                                    className="flex items-center justify-between w-full text-left mb-2 group"
                                    onClick={() => togglePlatformCollapse(platformName)}
                                    aria-expanded={!collapsedPlatforms[platformName]}
                                    aria-controls={`platform-accounts-${platformName}`}
                                  >
                                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider capitalize group-hover:text-primary dark:group-hover:text-primary-light transition-colors">
                                      {platformName} ({filteredAccounts.length})
                                    </h3>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className={`h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-primary dark:group-hover:text-primary-light transition-transform duration-200 ${
                                        collapsedPlatforms[platformName] ? '-rotate-90' : 'rotate-0'
                                      }`}
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </button>
                                  {/* Conditionally render accounts based on collapsed state */}
                                  {!collapsedPlatforms[platformName] && (
                                    <div className="space-y-2" id={`platform-accounts-${platformName}`}>
                                      {filteredAccounts.length > 0 ? (
                                        filteredAccounts.map(account => (
                                          <label 
                                            key={account.id} 
                                            className="flex items-center space-x-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer has-[:checked]:bg-primary/5 has-[:checked]:border-primary/30 has-[:checked]:ring-1 has-[:checked]:ring-primary/30 dark:has-[:checked]:bg-primary/10 dark:has-[:checked]:border-primary-light/30 dark:has-[:checked]:ring-primary-light/30"
                                          >
                                            <input
                                              type="checkbox"
                                              className="h-5 w-5 text-primary rounded border-slate-300 dark:border-slate-600 focus:ring-primary dark:focus:ring-primary-light focus:ring-offset-0 shrink-0 bg-white dark:bg-slate-700 checked:bg-primary dark:checked:bg-primary-light"
                                              checked={selectedAccounts.some(sa => sa.platform === platformName && sa.accountId === account.id)}
                                              onChange={() => handleAccountToggle(platformName, account.id, account.name)}
                                            />
                                            {/* Account Avatar */}
                                            <img 
                                              src={account.displayAvatarUrl || account.avatarUrl || account.profileImageUrl || 'https://via.placeholder.com/40?text=N/A'} 
                                              alt={account.name}
                                              className="h-8 w-8 rounded-full object-cover shrink-0"
                                            />
                                            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate" title={account.name}>{account.name}</span>
                                          </label>
                                        ))
                                      ) : (
                                        <p className="text-sm text-slate-400 dark:text-slate-500 italic px-1">
                                          No {platformName} accounts match your search.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                )
                              );
                            })}
                          
                          {/* Overall message if no accounts are available or match search */}
                          {Object.values(platformAccountsDetails).every(accounts => accounts.filter(acc => 
                            typeof acc.name === 'string' && acc.name.toLowerCase().includes(accountSearchQuery.toLowerCase())
                          ).length === 0) && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 py-3 text-center">
                              {accountSearchQuery ? 'No accounts match your search.' : 'No social media accounts connected. Please connect accounts in settings.'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="scheduled-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Date
                          </label>
                          <input
                            id="scheduled-date"
                            type="date"
                            className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent transition-shadow duration-200 shadow-sm"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="scheduled-time" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Time
                          </label>
                          <input
                            id="scheduled-time"
                            type="time"
                            className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent transition-shadow duration-200 shadow-sm"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Media Preview</label>
                        {editingPost?.video_url ? (
                          editModalVideoLoading ? (
                            <div className="aspect-w-16 aspect-h-9 bg-slate-200 dark:bg-slate-700 flex items-center justify-center rounded shadow-inner">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700 dark:border-slate-300"></div>
                            </div>
                          ) : editModalVideoError ? (
                            <div className="aspect-w-16 aspect-h-9 bg-slate-100 dark:bg-slate-700/50 flex flex-col items-center justify-center p-3 rounded border border-red-300 dark:border-red-500/50 shadow-inner">
                              <svg className="w-10 h-10 text-red-400 dark:text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                              <p className="text-red-700 dark:text-red-300 text-sm font-medium">Error loading media</p>
                            </div>
                          ) : editModalBlobUrl ? (
                            <video
                              src={editModalBlobUrl}
                              controls
                              className="w-full rounded shadow-md max-h-[300px]"
                              onError={() => setEditModalVideoError(true)} // Simple error handling for the video element itself
                            ></video>
                          ) : (
                             <div className="aspect-w-16 aspect-h-9 bg-slate-100 dark:bg-slate-700/50 flex flex-col items-center justify-center p-3 rounded border border-slate-300 dark:border-slate-600 shadow-inner">
                              <svg className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                              <p className="text-slate-600 dark:text-slate-400 text-sm">Media preview unavailable</p>
                            </div>
                          )
                        ) : (
                          <p className="text-sm text-slate-500 dark:text-slate-400">No media associated with this post.</p>
                        )}
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Media cannot be changed. Create a new post to use a different video or image.</p>
                      </div>

                      <div>
                        <label htmlFor="post-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Description
                        </label>
                        <textarea
                          id="post-description"
                          className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent transition-shadow duration-200 resize-none shadow-sm"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Enter your post description"
                          rows={6}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                  <button 
                    type="button"
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-primary-light transition-colors duration-200"
                    onClick={handleCloseEditModal}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
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

          {/* Video Player Modal */}
          {showVideoPlayerModal && videoModalUrl && (
            <div className="fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden flex items-center justify-center" aria-modal="true" role="dialog">
              <div className="fixed inset-0 bg-black/50 backdrop-blur-md transition-opacity" onClick={handleCloseVideoModal}></div>
              <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-4 my-8 z-10 transform transition-all">
                <div className="flex items-center justify-between px-4 py-3 md:px-6 md:pt-4 md:pb-3 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="text-lg md:text-xl font-semibold text-slate-800 dark:text-slate-100">Media Preview</h2>
                  <button 
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                    onClick={handleCloseVideoModal}
                    aria-label="Close video player"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                <div className="p-2 md:p-1 bg-black rounded-b-xl">
                  {playerModalVideoLoading ? (
                    <div className="aspect-video flex items-center justify-center bg-slate-800 dark:bg-black rounded-b-lg min-h-[200px]">
                      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-300 dark:border-slate-500"></div>
                    </div>
                  ) : playerModalVideoError ? (
                    <div className="aspect-video flex flex-col items-center justify-center bg-slate-800 dark:bg-black rounded-b-lg text-white p-4 min-h-[200px]">
                      <svg className="w-12 h-12 text-red-400 dark:text-red-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      <p className="text-sm font-medium">Error loading media</p>
                      <p className="text-xs text-gray-400 mt-1">Please try again later.</p>
                    </div>
                  ) : playerModalBlobUrl ? (
                    <video 
                      src={playerModalBlobUrl} 
                      controls 
                      autoPlay 
                      playsInline 
                      className="w-full h-auto max-h-[80vh] rounded-b-lg"
                      onError={(e) => {
                        console.error("Error playing media in modal:", e);
                        setPlayerModalVideoError(true); // Set error if video element itself fails
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="aspect-video flex items-center justify-center bg-slate-800 dark:bg-black rounded-b-lg min-h-[200px]">
                      <p className="text-slate-400 dark:text-slate-500">Media could not be loaded.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal - Now using the global component */}
          <ConfirmationModal
            isOpen={isDeleteConfirmModalOpen}
            onClose={closeDeleteConfirmModal}
            onConfirm={confirmDeletePost}
            title="Delete Scheduled Post"
            message="Are you sure you want to delete this scheduled post? This action cannot be undone."
            confirmButtonText="Confirm Delete"
            confirmButtonClassName="bg-red-600 hover:bg-red-700 text-white focus:ring-red-500"
            icon={(
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-800/30 sm:mx-0 sm:h-10 sm:w-10">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            )}
          />
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