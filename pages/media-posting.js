import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { TikTokSimpleIcon, TwitterIcon } from '../src/components/icons/SocialIcons';
import ProtectedRoute from '../src/components/ProtectedRoute';
import { getUserLimits, getPostUsage } from '../src/services/userService'; // Add getPostUsage

// Enhanced fetch with timeout and retry utility - REMAINS UNCHANGED
const fetchWithTimeoutAndRetry = async (url, options = {}, timeout = 120000, maxRetries = 3) => {
    // ... (keep existing implementation)
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


function MediaPosting() {
    // --- State variables ---
    const [file, setFile] = useState(null); // Holds the selected File object
    const [uploadedFileName, setUploadedFileName] = useState(''); // Holds the name of the selected file
    const [localPreviewUrl, setLocalPreviewUrl] = useState(''); // Holds the blob URL for local preview
    const [isUploading, setIsUploading] = useState(false); // True during the actual XHR upload process
    const [isProcessingUpload, setIsProcessingUpload] = useState(false); // NEW: True after upload finishes, before post/schedule API calls start
    const [uploadProgress, setUploadProgress] = useState(0);
    const [videoUrl, setVideoUrl] = useState(''); // Holds the R2 URL *after* successful upload
    const [videoThumbnail, setVideoThumbnail] = useState('');
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
    const videoRef = useRef(null); // For the large preview video element
    const localVideoRef = useRef(null); // Ref for thumbnail generation video element
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [accountStatus, setAccountStatus] = useState({ tiktok: {}, twitter: {} });
    const [showLoader, setShowLoader] = useState(false); // Controls visibility of the PostingLoader modal
    const [createdPostId, setCreatedPostId] = useState(null); // New state variable to store the ID of the created post

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
    }, [userId, setPostUsageLoading, setPostUsageError, setPostUsage]); // Add dependencies

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

    // Fetch post usage when userId changes - NOW CALLS the useCallback version
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
                    const formattedTiktok = fetchedTiktok.filter(a => a?.accountId || a?.openId).map(a => ({ accountId: a.accountId || a.openId, username: a.username || a.userInfo?.username || '', displayName: a.displayName || a.userInfo?.display_name || '', avatarUrl: a.avatarUrl100 || a.userInfo?.avatar_url_100 || a.avatarUrl || a.userInfo?.avatar_url || '', userInfo: a.userInfo || {} }));
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

    // --- Cleanup blob URL ---
    useEffect(() => {
        let currentBlobUrl = localPreviewUrl;
        return () => {
            if (currentBlobUrl) {
                console.log("Revoking blob URL:", currentBlobUrl.substring(0, 50) + "...");
                URL.revokeObjectURL(currentBlobUrl);
            }
        };
    }, [localPreviewUrl]);

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
        if (isPostLimitReached) return;
        const selectedFile = e?.target?.files?.[0];
        if (selectedFile) {
             if (!selectedFile.type.startsWith('video/')) {
                setUploadError('Please select a video file.'); setFile(null); setUploadedFileName(''); setLocalPreviewUrl(''); setVideoThumbnail(''); return;
            }
            if (selectedFile.size > 500 * 1024 * 1024) {
                setUploadError('File size exceeds 500MB limit.'); setFile(null); setUploadedFileName(''); setLocalPreviewUrl(''); setVideoThumbnail(''); return;
            }
            setUploadError(null); setVideoUrl(''); setVideoThumbnail(''); setPostSuccess(false); setScheduleSuccess(false); setPlatformResults({}); setAccountStatus({ tiktok: {}, twitter: {} });
            setIsUploading(false); setIsProcessingUpload(false); setIsPosting(false); setIsScheduling(false); setUploadProgress(0);
            setFile(selectedFile); setUploadedFileName(selectedFile.name);
            const newLocalUrl = URL.createObjectURL(selectedFile);
            setLocalPreviewUrl(newLocalUrl);
            generateVideoThumbnail(newLocalUrl);
        }
    };

    // --- Reset Form Function - Updated ---
    const resetForNewPost = () => {
        setFile(null); setUploadedFileName(''); setLocalPreviewUrl(''); setVideoUrl(''); setVideoThumbnail('');
        setCaption(''); setIsScheduled(false); setScheduledDate(''); setScheduledTime('');
        setSelectedTiktokAccounts([]); setSelectedTwitterAccounts([]);
        setPlatformResults({}); setPostSuccess(false); setScheduleSuccess(false); setUploadError(null);
        setSearchTerm(''); setAccountStatus({ tiktok: {}, twitter: {} });
        setIsUploading(false); setIsProcessingUpload(false); setIsPosting(false); setIsScheduling(false); setUploadProgress(0);
        setShowLoader(false); // Hide loader modal
        if (fileInputRef.current) fileInputRef.current.value = '';
        window.scrollTo(0, 0);
        // Add page reload
        window.location.reload(); 
    };

    const handleReplaceMediaClick = () => {
        if (isPostLimitReached || isUploading || isProcessingUpload || isPosting || isScheduling) return;
        setFile(null); setUploadedFileName(''); setLocalPreviewUrl(''); setVideoUrl(''); setVideoThumbnail(''); setUploadError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => { fileInputRef.current?.click(); }, 50);
    };

    const handleUploadClick = () => {
        if (isPostLimitReached || isUploading || isProcessingUpload || isPosting || isScheduling) return;
        fileInputRef.current?.click();
    };

    // --- Modified File Upload Function (now called from handlePost) ---
    const handleFileUpload = async (fileToUpload) => {
        if (!fileToUpload || !fileToUpload.type.startsWith('video/') || fileToUpload.size > 500 * 1024 * 1024) {
             return { success: false, error: 'Invalid file for upload.' };
        }
        setIsUploading(true);
        setIsProcessingUpload(false); // Ensure this is false initially
        setUploadProgress(0);
        setUploadError(null);
        setShowLoader(true); // Show loader when upload starts
        console.log("Starting actual file upload to R2...");

        try {
            const uploadWithProgress = (file) => {
                const formData = new FormData(); formData.append('file', file);
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener('progress', (event) => {
                    if (event?.lengthComputable) {
                        const percentCompleted = Math.round((event.loaded * 100) / (event.total || 1));
                        setUploadProgress(percentCompleted);
                    }
                });
                return new Promise((resolve, reject) => {
                    xhr.onload = function () {
                        // Don't reset isUploading immediately, handlePost will manage isProcessingUpload next
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const responseData = JSON.parse(xhr.responseText);
                                if (responseData?.success && responseData?.url) {
                                    resolve({ success: true, url: responseData.url });
                                } else {
                                    reject(new Error(responseData?.error || 'Upload succeeded but response format is invalid or missing URL'));
                                }
                            }
                            catch (e) { reject(new Error('Invalid JSON response from upload server')); }
                        } else {
                            let errorMsg = `Upload failed with status ${xhr.status}`;
                            try { const errResp = JSON.parse(xhr.responseText); errorMsg = errResp.error || errResp.message || errorMsg; }
                            catch (e) { errorMsg = `${errorMsg}: ${xhr.statusText || 'Server error'}`; }
                            reject(new Error(errorMsg));
                        }
                    };
                     // Error handling resets states and hides loader
                    const handleError = (msg) => {
                        console.error("XHR Error:", msg)
                        setIsUploading(false);
                        setIsProcessingUpload(false);
                        setShowLoader(false); // Hide loader on error
                        reject(new Error(msg));
                    }
                    xhr.onerror = () => handleError('Network error during upload');
                    xhr.ontimeout = () => handleError('Upload timed out');
                    xhr.timeout = 600000; // 10 minutes
                    xhr.addEventListener('error', () => handleError('An unexpected error occurred during upload'));
                    xhr.open('POST', '/api/upload', true);
                    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
                    xhr.send(formData);
                });
            };
            const result = await uploadWithProgress(fileToUpload);
            setIsUploading(false); // Upload finished successfully
            setIsProcessingUpload(true); // Enter processing phase
            return result;

        } catch (error) {
            console.error('Upload function error:', error);
            setIsUploading(false);
            setIsProcessingUpload(false);
            setUploadProgress(0);
            setUploadError(error?.message || 'Upload failed');
            setShowLoader(false); // Hide loader on error
            return { success: false, error: error?.message || 'Upload failed' };
        }
    };


    // --- Thumbnail Generation (using local URL now) ---
    const generateVideoThumbnail = useCallback((url) => {
        if (!url) { setVideoThumbnail(''); return; }
        console.log("Attempting thumbnail generation for:", url.substring(0, 50) + "...");
        setVideoThumbnail('');
        const video = document.createElement('video');
        video.ref = localVideoRef; video.src = url; video.crossOrigin = "anonymous"; video.currentTime = 1; video.muted = true; video.preload = 'metadata';
        let timeoutId = null;
        const cleanup = () => { clearTimeout(timeoutId); video.removeEventListener('seeked', handleSeeked); video.removeEventListener('error', handleError); video.pause(); video.removeAttribute('src'); video.load(); video.remove(); console.log("Thumbnail generation cleanup executed."); };
        const captureFrame = () => {
            if (video.videoWidth === 0 || video.videoHeight === 0) { console.warn("Video dimensions still not ready after seek."); cleanup(); return; }
            console.log(`Video dimensions for thumbnail: ${video.videoWidth}x${video.videoHeight}`);
            const canvas = document.createElement('canvas'); const scale = Math.min(1, 200 / video.videoWidth); canvas.width = video.videoWidth * scale; canvas.height = video.videoHeight * scale; const ctx = canvas.getContext('2d');
            if (!ctx) { console.error("Failed to get 2D context for thumbnail"); cleanup(); return; }
            try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height); const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
                if (thumbnailUrl && thumbnailUrl.length > 'data:image/jpeg;base64,'.length) { setVideoThumbnail(thumbnailUrl); console.log("Thumbnail generated successfully."); }
                else { console.error("Generated thumbnail data URL is empty or invalid."); setVideoThumbnail(''); }
            } catch (e) { console.error("Canvas toDataURL error:", e); setVideoThumbnail(''); } finally { cleanup(); }
        };
        const handleSeeked = () => { console.log("'seeked' event triggered."); captureFrame(); };
        const handleError = (e) => { console.error("Video load/seek error during thumbnail generation:", e); setVideoThumbnail(''); cleanup(); };
        video.addEventListener('seeked', handleSeeked, { once: true }); video.addEventListener('error', handleError, { once: true });
        console.log("Calling video.load() for thumbnail..."); video.load();
        video.play().then(() => { console.log("Video play() succeeded (for thumbnail gen), pausing immediately."); video.pause(); video.currentTime = 1; }).catch(err => { console.warn("Video play() failed (this might be ok for thumbnail gen):", err.name, err.message); video.currentTime = 1; });
        timeoutId = setTimeout(() => { console.warn("Thumbnail generation timed out. Attempting capture anyway..."); if (video.readyState >= 2) { captureFrame(); } else { console.error("Timeout reached and video state insufficient for thumbnail."); cleanup(); } }, 15000);
    }, [localVideoRef]);

    // --- FIXED Timezone Handling in getScheduledDateTime ---
    const getScheduledDateTime = useCallback((checkOnly = false) => {
        if (!isScheduled || !scheduledDate || !scheduledTime) { if (checkOnly) return null; return null; }
        try {
            const dateParts = scheduledDate.split('-'); const timeParts = scheduledTime.split(':');
            const year = parseInt(dateParts[0], 10), month = parseInt(dateParts[1], 10) - 1, day = parseInt(dateParts[2], 10);
            const hours = parseInt(timeParts[0], 10), minutes = parseInt(timeParts[1], 10);
            if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes) || month < 0 || month > 11 || day < 1 || day > 31 || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) { throw new Error('Invalid date/time number format'); }
            const scheduledAtLocal = new Date(year, month, day, hours, minutes); // LOCAL Time
            const minimumTimeLocal = new Date(Date.now() + 1 * 60 * 1000); // ~1 min buffer LOCAL
            if (scheduledAtLocal <= minimumTimeLocal) { if (checkOnly) return null; throw new Error('Schedule time must be at least 1 minute in the future'); }
            return scheduledAtLocal; // Return LOCAL Date object
        } catch (error) { console.error("Get schedule date/time error:", error); if (checkOnly) return null; throw error; }
    }, [isScheduled, scheduledDate, scheduledTime]);


    // --- handlePost (Modified to include upload step & processing state) ---
    const handlePost = async () => {
        let uploadedVideoUrl = '';
        setUploadError(null); setPlatformResults({}); setPostSuccess(false); setScheduleSuccess(false); setShowLoader(false); // Reset loader visibility initially

        if (!file) { setUploadError('No media file selected.'); window.showToast?.error?.('Please select a video file first.'); return; }
        const selectedPlatforms = [];
        if (selectedTiktokAccounts.length > 0) selectedPlatforms.push('tiktok');
        if (selectedTwitterAccounts.length > 0) selectedPlatforms.push('twitter');
        if (selectedPlatforms.length === 0) { setUploadError('No accounts selected.'); window.showToast?.error?.('Please select at least one account to post to.'); return; }
        let firebaseUid = userId;
        if (!firebaseUid) { setUploadError('User ID missing. Please log in again.'); window.showToast?.error?.('Authentication error. Please log in again.'); return; }
        const scheduledAtLocal = getScheduledDateTime();
        if (isScheduled && !scheduledAtLocal) { setUploadError("Invalid schedule date/time selected."); window.showToast?.error?.("Invalid schedule date/time selected."); return; }

        // Check post limit before proceeding
        if (isPostLimitReached) {
            console.error('Post limit reached. Cannot post or schedule.');
            window.showToast?.error?.(postLimitMessage || 'Post limit reached.');
            return;
        }

        // Show loader is managed by handleFileUpload now
        // --- STEP 1: Upload the file ---
        try {
            console.log("Initiating upload within handlePost...");
            const uploadResult = await handleFileUpload(file); // This now sets isUploading, isProcessingUpload, and shows loader
            if (!uploadResult.success || !uploadResult.url) { throw new Error(uploadResult.error || 'File upload failed.'); }
            uploadedVideoUrl = uploadResult.url;
            setVideoUrl(uploadedVideoUrl);
            console.log("File upload successful, processing starting:", uploadedVideoUrl);
             // window.showToast?.success?.('Upload complete, processing...'); // Optional toast

        } catch (uploadError) {
            console.error('HandlePost error during upload phase:', uploadError);
            setUploadError(uploadError.message || 'An unexpected error occurred during upload.');
            window.showToast?.error?.(uploadError.message || 'Upload failed');
            // handleFileUpload resets states and hides loader on error
            return;
        }

        // --- STEP 2: Proceed with Scheduling or Immediate Posting --- (MODIFY THIS PART)
        setIsPosting(true); // Set general posting flag
        if (isScheduled) { setIsScheduling(true); }

        try {
             setIsProcessingUpload(false); // Backend processing simulation ends, actual API calls will start

            // --- UNIFIED PAYLOAD CREATION --- START
                    const payload = {
                        userId: firebaseUid,
                        video_url: uploadedVideoUrl,
                        post_description: caption,
                        platforms: selectedPlatforms,
                // Pass simplified account identifiers. Backend will fetch tokens if needed.
                        tiktok_accounts: selectedTiktokAccounts.map(acc => ({ accountId: acc.accountId, username: acc.username, displayName: acc.displayName })),
                        twitter_accounts: selectedTwitterAccounts.map(acc => ({ userId: acc.userId, username: acc.username })),
                isScheduled: isScheduled,
            };
            if (isScheduled && scheduledAtLocal) {
                payload.scheduledDate = scheduledAtLocal.toISOString(); // Add scheduledDate only if scheduling
            }
            // --- UNIFIED PAYLOAD CREATION --- END

            // --- API Call to UNIFIED Endpoint (/posts or /schedules) --- START
            // Use /posts as the primary endpoint now, as /schedules is just a forwarder
            const apiEndpoint = '/posts'; // Path relative to backend
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sociallane-backend.mindio.chat'; // Use env var or default
            const fullApiUrl = `${backendUrl}${apiEndpoint}`; // Construct full URL
            console.log(`Sending ${isScheduled ? 'schedule' : 'immediate post'} request to ${fullApiUrl} with payload:`, payload);

            const response = await fetchWithTimeoutAndRetry(fullApiUrl, { // Use fullApiUrl
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    // Read the JSON body ONCE
                    let responseData = {};
                    let parseError = null;
                    try {
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                             responseData = await response.json();
                        } else if (!response.ok) {
                            const text = await response.text();
                            throw new Error(`Server error (${response.status}): ${text.substring(0, 200)}`);
                        } else {
                    responseData = { success: true }; // Assume success if OK but not JSON
                        }
                    } catch (e) {
                console.error(`Error parsing ${isScheduled ? 'schedule' : 'post'} response JSON:`, e);
                        parseError = e;
                        if (!response.ok) {
                    throw new Error(`Failed to ${isScheduled ? 'schedule' : 'post'}. Status: ${response.status}. ${e.message}`);
                        } else {
                    throw new Error(`Request succeeded, but failed to parse response: ${e.message}`);
                        }
                    }
                    
                    // Check response status and parsed data
                    if (!response.ok || !responseData?.success) {
                throw new Error(responseData?.error || parseError?.message || `Failed to ${isScheduled ? 'schedule' : 'post'} post.`);
            }
            // --- API Call to UNIFIED Endpoint --- END

            // --- SUCCESS HANDLING --- START
            console.log(`${isScheduled ? 'Schedule' : 'Immediate post'} success response:`, responseData);
            
            // Detailed debug output to inspect the full response structure
            console.log('FULL RESPONSE DATA:', JSON.stringify(responseData, null, 2));
            
            setPostSuccess(true); // Mark overall success
            
            // Set the created post ID from the response - inspect all possible places it might be
            const extractId = () => {
                // Direct fields
                if (responseData._id) return responseData._id;
                if (responseData.id) return responseData.id;
                if (responseData.postId) return responseData.postId;
                
                // Nested fields
                if (responseData.data && responseData.data._id) return responseData.data._id;
                if (responseData.data && responseData.data.id) return responseData.data.id;
                if (responseData.data && responseData.data.postId) return responseData.data.postId;
                
                // Post object
                if (responseData.post && responseData.post._id) return responseData.post._id;
                if (responseData.post && responseData.post.id) return responseData.post.id;
                
                // Result object
                if (responseData.result && responseData.result._id) return responseData.result._id;
                if (responseData.result && responseData.result.id) return responseData.result.id;
                
                return null;
            };
            
            const postId = extractId();
            if (postId) {
                console.log('Found post ID:', postId);
                setCreatedPostId(postId);
            } else {
                console.warn('Could not find post ID in response:', responseData);
            }
            
            if (isScheduled) {
                    setScheduleSuccess(true);
                    window.showToast?.success?.(`Post scheduled successfully for ${scheduledAtLocal.toLocaleString()}`);
                // Update account status for scheduled posts
                const statuses = { t: {}, tw: {} };
                selectedTiktokAccounts.forEach(a => { statuses.t[a.accountId] = { status: 'success', message: 'Scheduled' }; });
                selectedTwitterAccounts.forEach(a => { statuses.tw[a.userId] = { status: 'success', message: 'Scheduled' }; });
                setAccountStatus(p => ({ tiktok: { ...p.tiktok, ...statuses.t }, twitter: { ...p.twitter, ...statuses.tw } }));
            } else {
                // For immediate posts, show a generic success/processing message
                window.showToast?.success?.('Post sent for processing!');
                // Reset account status for immediate posts (backend handles status updates via processPost)
                setAccountStatus({ tiktok: {}, twitter: {} });
                // Reset platform results as backend handles async processing
                setPlatformResults({});
                // Refresh post usage data to reflect the increment (after successful submission)
                fetchPostUsage();
            }
            // --- SUCCESS HANDLING --- END

        } catch (error) {
            // --- ERROR HANDLING --- START
            console.error(`Error during ${isScheduled ? 'schedule' : 'post'} API call:`, error);
            setUploadError(error.message);
            setPostSuccess(false);
            if (isScheduled) setScheduleSuccess(false);
            window.showToast?.error?.(error.message || `Failed to ${isScheduled ? 'schedule' : 'post'} post`);
            
            // Try to extract post ID from error response if it exists
            if (error.response && error.response.data) {
                const errorData = error.response.data;
                if (errorData._id || errorData.postId || errorData.id) {
                    const postId = errorData._id || errorData.postId || errorData.id;
                    console.log('Setting created post ID from error response:', postId);
                    setCreatedPostId(postId);
                    setPostSuccess(true); // Set success to true so the view button shows
                }
            }
            
            // Update account status on error
            const errUpd = { t: {}, tw: {} };
            selectedTiktokAccounts.forEach(a => { errUpd.t[a.accountId] = { status: 'error', message: error.message || 'Fail' }; });
            selectedTwitterAccounts.forEach(a => { errUpd.tw[a.userId] = { status: 'error', message: error.message || 'Fail' }; });
            setAccountStatus(p => ({ tiktok: { ...p.tiktok, ...errUpd.t }, twitter: { ...p.twitter, ...errUpd.tw } }));
            // --- ERROR HANDLING --- END
        } finally {
             setIsPosting(false);
             setIsScheduling(false);
             // Loader visibility is handled by PostingLoader's auto-close now
             
             // Debug: Log if we have a post ID
             console.log('Post completed, createdPostId:', createdPostId);
             
             // If we're in success state but don't have a post ID, try to get it from the response data
             if (postSuccess && !createdPostId) {
                // The ID should be in the response, but as a fallback, let's check the URL parameters
                const urlParams = new URLSearchParams(window.location.search);
                const idFromUrl = urlParams.get('id');
                if (idFromUrl) {
                    console.log('Found post ID from URL:', idFromUrl);
                    setCreatedPostId(idFromUrl);
                }
             }
        }
    };


    // --- Filtered accounts ---
    const filteredTiktokAccounts = useMemo(() => { if (!searchTerm) return tiktokAccounts; const term = searchTerm.toLowerCase(); return tiktokAccounts.filter(a => (a.username?.toLowerCase() || '').includes(term) || (a.displayName?.toLowerCase() || '').includes(term)); }, [tiktokAccounts, searchTerm]);
    const filteredTwitterAccounts = useMemo(() => { if (!searchTerm) return twitterAccounts; const term = searchTerm.toLowerCase(); return twitterAccounts.filter(a => (a.username?.toLowerCase() || '').includes(term) || (a.name?.toLowerCase() || '').includes(term)); }, [twitterAccounts, searchTerm]);

    // --- Helper: hasValidPlatforms ---
    const hasValidPlatforms = useCallback(() => selectedTiktokAccounts?.length > 0 || selectedTwitterAccounts?.length > 0, [selectedTiktokAccounts, selectedTwitterAccounts]);

    // --- Derived state for checking limits ---
    const isPostLimitReached = useMemo(() => {
        // If post usage data is not available, fall back to user limits
        if (postUsageLoading || !postUsage) {
        if (!userLimits) return false; // Assume not reached if limits not loaded
        
            const limit = userLimits.numberOfPosts; // Use numberOfPosts limit for all posts
        const currentCount = userLimits.currentPostsCount; 
        
        // Check if limit is defined (-1 means unlimited)
        if (limit === -1) {
            return false;
        }
        
        // Check if current count meets or exceeds the limit
        return currentCount >= limit;
        }
        
        // Use post usage data when available (more accurate)
        if (postUsage.postsRemaining === -1) {
            return false; // Unlimited posts
        }
        
        return postUsage.postsRemaining <= 0 && !postUsage.needsCycleReset;
    }, [postUsage, postUsageLoading, userLimits]);

    // Enhanced post limit message using detailed usage data
    const postLimitMessage = useMemo(() => {
        if (!isPostLimitReached) return null;
        
        // Prefer post usage data when available
        if (postUsage) {
            const limit = postUsage.limit;
            const resetDate = postUsage.nextResetDate ? new Date(postUsage.nextResetDate).toLocaleDateString() : 'your next cycle';
            return `You've reached your monthly limit of ${limit} post${limit > 1 ? 's' : ''} for the ${postUsage.userRole} plan. Your limit will reset on ${resetDate}. Upgrade for more posts!`;
        }
        
        // Fall back to user limits
        if (userLimits) {
            const limit = userLimits.numberOfPosts;
        if (userLimits.role === 'Starter') {
            const resetDate = userLimits.cycleEndDate ? new Date(userLimits.cycleEndDate).toLocaleDateString() : 'your next cycle';
                return `You've reached your monthly limit of ${limit} post${limit > 1 ? 's' : ''} for the ${userLimits.role} plan. Your limit will reset on ${resetDate}. Upgrade for more posts!`;
        }
        return `You've reached your plan limit of ${limit} posts. Please upgrade your plan for more posts.`;
        }
        
        // Generic message if no data is available
        return 'You have reached your post limit. Please upgrade your plan for more posts.';
    }, [isPostLimitReached, postUsage, userLimits]);

    // --- PostingLoader Component (MODIFIED) ---
    const PostingLoader = ({ show, isUploading, isProcessingUpload, isPosting, isScheduling, progress, scheduleSuccess, postSuccess, platformResults, createdPostId, onClose }) => {
        const [vis, setVis] = useState(show);
        const [leaving, setLeaving] = useState(false);
        const [currentStage, setCurrentStage] = useState('idle'); // 'uploading', 'processing_upload', 'posting', 'scheduling', 'done_success', 'done_partial', 'done_error'
        const internalCloseTimer = useRef(null);

        const close = useCallback(() => {
            if (!leaving) {
                setLeaving(true);
                if (internalCloseTimer.current) clearTimeout(internalCloseTimer.current);
                internalCloseTimer.current = setTimeout(() => {
                    setVis(false);
                    setLeaving(false);
                    if (onClose) onClose(); // Notify parent to potentially update state like `showLoader`
                }, 300); // Animation duration
            }
        }, [leaving, onClose]);

        useEffect(() => {
             // Control visibility based on show prop
            if (show) {
                setVis(true);
                setLeaving(false);
                 if (internalCloseTimer.current) clearTimeout(internalCloseTimer.current); // Clear any pending close timer
            } else if (vis && !leaving) {
                // If parent forces close (e.g., resetForNewPost), start leaving animation
                close();
            }

             // Determine current stage
             if (isUploading) {
                 setCurrentStage('uploading');
             } else if (isProcessingUpload) {
                 setCurrentStage('processing_upload');
             } else if (isPosting || isScheduling) {
                 setCurrentStage(isScheduling ? 'scheduling' : 'posting');
             } else if (scheduleSuccess) {
                 setCurrentStage('done_success');
             } else if (postSuccess) {
                 // Check for partial success/errors in immediate posting results
                const hasErrors = Object.values(platformResults).some(r => Array.isArray(r) && r.some(i => !i.success));
                setCurrentStage(hasErrors ? 'done_partial' : 'done_success');
             } else if (!isUploading && !isProcessingUpload && !isPosting && !isScheduling && (Object.keys(platformResults).length > 0 && !postSuccess)) {
                 // Posting attempted but failed for all
                 setCurrentStage('done_error');
             } else if (!show && !isUploading && !isProcessingUpload && !isPosting && !isScheduling) {
                 setCurrentStage('idle'); // Ensure idle state when explicitly hidden and not active
             }
        }, [show, isUploading, isProcessingUpload, isPosting, isScheduling, scheduleSuccess, postSuccess, platformResults, vis, leaving, close]); // Added close to deps

         // Auto-close on success effect
        useEffect(() => {
            if (currentStage === 'done_success' || currentStage === 'done_partial' || currentStage === 'done_error') {
                console.log("PostingLoader: Stage is done, setting auto-close timer.");
                 if (internalCloseTimer.current) clearTimeout(internalCloseTimer.current); // Clear previous timer if stage changes rapidly
                 internalCloseTimer.current = setTimeout(() => {
                    console.log("PostingLoader: Auto-close timer fired.");
                    close();
                }, 3000); // 3 seconds
            }

            // Cleanup timer if component unmounts or stage changes before timeout
            return () => {
                 if (internalCloseTimer.current) {
                    console.log("PostingLoader: Clearing auto-close timer due to stage change or unmount.");
                    clearTimeout(internalCloseTimer.current);
                 }
            };
        }, [currentStage, close]); // Depend on currentStage and close


        if (!vis) return null;

        let title = "Processing...";
        let message = "Please wait...";
        let showProgressBar = false;
        let icon = <div className="relative mr-3"><div className="w-7 h-7 rounded-full border-4 border-gray-200"></div><div className="abs top-0 left-0 w-7 h-7 rounded-full border-4 border-t-blue-500 border-r-trans border-b-trans border-l-trans animate-spin"></div></div>; // Default spinner
        let canClose = !isUploading && !isProcessingUpload && !isPosting && !isScheduling;
        let bgColor = "bg-gray-700"; // Default background color

        switch (currentStage) {
            case 'uploading':
                title = "Uploading Video";
                message = `${Math.round(progress)}% complete`;
                break;
            case 'processing_upload':
                title = "Processing Upload";
                message = "Preparing your video...";
                break;
            case 'posting':
                title = "Posting Content";
                message = "Sending to social platforms...";
                break;
            case 'scheduling':
                title = "Scheduling Post";
                message = "Setting up your scheduled post...";
                break;
            case 'done_success':
                title = "Success!";
                message = isScheduling ? "Your post has been scheduled." : "Your post was published successfully.";
                icon = <svg className="mr-3 h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
                bgColor = "bg-green-600";
                 break;
            case 'done_partial':
                title = "Partially Complete";
                message = "Some platforms succeeded, others failed. Check details below.";
                 title = "Post Complete (Partial)";
                 message = "Some posts succeeded, check status below.";
                 icon = <div className="mr-3"><svg className="h-7 w-7 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>;
                 break;
             case 'done_error':
                 title = "Posting Failed";
                 message = "Could not post to any selected accounts.";
                 icon = <div className="mr-3"><svg className="h-7 w-7 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path></svg></div>;
                 break;
            default: // idle
                 icon = null; // Don't show icon when idle
                 title = "Status"; message = "Ready."; // Placeholder if shown idle
                 break;
        }


        return (
            <div className={`fixed top-4 right-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[300px] max-w-[400px] transition-all duration-300 transform ${leaving ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
                <div className="flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-base font-medium text-gray-800">{title}</h3>
                    </div>
                     {/* Only show icon/message row if not idle */}
                     {currentStage !== 'idle' && (
                        <div className="flex items-center mb-3">
                            {icon}
                            <p className="text-sm text-gray-600">{message}</p>
                        </div>
                     )}
                    {showProgressBar && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mb-2">
                            <div className="bg-blue-500 h-1.5 rounded-full transition-width duration-150" style={{ width: `${progress}%` }}></div>
                        </div>
                    )}
                     {(currentStage === 'done_partial' || currentStage === 'done_error') && !scheduleSuccess && (
                         <Link href="#posting-status" onClick={close} className="text-xs text-blue-600 hover:underline mt-1">Scroll to detailed status</Link>
                     )}
                     
                     {/* View Details button for successful post with an ID */}
                     {(currentStage === 'done_success' || currentStage === 'done_partial') && createdPostId && (
                         <Link href={`/created-post/${createdPostId}`} className="text-xs text-blue-600 hover:underline mt-1 block">View Details</Link>
                     )}
                     
                      {/* Show keep tab open only during active processing */}
                     {(currentStage === 'uploading' || currentStage === 'processing_upload' || currentStage === 'posting' || currentStage === 'scheduling') && (
                        <p className="text-xs text-gray-500 mt-2 tc">Keep tab open during process.</p>
                     )}
                </div>
            </div>
        );
    };


    // --- AccountStatusIndicator Component ---
    const AccountStatusIndicator = ({ status }) => { if (!status) return <div className="text-xs t-gray-400">Pend...</div>; const base = "flex items-center text-xs gap-1"; let i, c, t; switch (status.status) { case 'loading': i = <svg className="a-s h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="op-25"></circle><path d="M4 12a8 8 0 018-8V0C5 0 0 5 0 12h4zm2 5.3A8 8 0 014 12H0c0 3 1.1 6 3 8l3-2.7z" fill="currentColor" className="op-75"></path></svg>; c = "text-blue-600"; t = status.message || 'Proc...'; break; case 'success': i = <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z" clipRule="evenodd" /></svg>; c = "text-green-600"; t = status.message || 'OK'; break; case 'error': i = <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.7 7.3a1 1 0 00-1.4 1.4L8.6 10l-1.3 1.3a1 1 0 101.4 1.4L10 11.4l1.3 1.3a1 1 0 001.4-1.4L11.4 10l1.3-1.3a1 1 0 00-1.4-1.4L10 8.6 8.7 7.3z" clipRule="evenodd" /></svg>; c = "text-red-600"; t = status.message || 'Error'; break; case 'next': i = <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.3.7l2.8 2.8a1 1 0 101.4-1.4L11 9.6V6z" clipRule="evenodd" /></svg>; c = "text-yellow-600"; t = status.message || 'Next..'; break; default: i = <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.3.7l2.8 2.8a1 1 0 101.4-1.4L11 9.6V6z" clipRule="evenodd" /></svg>; c = "text-gray-500"; t = status.message || 'Wait..'; break; } return <div className={`${base} ${c}`} title={t}>{i} <span className="truncate max-w-[100px]">{t}</span></div>; };


    // --- Button Disabled Logic ---
    const isScheduleDateTimeValid = useMemo(() => !!getScheduledDateTime(true), [getScheduledDateTime]);
    const isPostButtonDisabled = useMemo(() => {
        const hasMediaSelected = !!file;
        // Disable if any operation is active, or no media, or no platforms
        const common = isUploading || isProcessingUpload || isPosting || isScheduling || !hasMediaSelected || !hasValidPlatforms();
        const isDisabled = isScheduled ? (common || !isScheduleDateTimeValid) : common;
        return isDisabled;
    }, [file, isUploading, isProcessingUpload, isPosting, isScheduling, hasValidPlatforms, isScheduled, isScheduleDateTimeValid]);

    // New derived state for overall page disable based on post limit
    const isPageDisabledByLimit = useMemo(() => isPostLimitReached, [isPostLimitReached]);

    // --- JSX Structure ---
    return (
        <>
            <Head> <title>Create Post | Social Lane</title> <meta name="description" content="Post media" /> </Head>

            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="video/*" disabled={isPageDisabledByLimit || isUploading || isProcessingUpload || isPosting || isScheduling} />

            {/* Post Limit Reached Banner */}
            {isPageDisabledByLimit && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mt-3 mb-4 mx-4 rounded-md shadow-md" role="alert">
                    <div className="flex items-center">
                        <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 00.293.707l3 3a1 1 0 001.414-1.414L11 10.586V5z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <p className="font-bold">Monthly Post Limit Reached</p>
                            <p className="text-sm">{postLimitMessage || 'Upgrade your plan to continue posting.'}</p>
                            <Link href="/subscription" className="text-sm font-medium text-primary hover:text-primary-dark underline mt-1 inline-block">
                                Upgrade Plan
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            <div className={`flex flex-col lg:flex-row gap-4 p-4 bg-gray-100 min-h-screen ${isPageDisabledByLimit ? 'opacity-60 pointer-events-none' : ''}`}>

                {/* Left Column: Adjusted Width */}
                <div className="w-full lg:w-2/5 flex flex-col gap-4 flex-shrink-0">

                    {/* MERGED Search + Account Selection - Disable input and toggles */}
                     <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col gap-4">
                        <div> {/* Search */}
                            <label htmlFor="account-search" className="sr-only">Search Accounts</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg></div>
                                <input 
                                    id="account-search" 
                                    type="search" 
                                    placeholder="Search accounts..." 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    disabled={isPageDisabledByLimit || isUploading || isProcessingUpload || isPosting || isScheduling || postSuccess} 
                                />
                        </div>
                        </div>
                        <div> {/* Accounts List - Apply disabled styling/logic */}
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-base font-semibold text-gray-700">Select Accounts</h3>
                                {/* Moved Limit Indicator */}
                                {userLimits?.role === 'Starter' && !isPageDisabledByLimit && (
                                    <div className="text-xs text-gray-600 flex items-center">
                                        <span className="mr-1">Selected:</span>
                                        <span className="font-medium mr-0.5">{selectedTiktokAccounts.length + selectedTwitterAccounts.length}</span>/
                                        <span className="font-medium mr-2">{userLimits.socialAccounts}</span>
                                        {selectedTiktokAccounts.length + selectedTwitterAccounts.length >= userLimits.socialAccounts && (
                                            <Link href="/subscription" className="text-primary font-medium hover:underline">
                                                Upgrade
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Display Post Quota for Starter Users */} 
                            {!postUsageLoading && postUsage && postUsage.userRole === 'Starter' && (
                                <div className="mb-3 py-1 px-2 rounded border border-gray-200 bg-gray-50 text-xs text-gray-700">
                                    Monthly Posts: <span className="font-medium">{postUsage.currentPostCount}/{postUsage.limit === -1 ? 'Unlimited' : postUsage.limit}</span> used.
                                    {postUsage.limit !== -1 && (
                                        <span className="ml-1">Resets on {new Date(postUsage.nextResetDate).toLocaleDateString()}.</span>
                                    )}
                                </div>
                             )}

                            <div className="flex flex-wrap gap-4 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                {filteredTiktokAccounts.map(a => { 
                                  const s = selectedTiktokAccounts.some(x => x.accountId === a.accountId); 
                                  const n = a.displayName || a.username || `TT ${a.accountId?.substring(0, 5)}`;
                                  const tip = `${n}${a.username ? ` (@${a.username})` : ''} - TikTok`;
                                    // General disable based on page/posting state
                                    const isDisabledGeneral = isPageDisabledByLimit || isUploading || isProcessingUpload || isPosting || isScheduling || postSuccess;
                                    // Specific disable for unselected accounts when limit is reached
                                    const isLimitReached = userLimits?.role === 'Starter' && (selectedTiktokAccounts.length + selectedTwitterAccounts.length >= userLimits?.socialAccounts);
                                    const isDisabledForSelection = !s && isLimitReached;
                                    // Combine disable states
                                    const isDisabled = isDisabledGeneral || isDisabledForSelection;

                                  return (
                                    <div 
                                      key={a.accountId} 
                                      onClick={() => isDisabled ? null : handleTikTokAccountToggle(a)} 
                                      title={tip} 
                                            className={`group relative w-14 h-14 rounded-full ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} border-2 ${s ? 'border-blue-600 ring-2 ring-blue-600 ring-offset-1' : 'border-gray-300 hover:border-blue-400'} transition-all flex-shrink-0`}
                                    >
                                      <img src={a.avatarUrl100 || a.avatarUrl || '/default-avatar.png'} alt={n} className="w-full h-full rounded-full object-cover" />
                                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                                        <TikTokSimpleIcon width="10" height="10" fill="#ffffff" />
                                      </div>
                                            {s && !isDisabledGeneral && (<div className="absolute inset-0 rounded-full bg-blue-600/60 flex items-center justify-center pointer-events-none">
                                                <svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                                            </div>)}
                                            {/* Add visual indicator for disabled selection */} 
                                            {isDisabledForSelection && (
                                                <div className="absolute inset-0 rounded-full bg-gray-500/50 flex items-center justify-center pointer-events-none">
                                                </div>
                                            )}
                                    </div>
                                  );
                                })}
                                {filteredTwitterAccounts.map(a => { 
                                  const s = selectedTwitterAccounts.some(x => x.userId === a.userId); 
                                  const n = a.name || a.username || `TW ${a.userId}`;
                                  const tip = `${n}${a.username ? ` (@${a.username})` : ''} - Twitter`;
                                    // General disable based on page/posting state
                                    const isDisabledGeneral = isPageDisabledByLimit || isUploading || isProcessingUpload || isPosting || isScheduling || postSuccess;
                                     // Specific disable for unselected accounts when limit is reached
                                    const isLimitReached = userLimits?.role === 'Starter' && (selectedTiktokAccounts.length + selectedTwitterAccounts.length >= userLimits?.socialAccounts);
                                    const isDisabledForSelection = !s && isLimitReached;
                                    // Combine disable states
                                    const isDisabled = isDisabledGeneral || isDisabledForSelection;
                                    
                                  return (
                                    <div 
                                      key={a.userId} 
                                      onClick={() => isDisabled ? null : handleTwitterAccountToggle(a)} 
                                      title={tip} 
                                            className={`group relative w-14 h-14 rounded-full ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} border-2 ${s ? 'border-blue-600 ring-2 ring-blue-600 ring-offset-1' : 'border-gray-300 hover:border-blue-400'} transition-all flex-shrink-0`}
                                    >
                                      <img src={a.profileImageUrl || '/default-avatar.png'} alt={n} className="w-full h-full rounded-full object-cover" />
                                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white bg-blue-500 border-2 border-white shadow-md"><TwitterIcon width="10" height="10" fill="white" /></div>
                                            {s && !isDisabledGeneral && (<div className="absolute inset-0 rounded-full bg-blue-600/60 flex items-center justify-center pointer-events-none"><svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" /></svg></div>)}
                                            {/* Add visual indicator for disabled selection */} 
                                            {isDisabledForSelection && (
                                                <div className="absolute inset-0 rounded-full bg-gray-500/50 flex items-center justify-center pointer-events-none">
                                                </div>
                                            )}
                                    </div>
                                  );
                                })}
                                {(tiktokAccounts.length === 0 && twitterAccounts.length === 0 && !searchTerm) && (<div className="w-full mt-2 text-center text-sm text-gray-500">No accounts.<Link href="/dashboard" className="ml-1 text-blue-600 hover:underline">Connect</Link></div>)}
                                {(filteredTiktokAccounts.length === 0 && filteredTwitterAccounts.length === 0 && searchTerm) && (<div className="w-full mt-2 text-center text-sm text-gray-500">No results.</div>)}
                            </div>
                        </div>
                    </div>


                    {/* Media Upload/Preview Area (Small) - Disable buttons */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                         {file && localPreviewUrl ? (
                             <div className="flex items-center gap-3">
                                 <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-200 flex-shrink-0 border border-gray-300">
                                     {videoThumbnail ? (<img src={videoThumbnail} alt="Thumb" className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center text-gray-400 animate-pulse"><svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>)}
                                 </div>
                                 <div className="flex-grow min-w-0">
                                     <p className="text-sm font-medium text-gray-700 truncate" title={uploadedFileName || 'Video Selected'}>{uploadedFileName || 'Video Selected'}</p>
                                     <div className="flex gap-2 mt-1">
                                         <button onClick={handleReplaceMediaClick} className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isPageDisabledByLimit || isUploading || isProcessingUpload || isPosting || isScheduling || postSuccess} > <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2A8.001 8.001 0 0019.418 15m0 0H15" /></svg> Replace </button>
                                         <button className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-400 cursor-not-allowed flex items-center gap-1" disabled title="Set Cover Image (Coming Soon)"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>Cover</button>
                                     </div>
                                 </div>
                             </div>
                         ) : (
                             <div
                                onClick={handleUploadClick}
                                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-300 ${
                                    isPageDisabledByLimit 
                                    ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60' 
                                    : 'border-gray-300 hover:border-primary hover:bg-blue-50 cursor-pointer'
                                }`}
                            >
                                {isPostLimitReached ? (
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        <p className="text-gray-500 text-base">Post limit reached. Upgrade your plan to continue posting.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <p className="text-gray-500 text-base">Drag & drop video or click to upload</p>
                                        <p className="text-gray-400 text-sm">MP4, MOV, or WebM (max 500MB)</p>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="video/*"
                                    className="hidden"
                                    disabled={isPostLimitReached || isUploading || isPosting}
                                />
                            </div>
                         )}
                         {uploadError && !isUploading && !isProcessingUpload && !isPosting && !isScheduling && (<p className="text-xs text-red-600 mt-2">{uploadError}</p>)}
                    </div>


                    {/* Caption Area - Disable textarea */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <label htmlFor="main-caption" className="block text-base font-semibold mb-2 text-gray-700">Main Caption <span className="text-gray-400 text-xs font-normal ml-1">(Optional)</span></label>
                        <textarea 
                          id="main-caption" 
                          className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                          value={caption} 
                          onChange={(e) => setCaption(e.target.value)} 
                          placeholder="Start writing your post here..." 
                          maxLength={2200}
                          disabled={isPageDisabledByLimit || isUploading || isProcessingUpload || isPosting || isScheduling || postSuccess}
                        />
                        <p className="text-xs text-gray-400 text-right mt-1">{caption.length}/2200</p>
                    </div>
                </div>

                {/* Right Column: Adjusted Width and Layout */}
                <div className="w-full lg:w-3/5 flex flex-col gap-4">

                    {/* Media Preview (Large) - No changes needed, just display */} 
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-base font-semibold mb-3 text-gray-700">Media Preview</h3>
                        <div className="bg-white-900 rounded-md overflow-hidden relative flex items-center justify-center aspect-video">
                            {localPreviewUrl ? (<video ref={videoRef} src={localPreviewUrl} controls className="max-w-full max-h-full block" playsInline />) : (<div className="tc text-gray-500 p-8"><svg className="h-12 w-12 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.5-2.3A1 1 0 0121 8.6v6.8a1 1 0 01-1.5.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><p>Upload media to see preview</p></div>)}
                            {localPreviewUrl && uploadedFileName && (<div className="abs bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{uploadedFileName}</div>)}
                        </div>
                    </div>


                    {/* Schedule Post Section - Disable toggle and inputs */}
                     {!postSuccess || scheduleSuccess ? (
                        <div className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 ${(postSuccess && !scheduleSuccess) ? 'hidden' : ''}`}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base font-semibold text-gray-700">Schedule post</h3>
                                {!scheduleSuccess && (
                                  <label className="relative inline-flex items-center cursor-pointer"> 
                                    <input 
                                      type="checkbox" 
                                      className="sr-only peer" 
                                      checked={isScheduled} 
                                      onChange={(e) => setIsScheduled(e.target.checked)} 
                                      disabled={isPageDisabledByLimit || scheduleSuccess || isUploading || isProcessingUpload || isPosting || isScheduling || postSuccess} 
                                    /> 
                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div> 
                                  </label>
                                )}
                            </div>
                            {scheduleSuccess ? (
                              <div className="text-center py-4"> 
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-500 mx-auto mb-3">
                                  <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </div> 
                                <p className="text-sm text-gray-600"> 
                                  Post scheduled for <span className="font-medium">{scheduledDate && scheduledTime ? new Date(scheduledDate + 'T' + scheduledTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '...'}</span> 
                                </p> 
                                <div className="mt-5">
                                  <button 
                                    className="py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors duration-200 flex items-center justify-center gap-2 text-base w-full" 
                                    onClick={resetForNewPost}
                                  > 
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg> 
                                    Create Another Post 
                                  </button>
                                </div>
                                <Link href="/scheduled-posts" className="mt-3 inline-block text-sm text-blue-600 hover:underline">View All Scheduled Posts</Link> 
                              </div>
                            ) : isScheduled ? (
                              <div className="flex flex-col sm:flex-row gap-3 relative">
                                <div className="flex-1"> 
                                  <label htmlFor="schedule-date" className="block text-xs font-medium text-gray-500 mb-1">Date</label> 
                                  <input 
                                    id="schedule-date" 
                                    type="date" 
                                    value={scheduledDate} 
                                    onChange={(e) => setScheduledDate(e.target.value)} 
                                    min={new Date().toISOString().split('T')[0]} 
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                                    disabled={isPageDisabledByLimit || isUploading || isProcessingUpload || isPosting || isScheduling || postSuccess} 
                                  /> 
                                </div>
                                <div className="flex-1"> 
                                  <label htmlFor="schedule-time" className="block text-xs font-medium text-gray-500 mb-1">Time</label> 
                                  <input 
                                    id="schedule-time" 
                                    type="time" 
                                    value={scheduledTime} 
                                    onChange={(e) => setScheduledTime(e.target.value)} 
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                                    disabled={isPageDisabledByLimit || isUploading || isProcessingUpload || isPosting || isScheduling || postSuccess} 
                                    step="60" 
                                  /> 
                                </div>
                              </div>
                            ) : null}
                            {!scheduleSuccess && (<div className="flex items-center mt-3 text-xs text-gray-500"><svg className="h-4 w-4 mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Schedule posts at least 1 minute in advance. Times are based on your local timezone.</div>)}
                        </div>
                    ) : null}

                    {/* Posting Status/Results - No changes needed */} 
                    <div id="posting-status">
                        {(Object.keys(platformResults).length > 0 || (isPosting && !isUploading && !isProcessingUpload && !scheduleSuccess) || (isScheduling && !isUploading && !isProcessingUpload && !scheduleSuccess)) && (
                            <div className="mt-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="text-sm font-semibold mb-3 text-gray-700">Posting Status</h4>
                                <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                    {/* TikTok Accounts Group */}
                                    {selectedTiktokAccounts.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 pb-1 border-b border-gray-200">
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white bg-black">
                                                    <TikTokSimpleIcon width="10" height="10" fill="white" />
                                                </div>
                                                <h5 className="text-xs font-semibold text-gray-600">TikTok</h5>
                                            </div>
                                            <div className="pl-2 space-y-2">
                                                {selectedTiktokAccounts.map(account => {
                                                    const id = account.accountId;
                                                    const status = accountStatus?.tiktok?.[id] || { status: 'idle', message: 'Waiting...' };
                                                    const name = account.displayName || account.username || `TikTok User`;
                                                    const avatar = account.avatarUrl100 || account.avatarUrl;
                                                    return (
                                                        <div key={id} className="flex items-center justify-between text-sm">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <img src={avatar || '/default-avatar.png'} alt={name} className="w-6 h-6 rounded-full shrink-0 obj-cover border" />
                                                                <span className="font-medium text-gray-800 truncate">{name}</span>
                                                            </div>
                                                            <AccountStatusIndicator status={status} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Twitter Accounts Group */}
                                    {selectedTwitterAccounts.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 pb-1 border-b border-gray-200">
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white bg-blue-500">
                                                    <TwitterIcon width="10" height="10" fill="white" />
                                                </div>
                                                <h5 className="text-xs font-semibold text-gray-600">Twitter</h5>
                                            </div>
                                            <div className="pl-2 space-y-2">
                                                {selectedTwitterAccounts.map(account => {
                                                    const id = account.userId;
                                                    const status = accountStatus?.twitter?.[id] || { status: 'idle', message: 'Waiting...' };
                                                    const name = `@${account.username || account.userId}`;
                                                    const avatar = account.profileImageUrl;
                                                    return (
                                                        <div key={id} className="flex items-center justify-between text-sm">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <img src={avatar || '/default-avatar.png'} alt={name} className="w-6 h-6 rounded-full shrink-0 obj-cover border" />
                                                                <span className="font-medium text-gray-800 truncate">{name}</span>
                                                            </div>
                                                            <AccountStatusIndicator status={status} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Show a message if no accounts are selected */}
                                    {selectedTiktokAccounts.length === 0 && selectedTwitterAccounts.length === 0 && (
                                        <div className="text-center py-2 text-sm text-gray-500">
                                            No accounts selected for posting.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                     {/* Action Button Area - Main post button already has logic */} 
                    <div className="mt-4"> 
                        {!postSuccess ? (
                            <button 
                              className={`w-full py-2.5 px-4 rounded-lg text-white font-medium transition-colors duration-200 flex items-center justify-center gap-2 text-base ${isPostButtonDisabled || isPageDisabledByLimit ? 'bg-gray-400 cursor-not-allowed' : (isScheduled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700')}`}
                              onClick={handlePost} 
                              disabled={isPostButtonDisabled || isPageDisabledByLimit}
                              aria-live="polite"
                            >
                                {(isUploading || isProcessingUpload || isPosting || isScheduling) && (<svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" className="opacity-75"></path></svg>)}
                                {isUploading ? `Uploading (${uploadProgress}%)` : (isProcessingUpload ? 'Processing...' : (isScheduling ? 'Scheduling...' : (isPosting ? 'Posting...' : (isScheduled ? 'Schedule Post' : 'Post Now'))))}
                            </button>
                         ) : (!scheduleSuccess && (
                            <div className="flex flex-col md:flex-row gap-3">
                            <button 
                                className="flex-1 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors duration-200 flex items-center justify-center gap-2 text-base" 
                              onClick={resetForNewPost}
                            > 
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg> 
                              Create Another Post 
                            </button>
                              
                              {/* Add View Post Details button next to Create Another Post */}
                              <Link 
                                href={createdPostId ? `/created-post/${createdPostId}` : '#'}
                                className={`flex-1 py-2.5 px-4 rounded-lg ${createdPostId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} text-white font-medium transition-colors duration-200 flex items-center justify-center gap-2 text-base`}
                                onClick={e => !createdPostId && e.preventDefault()}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View Post Details
                              </Link>
                            </div>
                          ))
                        }
                    </div>

                </div> {/* End Right Column */}

            </div> {/* End Main Flex Container */}

            {/* Video Modal */}
            {showVideoModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75" onClick={() => setShowVideoModal(false)}> <div className="relative w-11/12 max-w-4xl rounded-xl overflow-hidden shadow-2xl z-10 bg-black" onClick={(e) => e.stopPropagation()}> {(videoUrl || localPreviewUrl) && (<video className="w-full h-auto max-h-[80vh] object-contain block" src={videoUrl || localPreviewUrl} controls autoPlay playsInline />)} <button onClick={() => setShowVideoModal(false)} className="absolute top-2 right-2 text-white bg-black/50 rounded-full p-1.5 hover:bg-black/75 transition-colors" aria-label="Close"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button> </div> </div>)}

            {/* Posting Loader Component - Pass relevant states */}
             <PostingLoader
                 show={showLoader} // Use dedicated state to control visibility
                 isUploading={isUploading}
                 isProcessingUpload={isProcessingUpload}
                 isPosting={isPosting}
                 isScheduling={isScheduling}
                 progress={uploadProgress}
                 scheduleSuccess={scheduleSuccess}
                 postSuccess={postSuccess}
                 platformResults={platformResults}
                 createdPostId={createdPostId}
                 onClose={() => setShowLoader(false)} // Allow loader to hide itself
             />


            <style jsx global>{`
            .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #c7c7c7; border-radius: 3px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
            input[type="date"], input[type="time"] { -webkit-appearance: revert; appearance: revert; }
            .abs { position: absolute; }
            .rel { position: relative; }
            .a-s { animation: spin 1s linear infinite; }
            .op-25 { opacity: 0.25; }
            .op-75 { opacity: 0.75; }
            .shrink-0 { flex-shrink: 0; }
            .obj-cover { object-fit: cover; }
            .p-e-none { pointer-events: none; }
            .tc { text-align: center; }
            .border-trans { border-color: transparent; }
            .transition-width { transition: width 0.15s ease-out; }
        `}</style>

            {/* Limit Warning Message */}    
            {isPostLimitReached && postLimitMessage && (
                <div className="max-w-4xl mx-auto mt-4 p-6 bg-red-50 border-l-4 border-red-500 rounded-lg text-center shadow-md">
                    <div className="flex items-center justify-center mb-3">
                        <svg className="w-10 h-10 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <h3 className="text-lg font-semibold text-red-800">Monthly Post Limit Reached</h3>
                    </div>
                    <p className="text-md text-red-700 mb-2">{postLimitMessage}</p>
                    <Link href="/subscription" className="inline-block mt-2 px-4 py-2 bg-primary text-white font-medium rounded hover:bg-primary-dark transition-colors duration-200">
                        Upgrade Your Plan
                    </Link>
                </div>
            )}

            {/* Post Button - Update disabled condition */}
            <div className="mt-8 flex justify-center">
                <button 
                    onClick={handlePost} 
                    disabled={!videoUrl || isUploading || isPosting || isProcessingUpload || (!selectedTiktokAccounts.length && !selectedTwitterAccounts.length) || isPostLimitReached || limitsLoading || (userLimits?.role === 'Starter' && (selectedTiktokAccounts.length + selectedTwitterAccounts.length > userLimits?.socialAccounts))}
                    className="py-3 px-8 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold transition-colors duration-200 flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-md disabled:shadow-none"
                >
                    {isPostLimitReached ? (
                        <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                            </svg>
                            Post Limit Reached
                        </>
                    ) : isPosting ? (
                       <>
                           <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                           Processing...
                       </>
                   ) : isScheduled ? (
                        'Schedule Post'
                   ) : (
                       'Post Now'
                   )}
                </button>
            </div>

            {/* Success UI: View Post Details Button */}
            {postSuccess && createdPostId && (
                <div className="mt-4 text-center">
                    <Link
                        href={`/created-post/${createdPostId}`}
                        className="inline-block py-3 px-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors duration-200 flex items-center justify-center gap-2 text-base shadow-md mx-auto"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Post Details
                    </Link>
                </div>
            )}
        </>
    );
}

// Keep ProtectedRoute wrapper
export default function MediaPostingPage() {
    return (<ProtectedRoute> <MediaPosting /> </ProtectedRoute>);
}