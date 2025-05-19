import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { TikTokSimpleIcon, TwitterIcon } from '../src/components/icons/SocialIcons';
import ProtectedRoute from '../src/components/ProtectedRoute';
import { getUserLimits, getPostUsage } from '../src/services/userService';

// Enhanced fetch with timeout and retry utility - REMAINS UNCHANGED
const fetchWithTimeoutAndRetry = async (url, options = {}, timeout = 120000, maxRetries = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            // console.log(`API attempt ${attempt}/${maxRetries} for ${url}`); // Reduced logging noise
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            // Improved error check for non-JSON server errors
            if (!response.ok && !(response.headers.get('content-type') || '').includes('application/json')) {
                let text = 'Server error'; try { text = await response.text(); } catch (e) { }
                throw new Error(`Server error ${response.status}: ${text.substring(0, 150)}`);
            }
            return response; // Return OK or JSON error response
        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error;
            console.error(`API attempt ${attempt} failed:`, error?.message || error);
            if (attempt < maxRetries && !(error instanceof DOMException && error.name === 'AbortError')) {
                const delay = 2000 * Math.pow(2, attempt - 1);
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else { break; }
        }
    }
    throw lastError || new Error(`All ${maxRetries} retry attempts failed or request was aborted.`);
};

function ImagePosting() {
    // --- State variables ---
    const [files, setFiles] = useState([]); // Holds the selected File objects for multiple images
    const [uploadedFileNames, setUploadedFileNames] = useState([]); // Holds the names of the selected files
    const [localPreviewUrls, setLocalPreviewUrls] = useState([]); // Holds the blob URLs for local previews
    const [isUploading, setIsUploading] = useState(false); // True during the actual XHR upload process
    const [isProcessingUpload, setIsProcessingUpload] = useState(false); // True after upload finishes, before post/schedule API calls start
    const [uploadProgress, setUploadProgress] = useState(0);
    const [imageUrls, setImageUrls] = useState([]); // Holds the R2 URLs after successful uploads
    const [imageThumbnails, setImageThumbnails] = useState([]); // Thumbnails for previewing images
    const [tiktokAccounts, setTiktokAccounts] = useState([]);
    const [selectedTiktokAccounts, setSelectedTiktokAccounts] = useState([]);
    const [twitterAccounts, setTwitterAccounts] = useState([]);
    const [selectedTwitterAccounts, setSelectedTwitterAccounts] = useState([]);
    const [caption, setCaption] = useState('');
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledDate, setScheduledDate] = useState(''); // YYYY-MM-DD
    const [scheduledTime, setScheduledTime] = useState(''); // HH:MM (24-hour)
    const [isPosting, setIsPosting] = useState(false); // True during API calls for posting/scheduling (after upload processing)
    const [isScheduling, setIsScheduling] = useState(false); // Specific flag for scheduling mode API calls
    const [uploadError, setUploadError] = useState(null);
    const [postSuccess, setPostSuccess] = useState(false); // Overall success (post now or schedule)
    const [scheduleSuccess, setScheduleSuccess] = useState(false); // Specific for schedule success UI
    const [platformResults, setPlatformResults] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [userId, setUserId] = useState('');
    const [userLimits, setUserLimits] = useState(null); // Add state for user limits
    const [limitsLoading, setLimitsLoading] = useState(true); // Loading state for limits
    const [limitsError, setLimitsError] = useState(null); // Error state for limits
    const [postUsage, setPostUsage] = useState(null);
    const [postUsageLoading, setPostUsageLoading] = useState(true);
    const [postUsageError, setPostUsageError] = useState(null);
    const fileInputRef = useRef(null);
    const localPreviewUrlsRef = useRef(localPreviewUrls); // Added ref for unmount cleanup
    const [showImageModal, setShowImageModal] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0); // For viewing images in modal
    const [accountStatus, setAccountStatus] = useState({ tiktok: {}, twitter: {} });
    const [showLoader, setShowLoader] = useState(false); // Controls visibility of the PostingLoader modal
    const [createdPostId, setCreatedPostId] = useState(null); // New state variable to store the ID of the created post
    const [postError, setPostError] = useState('');
    const [uploadedMedia, setUploadedMedia] = useState([]); // New state variable to store uploaded media
    const [isAddingImages, setIsAddingImages] = useState(false); // New state to track whether we're adding or replacing images

    // --- Format Date Function ---
    const formatDate = (dateString, timeString) => {
        if (!dateString || !timeString) return 'Invalid Date/Time';
        try {
            // Combine date and time strings and create a Date object
            // Assume dateString is YYYY-MM-DD and timeString is HH:MM
            const dateTime = new Date(`${dateString}T${timeString}`);
            if (isNaN(dateTime.getTime())) {
                console.error('Invalid date/time combination for formatting:', dateString, timeString);
                return 'Invalid Date';
            }
            const options = { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
            };
            return dateTime.toLocaleString('en-US', options);
        } catch (error) {
            console.error('Error formatting date/time:', error);
            return 'Error Formatting';
        }
    };

    // Define fetchPostUsage with useCallback so it can be called from handlePost
    const fetchPostUsage = useCallback(async () => {
        if (!userId) return;
        setPostUsageLoading(true);
        setPostUsageError(null);
        try {
            // Assuming getPostUsage is imported correctly
            const usageResponse = await getPostUsage(userId);
            if (usageResponse?.success && usageResponse?.data) {
                console.log('Post usage received:', usageResponse.data);
                setPostUsage(usageResponse.data);
            } else {
                console.error('Failed to fetch post usage:', usageResponse?.error);
                setPostUsageError(usageResponse?.error || 'Failed to load post usage data.');
                setPostUsage(null);
            }
        } catch (error) {
            console.error('Error fetching post usage:', error);
            setPostUsageError('An error occurred while fetching post usage data.');
            setPostUsage(null);
        } finally {
            setPostUsageLoading(false);
        }
    }, [userId, setPostUsageLoading, setPostUsageError, setPostUsage]);

    // --- useEffects for loading user data and accounts ---
    useEffect(() => {
        const firebaseUid = localStorage?.getItem('firebaseUid');
        if (firebaseUid) {
            setUserId(firebaseUid);
            localStorage?.setItem('userId', firebaseUid);
        } else {
            const storedUserId = localStorage?.getItem('userId');
            if (storedUserId) {
                setUserId(storedUserId);
                console.warn('Using potentially outdated userId from localStorage.');
            } else {
                console.error('No user ID found! Cannot function correctly.');
            }
        }
    }, []);

    // Fetch user limits when userId changes
    useEffect(() => {
        const fetchLimits = async () => {
            if (!userId) return;
            setLimitsLoading(true);
            setLimitsError(null);
            try {
                console.log(`Fetching limits for user ${userId}`);
                const limitsResponse = await getUserLimits(userId);
                if (limitsResponse?.success && limitsResponse?.data) {
                    console.log('User limits received:', limitsResponse.data);
                    setUserLimits(limitsResponse.data);
                } else {
                    console.error('Failed to fetch user limits:', limitsResponse?.error);
                    setLimitsError(limitsResponse?.error || 'Failed to load usage limits.');
                    setUserLimits(null); // Clear any previous limits
                }
            } catch (error) {
                console.error('Error fetching user limits:', error);
                setLimitsError('An error occurred while fetching usage limits.');
                setUserLimits(null);
            } finally {
                setLimitsLoading(false);
            }
        };
        fetchLimits();
    }, [userId]);

    // Fetch post usage when userId changes
    useEffect(() => {
        fetchPostUsage(); // Call the function defined above
    }, [fetchPostUsage]); // Depend on the useCallback function

    const fetchSocialMediaAccounts = useCallback(async () => {
        if (!userId) { console.log("Skipping account fetch: userId not available yet."); return false; }
        try {
            console.log('Fetching social accounts for user:', userId);
            const response = await fetch(`/api/users/${userId}`);
            if (!response.ok) throw new Error(`Error fetching user data: ${response.status}`);
            const userData = await response.json();
            let accountsFoundInDb = false;
            if (userData?.success && userData?.data?.providerData) {
                let socialMediaData = {};
                try { const d = localStorage.getItem('socialMediaData'); if (d) socialMediaData = JSON.parse(d); } catch (e) { }
                const twitterData = userData.data.providerData.twitter;
                if (twitterData) {
                    const fetchedTwitter = Array.isArray(twitterData) ? twitterData : [twitterData];
                    const formattedTwitter = fetchedTwitter.filter(a => a?.userId).map(a => ({ userId: a.userId, username: a.username || a.screen_name || '', name: a.name || a.displayName || a.username || 'Twitter User', profileImageUrl: a.profileImageUrl || a.profile_image_url || '' }));
                    if (formattedTwitter.length > 0) { socialMediaData.twitter = formattedTwitter; setTwitterAccounts(formattedTwitter); accountsFoundInDb = true; }
                } else { console.log("No Twitter data in DB response for this user."); }
                const tiktokData = userData.data.providerData.tiktok;
                if (tiktokData) {
                    const fetchedTiktok = Array.isArray(tiktokData) ? tiktokData : [tiktokData];
                    const formattedTiktok = fetchedTiktok.filter(a => a?.accountId || a?.openId).map(a => ({ 
                        accountId: a.accountId || a.openId, 
                        username: a.username || a.userInfo?.username || '', 
                        displayName: a.displayName || a.userInfo?.display_name || '', 
                        avatarUrl: a.avatarUrl || a.userInfo?.avatar_url || '',
                        avatarUrl100: a.avatarUrl100 || a.userInfo?.avatar_url_100 || '', 
                        userInfo: a.userInfo || {} 
                    }));
                    if (formattedTiktok.length > 0) { socialMediaData.tiktok = formattedTiktok; setTiktokAccounts(formattedTiktok); accountsFoundInDb = true; }
                } else { console.log("No TikTok data in DB response for this user."); }
                localStorage.setItem('socialMediaData', JSON.stringify(socialMediaData));
                if (accountsFoundInDb) { localStorage.setItem('socialMediaDataUpdated', Date.now().toString()); console.log('Updated accounts saved to localStorage from DB fetch.'); }
                return accountsFoundInDb;
            } else { console.log('No social provider data structure in user data from DB.'); return false; }
        } catch (error) { console.error('Error fetching/processing social media accounts:', error); return false; }
    }, [userId]);

    const loadAccountsFromStorage = useCallback(() => {
        let tiktokLoaded = false, twitterLoaded = false;
        try {
            const str = localStorage?.getItem('socialMediaData');
            if (str) {
                const data = JSON.parse(str);
                if (data?.tiktok?.length) { const validTiktok = data.tiktok.filter(a => a?.accountId); if (validTiktok.length) { setTiktokAccounts(validTiktok); tiktokLoaded = true; } }
                if (data?.twitter?.length) { const validTwitter = data.twitter.filter(a => a?.userId); if (validTwitter.length) { setTwitterAccounts(validTwitter); twitterLoaded = true; } }
            }
            console.log(`Storage Load Attempt - TikTok: ${tiktokLoaded}, Twitter: ${twitterLoaded}`);
        } catch (e) { console.error('Load accounts storage error:', e); }
        return { tiktokLoaded, twitterLoaded };
    }, []);

    useEffect(() => {
        const loadAllAccounts = async () => {
            console.log("Running loadAllAccounts...");
            const { tiktokLoaded, twitterLoaded } = loadAccountsFromStorage();
            if (!tiktokLoaded || !twitterLoaded) { console.log("Fetching from DB because storage was incomplete."); await fetchSocialMediaAccounts(); }
            else { console.log("Accounts loaded from storage initially."); }
        };
        if (userId) { loadAllAccounts(); }
    }, [userId, loadAccountsFromStorage, fetchSocialMediaAccounts]);

    // useEffect to keep localPreviewUrlsRef updated
    useEffect(() => {
        localPreviewUrlsRef.current = localPreviewUrls;
    }, [localPreviewUrls]);

    // useEffect for unmount cleanup of blob URLs
    useEffect(() => {
        return () => {
            // Clean up any blob URLs to prevent memory leaks on unmount
            localPreviewUrlsRef.current.forEach(url => {
                if (url && url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, []); // Empty dependency array ensures this runs only on unmount

    // Computed property for post limit status
    const { isPostLimitReached, postLimitMessage } = useMemo(() => {
        if (!userLimits || !postUsage) return { isPostLimitReached: false, postLimitMessage: '' };
        
        const postsUsed = postUsage.postsUsed || 0;
        const postsLimit = userLimits.posts || 0;
        const isReached = postsLimit > 0 && postsUsed >= postsLimit;
        const message = isReached ? `You have reached your limit of ${postsLimit} posts for your ${userLimits.role} plan. Please upgrade to post more.` : '';
        
        return { isPostLimitReached: isReached, postLimitMessage: message };
    }, [userLimits, postUsage]);

    // --- Account toggle handlers ---
    const handleTikTokAccountToggle = (account) => {
        if (isPostLimitReached || !account?.accountId) return;
        setSelectedTiktokAccounts(prev => {
            const isSelected = prev.some(acc => acc?.accountId === account?.accountId);
            
            // If removing an account, always allow it
            if (isSelected) {
                return prev.filter(acc => acc?.accountId !== account?.accountId);
            }
            
            // If adding an account, check against the user's plan limit
            if (userLimits && userLimits.role === 'Starter') {
                const currentSelectedCount = prev.length + selectedTwitterAccounts.length;
                const accountLimit = userLimits.socialAccounts;
                
                // Show error message if limit reached
                if (currentSelectedCount >= accountLimit) {
                    window.showToast?.error?.(`Your ${userLimits.role} plan allows only ${accountLimit} social account(s). Please upgrade your plan or deselect another account.`);
                    return prev;
                }
            }
            
            return [...prev, account];
        });
    };
    
    const handleTwitterAccountToggle = (account) => {
        if (isPostLimitReached || !account?.userId) return;
        setSelectedTwitterAccounts(prev => {
            const isSelected = prev.some(acc => acc?.userId === account?.userId);
            
            // If removing an account, always allow it
            if (isSelected) {
                return prev.filter(acc => acc?.userId !== account?.userId);
            }
            
            // If adding an account, check against the user's plan limit
            if (userLimits && userLimits.role === 'Starter') {
                const currentSelectedCount = prev.length + selectedTiktokAccounts.length;
                const accountLimit = userLimits.socialAccounts;
                
                // Show error message if limit reached
                if (currentSelectedCount >= accountLimit) {
                    window.showToast?.error?.(`Your ${userLimits.role} plan allows only ${accountLimit} social account(s). Please upgrade your plan or deselect another account.`);
                    return prev;
                }
            }
            
            return [...prev, account];
        });
    };

    // --- File handling logic ---
    const handleFileChange = (e) => {
        // Cache the current value of isAddingImages at the beginning
        const addingImages = isAddingImages;
        
        if (isPostLimitReached || isUploading || isProcessingUpload || isPosting || isScheduling) return;
        
        const selectedFiles = Array.from(e?.target?.files || []);
        if (selectedFiles.length === 0) {
            // Reset the adding mode even if no files are selected
            setIsAddingImages(false);
            return;
        }
        
        // Validate file types and sizes
        const invalidFiles = selectedFiles.filter(file => !file.type.startsWith('image/'));
        if (invalidFiles.length > 0) {
            setUploadError('Please select only image files.');
            setIsAddingImages(false);
            return;
        }
        
        const oversizedFiles = selectedFiles.filter(file => file.size > 50 * 1024 * 1024); // 50MB limit
        if (oversizedFiles.length > 0) {
            setUploadError('One or more files exceed the 50MB size limit.');
            setIsAddingImages(false);
            return;
        }
        
        // Reset only error states and processing flags
        setUploadError(null);
        setPostSuccess(false);
        setScheduleSuccess(false);
        setPlatformResults({});
        setAccountStatus({ tiktok: {}, twitter: {} });
        setIsUploading(false);
        setIsProcessingUpload(false);
        setIsPosting(false);
        setIsScheduling(false);
        setUploadProgress(0);
        
        if (addingImages) {
            // Adding to existing images
            // Combine existing files with new ones
            const newFilesList = [...files, ...selectedFiles];
            setFiles(newFilesList);
            setUploadedFileNames([...uploadedFileNames, ...selectedFiles.map(file => file.name)]);
            
            // Create blob URLs for new files
            const newLocalUrlsToAdd = selectedFiles.map(file => URL.createObjectURL(file));
            setLocalPreviewUrls([...localPreviewUrls, ...newLocalUrlsToAdd]);
            
            // Add to thumbnails
            setImageThumbnails([...imageThumbnails, ...newLocalUrlsToAdd]);
            
            // Reset upload URLs - they'll be regenerated when user submits
            setImageUrls([]);
            
            console.log('Added', selectedFiles.length, 'more images. Total:', newFilesList.length);
        } else {
            // Replacing images (original behavior)
            // Revoke old localPreviewUrls before creating new ones
            localPreviewUrls.forEach(url => {
                if (url && url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            });

            // Clear all previous data
            setImageUrls([]);
            setImageThumbnails([]);
            
            // Store new files and create preview URLs
            setFiles(selectedFiles);
            setUploadedFileNames(selectedFiles.map(file => file.name));
            
            // Create blob URLs for preview
            const newLocalUrls = selectedFiles.map(file => URL.createObjectURL(file));
            setLocalPreviewUrls(newLocalUrls);
            
            // Set thumbnails (for images, we can use the same URLs)
            setImageThumbnails(newLocalUrls);
            
            console.log('Replaced with', selectedFiles.length, 'new images');
        }
        
        // Reset the add mode flag after handling the file change
        setIsAddingImages(false);
    };

    // --- Reset Form Function ---
    const resetForNewPost = () => {
        // Revoke existing blob URLs before clearing states
        localPreviewUrls.forEach(url => {
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });

        setFiles([]);
        setUploadedFileNames([]);
        setLocalPreviewUrls([]);
        setImageUrls([]);
        setImageThumbnails([]);
        setUploadedMedia([]);
        setCaption('');
        setIsScheduled(false);
        setScheduledDate('');
        setScheduledTime('');
        setSelectedTiktokAccounts([]);
        setSelectedTwitterAccounts([]);
        setPlatformResults({});
        setPostSuccess(false);
        setScheduleSuccess(false);
        setUploadError(null);
        setSearchTerm('');
        setAccountStatus({ tiktok: {}, twitter: {} });
        setIsUploading(false);
        setIsProcessingUpload(false);
        setIsPosting(false);
        setIsScheduling(false);
        setUploadProgress(0);
        setShowLoader(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        window.scrollTo(0, 0);
        // Add page reload
        window.location.reload();
    };

    const handleUploadClick = () => {
        if (isPostLimitReached || isUploading || isProcessingUpload || isPosting || isScheduling) return;
        
        if (!fileInputRef.current) {
            console.error('File input reference is not available');
            window.showToast?.error?.('Cannot open file selector. Please try again.');
            return;
        }
        
        fileInputRef.current.click();
    };

    const handleAddMoreImagesClick = () => {
        if (isPostLimitReached || isUploading || isProcessingUpload || isPosting || isScheduling) {
            console.log('Add More Images clicked but disabled due to state limitations');
            return;
        }
        
        console.log('Add More Images clicked, setting adding mode to true');
        setUploadError(null);
        setIsAddingImages(true); // Set to add mode
        
        // Safety check
        if (!fileInputRef || !fileInputRef.current) {
            console.error('File input reference is not available');
            window.showToast?.error?.('Cannot open file selector. Please try again.');
            return;
        }
        
        console.log('File input ref exists, resetting value and triggering click');
        // Reset the file input value to ensure onChange fires even if selecting the same files
        fileInputRef.current.value = '';
        
        // Use a more reliable method to trigger the file input
        // Trigger click directly instead of using setTimeout
        try {
            console.log('Triggering file input click');
            fileInputRef.current.click();
        } catch (err) {
            console.error('Error triggering file input click:', err);
            window.showToast?.error?.('Failed to open file selector. Please try again.');
        }
    };

    const handleReplaceMediaClick = () => {
        if (isPostLimitReached || isUploading || isProcessingUpload || isPosting || isScheduling) return;
        
        // Clean up existing blob URLs to prevent memory leaks
        localPreviewUrls.forEach(url => {
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });
        
        setFiles([]);
        setUploadedFileNames([]);
        setLocalPreviewUrls([]);
        setImageUrls([]);
        setImageThumbnails([]);
        setUploadedMedia([]);
        setUploadError(null);
        setIsAddingImages(false); // Make sure we're in replace mode
        
        // Safety check
        if (!fileInputRef || !fileInputRef.current) {
            console.error('File input reference is not available');
            window.showToast?.error?.('Cannot open file selector. Please try again.');
            return;
        }
        
        fileInputRef.current.value = '';
        
        try {
            fileInputRef.current.click();
        } catch (err) {
            console.error('Error triggering file input click:', err);
            window.showToast?.error?.('Failed to open file selector. Please try again.');
        }
    };

    // --- Modified File Upload Function (for multiple files) ---
    const handleFileUpload = async (filesToUpload) => {
        if (!filesToUpload || filesToUpload.length === 0) {
            return { success: false, error: 'No files to upload.' };
        }
        
        // Validate files
        const invalidFiles = filesToUpload.filter(file => !file.type.startsWith('image/'));
        if (invalidFiles.length > 0) {
            return { success: false, error: 'Only image files are allowed.' };
        }
        
        const oversizedFiles = filesToUpload.filter(file => file.size > 50 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            return { success: false, error: 'One or more files exceed the 50MB size limit.' };
        }
        
        setIsUploading(true);
        setIsProcessingUpload(false);
        setUploadProgress(0);
        setUploadError(null);
        setShowLoader(true);
        console.log(`Starting upload of ${filesToUpload.length} image(s) to R2...`);
        
        try {
            // Upload each file and collect URLs
            const uploadResults = [];
            
            for (let i = 0; i < filesToUpload.length; i++) {
                const file = filesToUpload[i];
                console.log(`Uploading file ${i+1}/${filesToUpload.length}: ${file.name}`);
                
                try {
                    const result = await uploadSingleFile(file, i, filesToUpload.length);
                    if (result.success) {
                        uploadResults.push(result.url);
                    } else {
                        throw new Error(`Failed to upload file ${i+1}: ${result.error}`);
                    }
                } catch (singleFileError) {
                    console.error(`Error uploading file ${i+1}:`, singleFileError);
                    throw singleFileError;
                }
            }
            
            // All uploads completed successfully
            setImageUrls(uploadResults);
            // Also set the uploadedMedia state with the uploaded files
            setUploadedMedia(uploadResults.map(url => ({ url })));
            setIsUploading(false);
            setIsProcessingUpload(true);
            return { success: true, urls: uploadResults };
            
        } catch (error) {
            console.error('Upload function error:', error);
            setIsUploading(false);
            setIsProcessingUpload(false);
            setUploadProgress(0);
            setUploadError(error?.message || 'Upload failed');
            setShowLoader(false);
            return { success: false, error: error?.message || 'Upload failed' };
        }
    };
    
    // Helper function to upload a single file
    const uploadSingleFile = async (file, index, totalFiles) => {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            
            const xhr = new XMLHttpRequest();
            
            // Track progress for this individual file
            xhr.upload.addEventListener('progress', (event) => {
                if (event?.lengthComputable) {
                    // Calculate overall progress accounting for previously uploaded files
                    const singleFileProgress = (event.loaded / event.total);
                    const overallProgress = Math.round(((index + singleFileProgress) / totalFiles) * 100);
                    setUploadProgress(overallProgress);
                }
            });
            
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const responseData = JSON.parse(xhr.responseText);
                        if (responseData?.success && responseData?.url) {
                            resolve({ success: true, url: responseData.url });
                        } else {
                            reject(new Error(responseData?.error || 'Upload succeeded but response format is invalid or missing URL'));
                        }
                    } catch (e) {
                        reject(new Error('Invalid JSON response from upload server'));
                    }
                } else {
                    let errorMsg = `Upload failed with status ${xhr.status}`;
                    try {
                        const errResp = JSON.parse(xhr.responseText);
                        errorMsg = errResp.error || errResp.message || errorMsg;
                    } catch (e) {
                        errorMsg = `${errorMsg}: ${xhr.statusText || 'Server error'}`;
                    }
                    reject(new Error(errorMsg));
                }
            };
            
            // Error handling
            const handleError = (msg) => {
                console.error("XHR Error:", msg);
                reject(new Error(msg));
            };
            
            xhr.onerror = () => handleError('Network error during upload');
            xhr.ontimeout = () => handleError('Upload timed out');
            xhr.timeout = 600000; // 10 minutes
            xhr.addEventListener('error', () => handleError('An unexpected error occurred during upload'));
            
            xhr.open('POST', '/api/upload', true);
            xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
            xhr.send(formData);
        });
    };

    // --- FIXED Timezone Handling in getScheduledDateTime ---
    const getScheduledDateTime = useCallback((checkOnly = false) => {
        if (!isScheduled || !scheduledDate || !scheduledTime) { if (checkOnly) return null; return null; }
        try {
            const dateParts = scheduledDate.split('-');
            const timeParts = scheduledTime.split(':');
            const year = parseInt(dateParts[0], 10), month = parseInt(dateParts[1], 10) - 1, day = parseInt(dateParts[2], 10);
            const hours = parseInt(timeParts[0], 10), minutes = parseInt(timeParts[1], 10);
            if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes) || month < 0 || month > 11 || day < 1 || day > 31 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                throw new Error('Invalid date/time number format');
            }
            const scheduledAtLocal = new Date(year, month, day, hours, minutes); // LOCAL Time
            const minimumTimeLocal = new Date(Date.now() + 1 * 60 * 1000); // ~1 min buffer LOCAL
            if (scheduledAtLocal <= minimumTimeLocal) {
                if (checkOnly) return null;
                throw new Error('Schedule time must be at least 1 minute in the future');
            }
            return scheduledAtLocal; // Return LOCAL Date object
        } catch (error) {
            console.error("Get schedule date/time error:", error);
            if (checkOnly) return null;
            throw error;
        }
    }, [isScheduled, scheduledDate, scheduledTime]);

    // --- handlePost (Modified to handle multiple images) ---
    const handlePost = async () => {
        if (isPosting) return;
        
        // Basic validation
        if (!files || files.length === 0) {
            setPostError('Please upload at least one image');
            return;
        }
        
        // Platform selection validation
        const hasSelectedTiktok = selectedTiktokAccounts.length > 0;
        const hasSelectedTwitter = selectedTwitterAccounts.length > 0;
        
        if (!hasSelectedTiktok && !hasSelectedTwitter) {
            setPostError('Please select at least one account to post to');
            return;
        }

        // Validate scheduled date/time if scheduling is enabled
        if (isScheduled) {
            try {
                const scheduledAtLocal = getScheduledDateTime();
                if (!scheduledAtLocal) {
                    setPostError('Please enter a valid date and time for scheduling');
                    return;
                }
            } catch (error) {
                setPostError(error.message || 'Invalid scheduling date/time');
                return;
            }
        }
        
        // Validation passed, start posting process
        setIsPosting(true);
        setIsScheduling(isScheduled); // Set scheduling flag if applicable
        setShowLoader(true);
        setPlatformResults([]);
        setPostError('');
        
        try {
            // First ensure files are uploaded
            let imageUrls = [];
            
            // Check if we already have uploaded media
            if (uploadedMedia.length > 0 && uploadedMedia.length === files.length) {
                console.log('Using already uploaded media');
                imageUrls = uploadedMedia.map(media => media.url);
                setIsProcessingUpload(false); // Clear if bypassing fresh upload
            } else {
                // Upload the files first
                console.log('Uploading files before posting');
                const uploadResult = await handleFileUpload(files);
                if (!uploadResult.success) {
                    throw new Error(uploadResult.error || 'Failed to upload images');
                }
                imageUrls = uploadResult.urls;
                // isProcessingUpload is true if handleFileUpload succeeded
            }

            setIsProcessingUpload(false); // Ensure this is false before actual posting starts
            console.log('Using image URLs for posting:', imageUrls);

            // Check if this is a scheduled post
            if (isScheduled) {
                // Get the scheduled date/time
                const scheduledAtLocal = getScheduledDateTime();
                if (!scheduledAtLocal) {
                    throw new Error('Invalid scheduling date/time');
                }

                // Prepare platforms array
                const platforms = [];
                if (hasSelectedTiktok) platforms.push('tiktok');
                if (hasSelectedTwitter) platforms.push('twitter');

                // Create payload for backend scheduling
                const payload = {
                    userId,
                    isScheduled: true,
                    scheduledDate: scheduledAtLocal.toISOString(),
                    platforms,
                    post_description: caption,
                    // For backward compatibility with backend, use video_url for the first image
                    // and include all images in the imageUrls array
                    video_url: imageUrls[0],
                    imageUrls: imageUrls,
                    tiktok_accounts: selectedTiktokAccounts.map(acc => ({ 
                        accountId: acc.accountId, 
                        username: acc.username, 
                        displayName: acc.displayName 
                    })),
                    twitter_accounts: selectedTwitterAccounts.map(acc => ({ 
                        userId: acc.userId, 
                        username: acc.username 
                    }))
                };

                console.log('Scheduling post with payload:', payload);

                // Send to backend posts API
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sociallane-backend.mindio.chat';
                const fullApiUrl = `${backendUrl}/posts`;
                
                const response = await fetchWithTimeoutAndRetry(fullApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.error || result.message || 'Failed to schedule post');
                }

                // Set success state for scheduled post
                setScheduleSuccess(true);
                setPostSuccess(true);
                setPlatformResults({
                    tiktok: hasSelectedTiktok ? { 
                        success: true, 
                        results: selectedTiktokAccounts.map(acc => ({
                            displayName: acc.displayName || acc.username,
                            success: true,
                            message: 'Scheduled for posting'
                        }))
                    } : undefined,
                    twitter: hasSelectedTwitter ? { 
                        success: true, 
                        results: selectedTwitterAccounts.map(acc => ({
                            username: acc.username,
                            success: true,
                            message: 'Scheduled for posting'
                        }))
                    } : undefined
                });

                // Set created post ID if available in the response
                if (result.post?._id) {
                    setCreatedPostId(result.post._id);
                }

                setIsPosting(false);
                setIsScheduling(false);
                
                // Update post usage counts
                fetchPostUsage();
                
                return;
            }
            
            // Continue with immediate posting if not scheduled
            let hasErrors = false;
            let errorMessage = '';
            let needsReconnect = false;
            let invalidMediaFormat = false;
            
            // Results storage for all platforms
            const results = [];
            let overallSuccess = true;
            
            // TikTok posting
            if (hasSelectedTiktok) {
                let tiktokResult;
                
                if (selectedTiktokAccounts.length === 1) {
                    // Single account posting
                    tiktokResult = await postToSingleTikTokAccount(imageUrls, selectedTiktokAccounts[0]);
                    
                    if (!tiktokResult.success) {
                        hasErrors = true;
                        errorMessage = tiktokResult.error;
                        needsReconnect = tiktokResult.requiresReconnect;
                        invalidMediaFormat = tiktokResult.invalidMediaFormat;
                        
                        results.push({
                            platform: 'tiktok',
                            account: selectedTiktokAccounts[0], // Correctly assign the account object
                            success: false,
                            error: tiktokResult.error,
                            requiresReconnect: needsReconnect,
                            invalidMediaFormat: invalidMediaFormat
                        });
                    } else {
                        results.push({
                            platform: 'tiktok',
                            account: selectedTiktokAccounts[0], // Correctly assign the account object
                            success: true,
                            publishId: tiktokResult.publishId,
                            contentId: tiktokResult.contentId,
                            message: tiktokResult.message
                        });
                    }
                } else {
                    // Multi-account posting
                    tiktokResult = await postToMultipleTikTokAccounts(imageUrls);
                    
                    if (!tiktokResult.success) {
                        hasErrors = true;
                        errorMessage = tiktokResult.error;
                        
                        // Process individual account results
                        if (tiktokResult.results && tiktokResult.results.length > 0) {
                            tiktokResult.results.forEach(accountResult => {
                                results.push({
                                    platform: 'tiktok',
                                    account: {
                                        accountId: accountResult.accountId,
                                        displayName: accountResult.displayName
                                    },
                                    success: accountResult.success,
                                    error: accountResult.error,
                                    requiresReconnect: accountResult.code === 'TIKTOK_AUTH_ERROR',
                                    invalidMediaFormat: accountResult.code === 'INVALID_MEDIA_FORMAT'
                                });
                                
                                // Track if any account needs reconnection or has media format issues
                                if (accountResult.code === 'TIKTOK_AUTH_ERROR') {
                                    needsReconnect = true;
                                }
                                if (accountResult.code === 'INVALID_MEDIA_FORMAT') {
                                    invalidMediaFormat = true;
                                }
                            });
                        }
                    } else {
                        // Process successful multi-account results
                        if (tiktokResult.results && tiktokResult.results.length > 0) {
                            tiktokResult.results.forEach(accountResult => {
                                results.push({
                                    platform: 'tiktok',
                                    account: {
                                        accountId: accountResult.accountId,
                                        displayName: accountResult.displayName
                                    },
                                    success: accountResult.success,
                                    error: accountResult.error,
                                    publishId: accountResult.publishId,
                                    contentId: accountResult.contentId,
                                    message: accountResult.message
                                });
                                
                                // Track if there were any errors
                                if (!accountResult.success) {
                                    hasErrors = true;
                                    
                                    // Track reconnection needs
                                    if (accountResult.code === 'TIKTOK_AUTH_ERROR') {
                                        needsReconnect = true;
                                    }
                                    if (accountResult.code === 'INVALID_MEDIA_FORMAT') {
                                        invalidMediaFormat = true;
                                    }
                                }
                            });
                        }
                    }
                }
            }
            
            // Twitter posting (similar approach as TikTok)
            if (hasSelectedTwitter) {
                let twitterResult;
                if (selectedTwitterAccounts.length === 1) {
                    twitterResult = await postToSingleTwitterAccount(imageUrls, selectedTwitterAccounts[0]);
                    if (!twitterResult.success) {
                        hasErrors = true;
                        overallSuccess = false;
                        errorMessage = twitterResult.error; // Ensure errorMessage is updated
                        // Accumulate errors if multiple platforms fail
                        if (results.length > 0 && results.some(r => !r.success)) {
                            errorMessage = `${results.find(r => !r.success)?.error || ''} ${twitterResult.error || ''}`.trim();
                        }

                        if (twitterResult.requiresReconnect) needsReconnect = true;
                        results.push({
                            platform: 'twitter',
                            account: twitterResult.account,
                            success: false,
                            error: twitterResult.error,
                            requiresReconnect: twitterResult.requiresReconnect
                        });
                    } else {
                        results.push({
                            platform: 'twitter',
                            account: twitterResult.account,
                            success: true,
                            tweetId: twitterResult.tweetId,
                            message: twitterResult.message
                        });
                    }
                } else {
                    twitterResult = await postToMultipleTwitterAccounts(imageUrls);
                     if (!twitterResult.success) {
                        hasErrors = true;
                        overallSuccess = false;
                        // Process individual account results for Twitter
                        if (twitterResult.results && twitterResult.results.length > 0) {
                            twitterResult.results.forEach(accountResult => {
                                results.push({
                                    platform: 'twitter',
                                    account: {
                                        userId: accountResult.accountId, // Assuming accountId is used for Twitter too
                                        username: accountResult.username
                                    },
                                    success: accountResult.success,
                                    error: accountResult.error,
                                    requiresReconnect: accountResult.code === 'TWITTER_AUTH_ERROR', // Adapt error code if different
                                });
                                if (!accountResult.success) {
                                    overallSuccess = false;
                                    if (accountResult.code === 'TWITTER_AUTH_ERROR') needsReconnect = true;
                                }
                            });
                            // Consolidate error messages if needed
                            const firstError = twitterResult.results.find(r => !r.success)?.error;
                            if (firstError) {
                                if (errorMessage) errorMessage += `; Twitter: ${firstError}`;
                                else errorMessage = `Twitter: ${firstError}`;
                            }

                        } else {
                             // General error if no individual results
                            errorMessage = twitterResult.error || 'Failed to post to some Twitter accounts.';
                             results.push({ // Add a general Twitter error if specific results aren't available
                                platform: 'twitter',
                                success: false,
                                error: errorMessage,
                            });
                        }
                    } else {
                        // Process successful multi-account results for Twitter
                        if (twitterResult.results && twitterResult.results.length > 0) {
                            twitterResult.results.forEach(accountResult => {
                                results.push({
                                    platform: 'twitter',
                                    account: {
                                        userId: accountResult.accountId,
                                        username: accountResult.username
                                    },
                                    success: accountResult.success,
                                    error: accountResult.error,
                                    tweetId: accountResult.tweetId, // Assuming tweetId is returned
                                    message: accountResult.message
                                });
                                if (!accountResult.success) {
                                    overallSuccess = false;
                                     if (accountResult.code === 'TWITTER_AUTH_ERROR') needsReconnect = true;
                                }
                            });
                        }
                    }
                }
            }
            
            // Update state with platform results
            // setPlatformResults(results); // Old way - REMOVE THIS LINE

            const finalPlatformResults = {};

            if (hasSelectedTiktok) {
                const tiktokResultsFromPost = results.filter(r => r.platform === 'tiktok');
                const allTiktokSuccessful = selectedTiktokAccounts.every(acc => {
                    const resultForAccount = tiktokResultsFromPost.find(r => (r.account?.accountId === acc.accountId || r.account?.openId === acc.accountId));
                    return resultForAccount && resultForAccount.success;
                });
                finalPlatformResults.tiktok = {
                    success: tiktokResultsFromPost.length > 0 && allTiktokSuccessful,
                    results: tiktokResultsFromPost.map(r => ({
                        displayName: r.account?.displayName || r.account?.username || r.account?.accountId || 'Account',
                        username: r.account?.username,
                        success: r.success,
                        message: r.message || (r.success ? 'Posted successfully' : (r.error || 'Failed')),
                        publishId: r.publishId,
                        contentId: r.contentId,
                    })),
                };
            } else {
                finalPlatformResults.tiktok = undefined;
            }

            if (hasSelectedTwitter) {
                const twitterResultsFromPost = results.filter(r => r.platform === 'twitter');
                const allTwitterSuccessful = selectedTwitterAccounts.every(acc => {
                    const resultForAccount = twitterResultsFromPost.find(r => r.account?.userId === acc.userId);
                    return resultForAccount && resultForAccount.success;
                });
                finalPlatformResults.twitter = {
                    success: twitterResultsFromPost.length > 0 && allTwitterSuccessful,
                    results: twitterResultsFromPost.map(r => ({
                        username: r.account?.username || r.account?.name || r.account?.userId,
                        success: r.success,
                        message: r.message || (r.success ? 'Posted successfully' : (r.error || 'Failed')),
                        tweetId: r.tweetId,
                    })),
                };
            } else {
                finalPlatformResults.twitter = undefined;
            }

            setPlatformResults(finalPlatformResults);

            // Handle overall status
            if (hasErrors || !overallSuccess) {
                // Display appropriate error message based on error type
                let displayError = errorMessage;
                
                if (needsReconnect) {
                    displayError = 'One or more social media accounts need to be reconnected. Please go to the Accounts page.';
                } else if (invalidMediaFormat) {
                    displayError = 'TikTok couldn\'t process this image format. Try a different image or format (JPG/PNG).';
                }
                
                setPostError(displayError);
                setPostSuccess(false);
            } else {
                setPostSuccess(true);
                setPostError('');
            }
        } catch (error) {
            console.error('Post handling error:', error);
            setPostError(error.message || 'An unexpected error occurred during posting');
            setPostSuccess(false);
            setIsProcessingUpload(false); // Ensure cleared on error too
        } finally {
            setIsPosting(false);
            // isProcessingUpload should be false here if logic above is correct
        }
    };
    
    // Helper function to post to a single TikTok account
    const postToSingleTikTokAccount = async (imageUrls, account) => {
        console.log(`Posting ${imageUrls.length} image(s) to TikTok account: ${account.displayName || account.username || account.accountId}`);
        
        try {
            // Set initial status to loading
            setAccountStatus(prev => ({
                ...prev,
                tiktok: {
                    ...prev.tiktok,
                    [account.accountId]: { status: 'loading', message: 'Posting...' }
                }
            }));
            
            const response = await fetchWithTimeoutAndRetry('/api/tiktok/post-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imageUrls,
                    caption,
                    userId,
                    accountId: account.accountId
                }),
            });

            const result = await response.json();
            
            // Check for success
            if (result.success) {
                // Update account status to success
                setAccountStatus(prev => ({
                    ...prev,
                    tiktok: {
                        ...prev.tiktok,
                        [account.accountId]: { 
                            status: 'success',
                            message: 'Posted successfully',
                            publishId: result.publishId,
                            contentId: result.contentId
                        }
                    }
                }));
                
                return { 
                    success: true, 
                    accountId: account.accountId,
                    message: `Posted to ${account.displayName || account.username || 'account'}`,
                    publishId: result.publishId,
                    contentId: result.contentId
                };
            } else {
                // Handle error based on code/type
                let errorMessage = result.error || 'Failed to post';
                let status = 'error';

                // Format the error message to be more readable - remove any excessive newlines
                errorMessage = errorMessage.replace(/\n+/g, '\n');
                
                // Handle specific error types
                if (result.requiresReconnect) {
                    status = 'reconnect';
                    errorMessage = `Account needs to be reconnected`;
                } else if (result.code === 'INVALID_MEDIA_FORMAT') {
                    errorMessage = 'Image format not supported';
                    
                    // Show more detailed error with options to open modal
                    setPostError(
                        <div>
                            <p>TikTok couldn&apos;t process this image. Please try:</p>
                            <ul className="mt-2 list-disc pl-5">
                                <li>Using a different image format (JPG/PNG)</li>
                                <li>Using an image with different dimensions</li>
                                <li>Checking that your TikTok account has image posting permissions</li>
                            </ul>
                        </div>
                    );
                }
                
                // Update account status to error
                setAccountStatus(prev => ({
                    ...prev,
                    tiktok: {
                        ...prev.tiktok,
                        [account.accountId]: { 
                            status, 
                            message: errorMessage,
                            detail: result.error
                        }
                    }
                }));
                
                return { 
                    success: false, 
                    accountId: account.accountId,
                    error: errorMessage,
                    requiresReconnect: result.requiresReconnect || false
                };
            }
        } catch (error) {
            // Handle fetch/network errors
            console.error(`Error posting to account ${account.displayName || account.username || account.accountId}:`, error);
            
            // Update account status to error
            setAccountStatus(prev => ({
                ...prev,
                tiktok: {
                    ...prev.tiktok,
                    [account.accountId]: { 
                        status: 'error',
                        message: 'Connection error', 
                        detail: error.message
                    }
                }
            }));
            
            return { 
                success: false, 
                accountId: account.accountId,
                error: `Connection error: ${error.message}`
            };
        }
    };
    
    // Helper function to post to multiple TikTok accounts
    const postToMultipleTikTokAccounts = async (imageUrls) => {
        console.log(`Posting ${imageUrls.length} image(s) to ${selectedTiktokAccounts.length} TikTok accounts`);
        
        // Set initial status for all accounts to loading
        const initialStatuses = {};
        selectedTiktokAccounts.forEach(account => {
            initialStatuses[account.accountId] = { status: 'loading', message: 'Posting...' };
        });
        
        setAccountStatus(prev => ({
            ...prev,
            tiktok: {
                ...prev.tiktok,
                ...initialStatuses
            }
        }));
        
        try {
            const response = await fetchWithTimeoutAndRetry('/api/tiktok/post-images-multi', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imageUrls,
                    caption,
                    userId,
                    accounts: selectedTiktokAccounts.map(account => ({
                        accountId: account.accountId,
                        displayName: account.displayName,
                        username: account.username
                    }))
                }),
            });

            const result = await response.json();
            
            // Process the results for each account
            if (result.success) {
                console.log('Multi-post successful:', result.message);
                
                // Process account-specific results
                const accountResults = result.results || [];
                
                // Update status for each account
                accountResults.forEach(accountResult => {
                    const accountId = accountResult.accountId;
                    
                    if (accountResult.success) {
                        setAccountStatus(prev => ({
                            ...prev,
                            tiktok: {
                                ...prev.tiktok,
                                [accountId]: { 
                                    status: 'success',
                                    message: 'Posted successfully',
                                    publishId: accountResult.publishId,
                                    contentId: accountResult.contentId
                                }
                            }
                        }));
                    } else {
                        // Handle error status
                        let status = 'error';
                        let errorMessage = accountResult.error || 'Failed to post';
                        
                        // Handle specific error cases
                        if (accountResult.code === 'TIKTOK_AUTH_ERROR') {
                            status = 'reconnect';
                            errorMessage = 'Account needs to be reconnected';
                        } else if (accountResult.code === 'INVALID_MEDIA_FORMAT') {
                            errorMessage = 'Image format not supported';
                            
                            // Show error in UI
                            if (!postError) {
                                setPostError(
                                    <div>
                                        <p>TikTok couldn&apos;t process this image for one or more accounts. Please try:</p>
                                        <ul className="mt-2 list-disc pl-5">
                                            <li>Using a different image format (JPG/PNG)</li>
                                            <li>Using an image with different dimensions</li>
                                            <li>Checking that your TikTok accounts have image posting permissions</li>
                                        </ul>
                                    </div>
                                );
                            }
                        }
                        
                        setAccountStatus(prev => ({
                            ...prev,
                            tiktok: {
                                ...prev.tiktok,
                                [accountId]: { 
                                    status,
                                    message: errorMessage,
                                    detail: accountResult.error
                                }
                            }
                        }));
                    }
                });
                
                // Return overall result
                return {
                    success: true,
                    message: result.message,
                    results: accountResults
                };
            } else {
                // If the entire request failed (not just specific accounts)
                console.error('Multi-post failed:', result.error);
                
                // Set all accounts to error state
                selectedTiktokAccounts.forEach(account => {
                    setAccountStatus(prev => ({
                        ...prev,
                        tiktok: {
                            ...prev.tiktok,
                            [account.accountId]: { 
                                status: 'error',
                                message: 'Request failed',
                                detail: result.error
                            }
                        }
                    }));
                });
                
                return {
                    success: false,
                    error: result.error || 'Failed to post to multiple accounts'
                };
            }
        } catch (error) {
            console.error('Error posting to multiple TikTok accounts:', error);
            
            // Set all accounts to error state
            selectedTiktokAccounts.forEach(account => {
                setAccountStatus(prev => ({
                    ...prev,
                    tiktok: {
                        ...prev.tiktok,
                        [account.accountId]: { 
                            status: 'error',
                            message: 'Connection error',
                            detail: error.message
                        }
                    }
                }));
            });
            
            return {
                success: false,
                error: `Connection error: ${error.message}`
            };
        }
    };

    // Helper function to post to a single Twitter account
    const postToSingleTwitterAccount = async (imageUrls, account) => {
        console.log(`Posting ${imageUrls.length} image(s) to Twitter account: ${account.username || account.userId}`);
        setAccountStatus(prev => ({
            ...prev,
            twitter: {
                ...prev.twitter,
                [account.userId]: { status: 'loading', message: 'Posting...' }
            }
        }));

        try {
            // Assuming the backend uses imageUrls for Twitter images as well
            // The backend endpoint /api/social/twitter/post is used here.
            // If a different endpoint is needed for images, this URL should be changed.
            // Also, the backend might expect 'videoUrl' or 'mediaUrl' instead of 'imageUrls'.
            // This needs to be consistent with the backend implementation.
            const response = await fetchWithTimeoutAndRetry('https://sociallane-backend.mindio.chat/social/twitter/post', { // Changed to absolute backend URL
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // Assuming backend handles single image URL if only one is provided, or an array
                    // The backend /api/social/twitter/post expects `videoUrl`
                    // We send the first image URL as `videoUrl` for now.
                    // If multiple images are supported by the backend for a single tweet, this needs adjustment.
                    // videoUrl: imageUrls[0], // Sending the first image. Backend might need changes for multi-image tweets.
                    imageUrls: imageUrls, // Send the array of image URLs
                    text: caption,
                    userId: userId, // User ID for token lookup if needed by backend
                    // For single account, backend might expect accessToken and accessTokenSecret directly
                    // However, /api/social/twitter/post can look them up using userId and account details.
                    accounts: [{ userId: account.userId, username: account.username }] // Send as accounts array for consistency with multi-post
                }),
            });

            const result = await response.json();

            if (result.success) {
                 // If result.results exists (from multi-account structure), use the first one
                const singleAccountResult = result.results && result.results.length > 0 ? result.results[0] : result;

                if (singleAccountResult.success) {
                    setAccountStatus(prev => ({
                        ...prev,
                        twitter: {
                            ...prev.twitter,
                            [account.userId]: { status: 'success', message: 'Posted successfully', tweetId: singleAccountResult.data?.id }
                        }
                    }));
                    return { success: true, account, tweetId: singleAccountResult.data?.id, message: `Posted to @${account.username}` };
                } else {
                    // Handle error from single account result within the main success response
                     const errorMessage = singleAccountResult.error || 'Failed to post to Twitter';
                     setAccountStatus(prev => ({
                        ...prev,
                        twitter: {
                            ...prev.twitter,
                            [account.userId]: { status: 'error', message: errorMessage, detail: singleAccountResult.error, requiresReconnect: singleAccountResult.code === 'TWITTER_AUTH_ERROR' }
                        }
                    }));
                    return { success: false, account, error: errorMessage, requiresReconnect: singleAccountResult.code === 'TWITTER_AUTH_ERROR' };
                }
            } else {
                // Main request failed
                const errorMessage = result.error || 'Failed to post to Twitter';
                setAccountStatus(prev => ({
                    ...prev,
                    twitter: {
                        ...prev.twitter,
                        [account.userId]: { status: 'error', message: errorMessage, detail: result.error, requiresReconnect: result.code === 'TWITTER_AUTH_ERROR' }
                    }
                }));
                return { success: false, account, error: errorMessage, requiresReconnect: result.code === 'TWITTER_AUTH_ERROR' };
            }
        } catch (error) {
            console.error(`Error posting to Twitter account ${account.username || account.userId}:`, error);
            setAccountStatus(prev => ({
                ...prev,
                twitter: {
                    ...prev.twitter,
                    [account.userId]: { status: 'error', message: 'Connection error', detail: error.message }
                }
            }));
            return { success: false, account, error: `Connection error: ${error.message}` };
        }
    };

    // Helper function to post to multiple Twitter accounts
    const postToMultipleTwitterAccounts = async (imageUrls) => {
        console.log(`Posting ${imageUrls.length} image(s) to ${selectedTwitterAccounts.length} Twitter accounts`);
        const initialStatuses = {};
        selectedTwitterAccounts.forEach(account => {
            initialStatuses[account.userId] = { status: 'loading', message: 'Posting...' };
        });
        setAccountStatus(prev => ({ ...prev, twitter: { ...prev.twitter, ...initialStatuses } }));

        try {
            // The backend /api/social/twitter/post expects `videoUrl`
            // We send the first image URL as `videoUrl`.
            // If the backend needs to handle multiple image URLs per tweet or for different accounts,
            // this payload and the backend logic need to be updated.
            const response = await fetchWithTimeoutAndRetry('https://sociallane-backend.mindio.chat/social/twitter/post', { // Changed to absolute backend URL
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // videoUrl: imageUrls[0], // Sending first image. Backend must support this or be adapted for multi-image.
                    imageUrls: imageUrls, // Send the array of image URLs
                    text: caption,
                    userId,
                    accounts: selectedTwitterAccounts.map(acc => ({ userId: acc.userId, username: acc.username })),
                }),
            });

            const result = await response.json();

            if (result.success && result.results) {
                result.results.forEach(accResult => {
                    const status = accResult.success ? 'success' : (accResult.code === 'TWITTER_AUTH_ERROR' ? 'reconnect' : 'error');
                    const message = accResult.success ? 'Posted successfully' : (accResult.error || 'Failed');
                    setAccountStatus(prev => ({
                        ...prev,
                        twitter: {
                            ...prev.twitter,
                            [accResult.accountId]: { // accountId is used in backend response
                                status,
                                message,
                                tweetId: accResult.success ? accResult.data?.id : undefined,
                                detail: accResult.success ? undefined : accResult.error
                            }
                        }
                    }));
                });
                return { success: true, results: result.results };
            } else {
                // Handle case where overall request fails or results are not in expected format
                const errorMessage = result.error || 'Failed to post to one or more Twitter accounts';
                selectedTwitterAccounts.forEach(account => {
                    setAccountStatus(prev => ({
                        ...prev,
                        twitter: {
                            ...prev.twitter,
                            [account.userId]: { status: 'error', message: result.error || 'Request failed', detail: result.error, requiresReconnect: result.code === 'TWITTER_AUTH_ERROR' }
                        }
                    }));
                });
                return { success: false, error: errorMessage, results: result.results || [] };
            }
        } catch (error) {
            console.error('Error posting to multiple Twitter accounts:', error);
            selectedTwitterAccounts.forEach(account => {
                setAccountStatus(prev => ({
                    ...prev,
                    twitter: {
                        ...prev.twitter,
                        [account.userId]: { status: 'error', message: 'Connection error', detail: error.message }
                    }
                }));
            });
            return { success: false, error: `Connection error: ${error.message}` };
        }
    };

    // PostingLoader component for showing status - Improved UI
    const PostingLoader = ({ show, isUploading, isProcessingUpload, isPosting, isScheduling, progress, scheduleSuccess, postSuccess, platformResults, createdPostId, onClose }) => {
        if (!show) return null;
        
        const getTitle = () => {
            if (isUploading) return "Uploading images...";
            if (isProcessingUpload) return "Processing upload...";
            if (isScheduling) return "Scheduling post...";
            if (isPosting) return "Posting to platforms...";
            if (scheduleSuccess) return "Post scheduled successfully!";
            if (postSuccess) return "Images posted successfully!";
            return "Processing...";
        };
        
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm transition-all duration-300">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
                    {/* Header */}
                    <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${(postSuccess || scheduleSuccess) ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                        <h3 className="text-xl font-semibold flex items-center">
                            {(postSuccess || scheduleSuccess) ? (
                                <svg className="w-6 h-6 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            )}
                            {getTitle()}
                        </h3>
                    </div>
                    
                    {/* Content */}
                    <div className="p-6">
                        {isUploading && (
                            <div className="mb-6">
                                <div className="mb-2 flex justify-between text-sm font-medium">
                                    <span>Uploading images to server</span>
                                    <span className="text-blue-600 dark:text-blue-400">{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                    <div 
                                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                        
                        {isProcessingUpload && (
                            <div className="flex items-center space-x-3 mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <div className="relative">
                                    <div className="w-8 h-8 border-4 border-blue-200 dark:border-blue-700 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin"></div>
                                </div>
                                <span className="text-blue-800 dark:text-blue-300 font-medium">Processing your images for posting...</span>
                            </div>
                        )}
                        
                        {(isPosting || isScheduling) && (
                            <div className="mb-6 space-y-4">
                                <p className="text-gray-600 dark:text-gray-300 mb-2">
                                    {isScheduling 
                                        ? "Setting up your scheduled post. This might take a moment." 
                                        : "Sending your images to selected platforms. Please wait."
                                    }
                                </p>
                                
                                {/* Platform statuses */}
                                <div className="space-y-3">
                                    {selectedTiktokAccounts.length > 0 && (
                                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                            <div className="flex items-center mb-2">
                                                <TikTokSimpleIcon className="h-5 w-5 mr-2" />
                                                <span className="font-medium">TikTok</span>
                                            </div>
                                            <div className="pl-7 space-y-2">
                                                {selectedTiktokAccounts.map(account => (
                                                    <div key={account.accountId} className="flex items-center text-sm">
                                                        <div className="w-6 h-6 rounded-full overflow-hidden mr-2 flex-shrink-0">
                                                            {account.avatarUrl100 || account.avatarUrl ? (
                                                                <img src={account.avatarUrl100 || account.avatarUrl} alt={account.displayName || account.username} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                                                                    <TikTokSimpleIcon className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="mr-2 flex-grow truncate">{account.displayName || account.username}</span>
                                                        <AccountStatusIndicator status={accountStatus.tiktok[account.accountId]} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {selectedTwitterAccounts.length > 0 && (
                                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                            <div className="flex items-center mb-2">
                                                <TwitterIcon className="h-5 w-5 mr-2 text-[#1DA1F2]" />
                                                <span className="font-medium">Twitter</span>
                                            </div>
                                            <div className="pl-7 space-y-2">
                                                {selectedTwitterAccounts.map(account => (
                                                    <div key={account.userId} className="flex items-center text-sm">
                                                        <div className="w-6 h-6 rounded-full overflow-hidden mr-2 flex-shrink-0">
                                                            {account.profileImageUrl ? (
                                                                <img src={account.profileImageUrl} alt={account.name || account.username} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                                                                    <TwitterIcon className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="mr-2 flex-grow truncate">{account.name || account.username}</span>
                                                        <AccountStatusIndicator status={accountStatus.twitter[account.userId]} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {(postSuccess || scheduleSuccess) && (
                            <div className="mb-6">
                                <div className="mb-6 flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                                        <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    
                                    <p className="text-center text-lg font-medium mb-1">
                                        {scheduleSuccess 
                                            ? `Your post has been scheduled` 
                                            : 'Your images have been posted!'}
                                    </p>
                                    
                                    {scheduleSuccess && scheduledDate && scheduledTime && (
                                        <p className="text-center text-gray-500 dark:text-gray-400 mb-4">
                                            Scheduled for {formatDate(scheduledDate, scheduledTime)}
                                        </p>
                                    )}
                                </div>
                                
                                {/* Result summary cards */}
                                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                                    {/* TikTok results */}
                                    {selectedTiktokAccounts.length > 0 && (
                                        <div className={`p-3 rounded-lg border ${
                                            platformResults.tiktok?.success 
                                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                        }`}>
                                            <div className="flex items-center mb-2">
                                                <TikTokSimpleIcon className="h-5 w-5 mr-2" />
                                                <span className={`font-medium ${
                                                    platformResults.tiktok?.success 
                                                        ? 'text-green-800 dark:text-green-300' 
                                                        : 'text-red-800 dark:text-red-300'
                                                }`}>
                                                    TikTok: {platformResults.tiktok?.success ? 'Success' : 'Failed'}
                                                </span>
                                            </div>
                                            
                                            {platformResults.tiktok?.results?.length > 0 && (
                                                <ul className="mt-1 pl-7 space-y-1 text-xs">
                                                    {platformResults.tiktok.results.map((result, idx) => (
                                                        <li key={idx} className={`flex items-center ${result.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                                            <span className="mr-1">•</span>
                                                            <span>{result.displayName || result.username || 'Account'}: </span>
                                                            <span className="ml-1 font-medium">{result.message || (result.success ? 'Success' : 'Failed')}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Twitter results */}
                                    {selectedTwitterAccounts.length > 0 && (
                                        <div className={`p-3 rounded-lg border ${
                                            platformResults.twitter?.success 
                                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                        }`}>
                                            <div className="flex items-center mb-2">
                                                <TwitterIcon className="h-5 w-5 mr-2 text-[#1DA1F2]" />
                                                <span className={`font-medium ${
                                                    platformResults.twitter?.success 
                                                        ? 'text-green-800 dark:text-green-300' 
                                                        : 'text-red-800 dark:text-red-300'
                                                }`}>
                                                    Twitter: {platformResults.twitter?.success ? 'Success' : 'Failed'}
                                                </span>
                                            </div>
                                            
                                            {platformResults.twitter?.results?.length > 0 && (
                                                <ul className="mt-1 pl-7 space-y-1 text-xs">
                                                    {platformResults.twitter.results.map((result, idx) => (
                                                        <li key={idx} className={`flex items-center ${result.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                                            <span className="mr-1">•</span>
                                                            <span>{result.username || result.account?.username || 'Account'}: </span>
                                                            <span className="ml-1 font-medium">{result.message || (result.success ? 'Success' : 'Failed')}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            
                                            {(platformResults.twitter?.results?.length === undefined && platformResults.twitter?.account) && (
                                                <ul className="mt-1 pl-7 space-y-1 text-xs">
                                                    <li className={`flex items-center ${platformResults.twitter?.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                                        <span className="mr-1">•</span>
                                                        <span>{platformResults.twitter.account.username || 'Account'}: </span>
                                                        <span className="ml-1 font-medium">
                                                            {platformResults.twitter?.success
                                                                ? (platformResults.twitter.message || 'Success')
                                                                : (platformResults.twitter.error || 'Failed')}
                                                        </span>
                                                    </li>
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Action buttons */}
                        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-6">
                            {(postSuccess || scheduleSuccess) ? (
                                <>
                                    <button 
                                        onClick={resetForNewPost}
                                        className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 font-medium transition-colors duration-150 flex items-center justify-center"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        Create New Post
                                    </button>
                                    <button 
                                        onClick={onClose}
                                        className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 font-medium transition-colors duration-150"
                                    >
                                        Close
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={onClose}
                                    className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isUploading || isProcessingUpload || isPosting || isScheduling}
                                >
                                    {isUploading || isProcessingUpload || isPosting || isScheduling ? 'Please wait...' : 'Cancel'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };
    
    // Account status indicator component
    const AccountStatusIndicator = ({ status }) => {
        if (!status) return (
            <div className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1"></span>
                Pending
            </div>
        );
        
        let icon, colorClass, text, bgClass;
        
        switch (status.status) {
            case 'loading':
                icon = <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1 animate-pulse"></div>;
                colorClass = "text-blue-700 dark:text-blue-300";
                bgClass = "bg-blue-100 dark:bg-blue-900/30";
                text = status.message || 'Processing...';
                break;
                
            case 'success':
                icon = <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></div>;
                colorClass = "text-green-700 dark:text-green-300";
                bgClass = "bg-green-100 dark:bg-green-900/30";
                text = status.message || 'Success';
                break;
                
            case 'error':
                icon = <div className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1"></div>;
                colorClass = "text-red-700 dark:text-red-300";
                bgClass = "bg-red-100 dark:bg-red-900/30";
                text = status.message || 'Error';
                break;
                
            case 'reconnect':
                icon = <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1"></div>;
                colorClass = "text-amber-700 dark:text-amber-300";
                bgClass = "bg-amber-100 dark:bg-amber-900/30";
                text = status.message || 'Reconnect needed';
                break;
                
            default:
                icon = <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1"></div>;
                colorClass = "text-gray-700 dark:text-gray-300";
                bgClass = "bg-gray-100 dark:bg-gray-800";
                text = status.message || 'Waiting...';
        }
        
        return (
            <div className={`inline-flex items-center text-xs ${colorClass} ${bgClass} px-2 py-1 rounded-full truncate max-w-[120px]`} title={text}>
                {icon}
                <span className="truncate">{text}</span>
            </div>
        );
    };

    // Add a useEffect to check the file input ref after component mount
    useEffect(() => {
        console.log('Component mounted, fileInputRef initialized:', !!fileInputRef.current);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Head>
                <title>Image Posting - Social Lane</title>
                <meta name="description" content="Post images to TikTok and Twitter" />
            </Head>
            
            {/* Main container with improved spacing */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with gradient background */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg mb-8 p-6">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                        <TikTokSimpleIcon className="w-8 h-8 mr-3" />
                        <span>Image Posting</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Share your images on TikTok and Twitter</p>
                </div>
                
                {/* Hidden file input that's always available */}
                <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    onChange={handleFileChange} 
                    accept="image/*"
                    multiple
                    disabled={isPostLimitReached || isUploading || isProcessingUpload || isPosting}
                    key="file-input"
                />
                
                {/* Main content with improved responsive layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* New Left column (formerly Right): Account selection and post button */}
                    <div className="space-y-6">
                        {/* TikTok accounts - Improved UI */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                                <div className="flex items-center">
                                    <TikTokSimpleIcon className="h-5 w-5 mr-2 text-black dark:text-white" />
                                    <h2 className="text-xl font-semibold">TikTok Accounts</h2>
                                </div>
                                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                                    {selectedTiktokAccounts?.length} selected
                                </span>
                            </div>
                            
                            <div className="p-6">
                                {/* Search bar with icon */}
                                <div className="relative mb-4">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search TikTok accounts..."
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    />
                                </div>
                                
                                {tiktokAccounts?.length === 0 ? (
                                    <div className="p-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                                        <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                                            <TikTokSimpleIcon className="h-full w-full" />
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-400 mb-3">No TikTok accounts connected</p>
                                        <Link href="/connect" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                            Connect Account
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                                        {tiktokAccounts
                                            ?.filter(acc => 
                                                !searchTerm || 
                                                acc?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                                acc?.username?.toLowerCase().includes(searchTerm.toLowerCase())
                                            )
                                            ?.map(account => (
                                                <div
                                                    key={account?.accountId}
                                                    className={`flex items-center p-2 justify-between ${
                                                        selectedTiktokAccounts?.some(sa => sa?.accountId === account?.accountId)
                                                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                    } rounded-lg cursor-pointer transition-all duration-150 ${isPostLimitReached ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    onClick={() => handleTikTokAccountToggle(account)}
                                                >
                                                    <div className="flex items-center min-w-0"> {/* Container for left-side content */}
                                                        {account?.avatarUrl100 || account?.avatarUrl ? (
                                                            <img 
                                                                src={account?.avatarUrl100 || account?.avatarUrl} 
                                                                alt={account?.displayName || account?.username || 'TikTok user'} 
                                                                className="w-8 h-8 rounded-full mr-2 border border-gray-200 dark:border-gray-700 flex-shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mr-2 border border-gray-300 dark:border-gray-600 flex-shrink-0">
                                                                <TikTokSimpleIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                                            </div>
                                                        )}
                                                        <div className="flex items-center min-w-0"> {/* Aligns name and handle */}
                                                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate m-1">{account?.displayName || 'TikTok User'}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate ml-1.5  m-1">@{account?.username}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="relative flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            id={`tiktok-${account?.accountId}`}
                                                            checked={selectedTiktokAccounts?.some(sa => sa?.accountId === account?.accountId)}
                                                            onChange={() => {}} // Handled by parent div's onClick
                                                            className="opacity-0 absolute h-5 w-5 cursor-pointer" // Hide default checkbox
                                                            disabled={isPostLimitReached}
                                                            onClick={(e) => e.stopPropagation()} // Prevent double toggling
                                                        />
                                                        <label
                                                            htmlFor={`tiktok-${account?.accountId}`}
                                                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all duration-150
                                                                ${selectedTiktokAccounts?.some(sa => sa?.accountId === account?.accountId)
                                                                    ? 'bg-blue-600 border-blue-600'
                                                                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500 hover:border-gray-400 dark:hover:border-gray-400'
                                                                }
                                                                ${isPostLimitReached ? 'cursor-not-allowed opacity-60' : ''}
                                                            `}
                                                            onClick={(e) => e.stopPropagation()} // Prevent label click from interfering with div click
                                                        >
                                                            {selectedTiktokAccounts?.some(sa => sa?.accountId === account?.accountId) && (
                                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Twitter accounts - Improved UI */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                                <div className="flex items-center">
                                    <TwitterIcon className="h-5 w-5 mr-2 text-[#1DA1F2] dark:text-[#1DA1F2]" />
                                    <h2 className="text-xl font-semibold">Twitter Accounts</h2>
                                </div>
                                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                                    {selectedTwitterAccounts?.length} selected
                                </span>
                            </div>
                            
                            <div className="p-6">
                                {/* Search bar with icon */}
                                <div className="relative mb-4">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search Twitter accounts..."
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    />
                                </div>
                                
                                {twitterAccounts?.length === 0 ? (
                                    <div className="p-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                                        <div className="mx-auto h-12 w-12 text-[#1DA1F2] mb-4">
                                            <TwitterIcon className="h-full w-full" />
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-400 mb-3">No Twitter accounts connected</p>
                                        <Link href="/connect" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                            Connect Account
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                                        {twitterAccounts
                                            ?.filter(acc => 
                                                !searchTerm || 
                                                acc?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                                acc?.username?.toLowerCase().includes(searchTerm.toLowerCase())
                                            )
                                            ?.map(account => (
                                                <div
                                                    key={account?.userId}
                                                    className={`flex items-center p-2 justify-between ${
                                                        selectedTwitterAccounts?.some(sa => sa?.userId === account?.userId)
                                                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                    } rounded-lg cursor-pointer transition-all duration-150 ${isPostLimitReached ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    onClick={() => handleTwitterAccountToggle(account)}
                                                >
                                                    <div className="flex items-center min-w-0"> {/* Container for left-side content */}
                                                        {account?.profileImageUrl ? (
                                                            <img 
                                                                src={account?.profileImageUrl} 
                                                                alt={account?.name || account?.username || 'Twitter user'} 
                                                                className="w-8 h-8 rounded-full mr-2 border border-gray-200 dark:border-gray-700 flex-shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mr-2 border border-gray-300 dark:border-gray-600 flex-shrink-0">
                                                                <TwitterIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                                            </div>
                                                        )}
                                                        <div className="flex items-center min-w-0"> {/* Aligns name and handle */}
                                                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate m-1">{account?.name || 'Twitter User'}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate ml-1.5 m-1">@{account?.username}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="relative flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            id={`twitter-${account?.userId}`}
                                                            checked={selectedTwitterAccounts?.some(sa => sa?.userId === account?.userId)}
                                                            onChange={() => {}} // Handled by parent div's onClick
                                                            className="opacity-0 absolute h-5 w-5 cursor-pointer" // Hide default checkbox
                                                            disabled={isPostLimitReached}
                                                            onClick={(e) => e.stopPropagation()} // Prevent double toggling
                                                        />
                                                        <label
                                                            htmlFor={`twitter-${account?.userId}`}
                                                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all duration-150
                                                                ${selectedTwitterAccounts?.some(sa => sa?.userId === account?.userId)
                                                                    ? 'bg-blue-600 border-blue-600'
                                                                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500 hover:border-gray-400 dark:hover:border-gray-400'
                                                                }
                                                                ${isPostLimitReached ? 'cursor-not-allowed opacity-60' : ''}
                                                            `}
                                                            onClick={(e) => e.stopPropagation()} // Prevent label click from interfering with div click
                                                        >
                                                            {selectedTwitterAccounts?.some(sa => sa?.userId === account?.userId) && (
                                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Post / Schedule button - Improved UI */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                            <div className="p-6">
                                <button
                                    onClick={handlePost}
                                    disabled={isPostLimitReached || isUploading || isProcessingUpload || isPosting || isScheduling || files?.length === 0 || (selectedTiktokAccounts?.length === 0 && selectedTwitterAccounts?.length === 0)}
                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                                >
                                    <span className="flex items-center">
                                        {isScheduled ? (
                                            <>
                                                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Schedule Post
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                </svg>
                                                Post Now
                                            </>
                                        )}
                                    </span>
                                </button>
                                
                                {postError && (
                                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-start">
                                        <svg className="w-5 h-5 mr-2 flex-shrink-0 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>{postError}</div>
                                    </div>
                                )}
                                
                                {/* Usage summary with improved styling */}
                                {userLimits && (
                                    <div className="mt-4 flex justify-center items-center">
                                        <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 flex-grow max-w-xs">
                                            <div 
                                                className="bg-blue-600 h-1.5 rounded-full" 
                                                style={{ 
                                                    width: userLimits?.posts ? `${Math.min(100, ((postUsage?.postsUsed || 0) / userLimits.posts) * 100)}%` : '0%'
                                                }}
                                            ></div>
                                        </div>
                                        <span className="text-xs text-gray-600 dark:text-gray-400 ml-3">
                                            {postUsage?.postsUsed || 0} of {userLimits?.posts || 'unlimited'}
                                            {userLimits?.role && <span className="ml-1 opacity-75">({userLimits.role})</span>}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>{/* Closing div for the new left column (accounts and post button) */}
                    
                    {/* New Right column (formerly Left): Upload section, Caption, Scheduling */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Upload/Preview area with improved styling */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                            {/* Card header */}
                            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                                <h2 className="text-xl font-semibold flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                    </svg>
                                    Upload Images
                                </h2>
                            </div>
                            
                            {/* Card content */}
                            <div className="p-6">
                                {/* File selection area with improved styling */}
                                {(!files || files?.length === 0) ? (
                                    <div 
                                        className={`border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 rounded-xl p-10 text-center cursor-pointer transition-all duration-200 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${isPostLimitReached ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        onClick={handleUploadClick}
                                    >
                                        <svg className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        
                                        <p className="mt-4 text-base font-medium text-gray-700 dark:text-gray-300">Click to select images or drag and drop</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                            Support for PNG, JPG, JPEG, GIF up to 50MB
                                        </p>
                                        
                                        {isPostLimitReached && (
                                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                                {postLimitMessage}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        {/* Image grid with improved styling */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                                            {localPreviewUrls?.map((url, index) => (
                                                <div key={index} className="relative group rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 aspect-square">
                                                    <img 
                                                        src={url} 
                                                        alt={`Preview ${index + 1}`} 
                                                        className="h-full w-full object-cover transition-all duration-200 group-hover:scale-105"
                                                        onClick={() => {
                                                            setCurrentImageIndex(index);
                                                            setShowImageModal(true);
                                                        }}
                                                    />
                                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all duration-200">
                                                        <button 
                                                            className="opacity-0 group-hover:opacity-100 p-2 bg-white rounded-full shadow-md transition-opacity duration-200"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCurrentImageIndex(index);
                                                                setShowImageModal(true);
                                                            }}
                                                        >
                                                            <svg className="w-5 h-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                                                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                            <div>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                                                    {files?.length === 1
                                                        ? `${files[0]?.name} (${(files[0]?.size / (1024 * 1024))?.toFixed(2)} MB)`
                                                        : `${files?.length} images selected`
                                                    }
                                                </p>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-3">
                                                <button
                                                    className="px-4 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                                                    onClick={handleAddMoreImagesClick}
                                                    disabled={isPostLimitReached || isUploading || isProcessingUpload || isPosting}
                                                >
                                                    <span className="flex items-center">
                                                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                        </svg>
                                                        Add More
                                                    </span>
                                                </button>
                                                <button
                                                    className="px-4 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                                                    onClick={handleReplaceMediaClick}
                                                    disabled={isPostLimitReached || isUploading || isProcessingUpload || isPosting}
                                                >
                                                    <span className="flex items-center">
                                                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                        Replace All
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {uploadError && (
                                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                        <div className="flex">
                                            <svg className="w-5 h-5 mr-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {uploadError}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Caption area */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                                <h2 className="text-xl font-semibold flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                    Caption
                                </h2>
                            </div>
                            
                            <div className="p-6">
                                <textarea
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    placeholder="Write a caption for your image post..."
                                    className="w-full p-4 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 placeholder-gray-400 dark:placeholder-gray-500"
                                    rows={4}
                                    disabled={isPostLimitReached || isUploading || isProcessingUpload || isPosting}
                                />
                            </div>
                        </div>
                        
                        {/* Scheduling options */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="schedule-checkbox"
                                        checked={isScheduled}
                                        onChange={(e) => setIsScheduled(e.target.checked)}
                                        className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                        disabled={isPostLimitReached || isUploading || isProcessingUpload || isPosting}
                                    />
                                    <label htmlFor="schedule-checkbox" className="ml-3 text-xl font-semibold flex items-center">
                                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Schedule for later
                                    </label>
                                </div>
                            </div>
                            
                            {isScheduled && (
                                <div className="p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Date</label>
                                            <input
                                                type="date"
                                                value={scheduledDate}
                                                onChange={(e) => setScheduledDate(e.target.value)}
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                min={new Date().toISOString().split('T')[0]}
                                                disabled={isPostLimitReached || isUploading || isProcessingUpload || isPosting}
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Time</label>
                                            <input
                                                type="time"
                                                value={scheduledTime}
                                                onChange={(e) => setScheduledTime(e.target.value)}
                                                className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                disabled={isPostLimitReached || isUploading || isProcessingUpload || isPosting}
                                            />
                                        </div>
                                    </div>
                                    
                                    {isScheduled && scheduledDate && scheduledTime && (
                                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                            <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center">
                                                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Post will be scheduled for {formatDate(scheduledDate, scheduledTime)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div> {/* Closing div for the new right column (upload, caption, scheduling) */}
                </div>
            </div>
            
            {/* Image modal - Improved UI */}
            {showImageModal && localPreviewUrls.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm">
                    <div className="relative max-w-4xl max-h-[90vh] w-full">
                        <img 
                            src={localPreviewUrls[currentImageIndex]} 
                            alt="Preview" 
                            className="max-h-[90vh] max-w-full object-contain mx-auto rounded-lg"
                        />
                        
                        {localPreviewUrls.length > 1 && (
                            <>
                                <button
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-3 text-white transition-all duration-200"
                                    onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? localPreviewUrls.length - 1 : prev - 1))}
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                
                                <button
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-3 text-white transition-all duration-200"
                                    onClick={() => setCurrentImageIndex((prev) => (prev === localPreviewUrls.length - 1 ? 0 : prev + 1))}
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </>
                        )}
                        
                        <button
                            className="absolute top-4 right-4 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-3 text-white transition-all duration-200"
                            onClick={() => setShowImageModal(false)}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full text-sm font-medium">
                            {currentImageIndex + 1} / {localPreviewUrls.length}
                        </div>
                        
                        {/* Image info */}
                        {files[currentImageIndex] && (
                            <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-sm max-w-lg text-center">
                                <p className="font-medium truncate">{files[currentImageIndex].name}</p>
                                <p className="text-xs text-gray-300">
                                    {(files[currentImageIndex].size / (1024 * 1024)).toFixed(2)} MB • 
                                    {files[currentImageIndex].type}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Posting loader/status modal */}
            <PostingLoader
                show={showLoader}
                isUploading={isUploading}
                isProcessingUpload={isProcessingUpload}
                isPosting={isPosting}
                isScheduling={isScheduling}
                progress={uploadProgress}
                scheduleSuccess={scheduleSuccess}
                postSuccess={postSuccess}
                platformResults={platformResults}
                createdPostId={createdPostId}
                onClose={() => setShowLoader(false)}
            />
        </div>
    );
}

export default function ImagePostingPage() {
    return (
        <ProtectedRoute>
            <ImagePosting />
        </ProtectedRoute>
    );
} 