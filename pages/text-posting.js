import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { TikTokSimpleIcon, TwitterIcon } from '../src/components/icons/SocialIcons';
import ProtectedRoute from '../src/components/ProtectedRoute';
import Switch from '../src/components/ui/Switch';
import { getUserLimits, getPostUsage } from '../src/services/userService';

// Enhanced fetch with timeout and retry utility - REMAINS UNCHANGED
const fetchWithTimeoutAndRetry = async (url, options = {}, timeout = 120000, maxRetries = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok && !(response.headers.get('content-type') || '').includes('application/json')) {
                let text = 'Server error'; try { text = await response.text(); } catch (e) { }
                throw new Error(`Server error ${response.status}: ${text.substring(0, 150)}`);
            }
            return response;
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

function TextPosting() {
    // --- State variables ---
    const [textContent, setTextContent] = useState(''); // New state for text content
    const [tiktokAccounts, setTiktokAccounts] = useState([]);
    const [selectedTiktokAccounts, setSelectedTiktokAccounts] = useState([]);
    const [twitterAccounts, setTwitterAccounts] = useState([]);
    const [selectedTwitterAccounts, setSelectedTwitterAccounts] = useState([]);
    const [caption, setCaption] = useState(''); // Caption might still be useful for some platforms or as a title
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledDate, setScheduledDate] = useState(''); // YYYY-MM-DD
    const [scheduledTime, setScheduledTime] = useState(''); // HH:MM (24-hour)
    const [isPosting, setIsPosting] = useState(false);
    const [isScheduling, setIsScheduling] = useState(false);
    const [postSuccess, setPostSuccess] = useState(false);
    const [scheduleSuccess, setScheduleSuccess] = useState(false);
    const [platformResults, setPlatformResults] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [userId, setUserId] = useState('');
    const [userLimits, setUserLimits] = useState(null);
    const [limitsLoading, setLimitsLoading] = useState(true);
    const [limitsError, setLimitsError] = useState(null);
    const [postUsage, setPostUsage] = useState(null);
    const [postUsageLoading, setPostUsageLoading] = useState(true);
    const [postUsageError, setPostUsageError] = useState(null);
    const [accountStatus, setAccountStatus] = useState({ tiktok: {}, twitter: {} });
    const [showLoader, setShowLoader] = useState(false);
    const [createdPostId, setCreatedPostId] = useState(null);
    const [postError, setPostError] = useState('');
    
    // Combined accounts for unified selection (excluding TikTok for text posts)
    const allAccounts = useMemo(() => {
        // Text posts are not supported on TikTok
        // const tiktokWithPlatform = tiktokAccounts?.map(acc => ({ ...acc, platform: 'tiktok' })) || [];
        const twitterWithPlatform = twitterAccounts?.map(acc => ({ ...acc, platform: 'twitter' })) || [];
        return [...twitterWithPlatform]; // Only include Twitter accounts
    }, [twitterAccounts]);

    const filteredAccounts = useMemo(() => {
        if (!searchTerm) return allAccounts;
        return allAccounts.filter(acc =>
            acc?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allAccounts, searchTerm]);

    // --- Format Date Function ---
    const formatDate = (dateString, timeString) => {
        if (!dateString || !timeString) return 'Invalid Date/Time';
        try {
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

    const fetchPostUsage = useCallback(async () => {
        if (!userId) return;
        setPostUsageLoading(true);
        setPostUsageError(null);
        try {
            const usageResponse = await getPostUsage(userId);
            if (usageResponse?.success && usageResponse?.data) {
                setPostUsage(usageResponse.data);
            } else {
                setPostUsageError(usageResponse?.error || 'Failed to load post usage data.');
                setPostUsage(null);
            }
        } catch (error) {
            setPostUsageError('An error occurred while fetching post usage data.');
            setPostUsage(null);
        } finally {
            setPostUsageLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        const firebaseUid = localStorage?.getItem('firebaseUid');
        if (firebaseUid) {
            setUserId(firebaseUid);
            localStorage?.setItem('userId', firebaseUid);
        } else {
            const storedUserId = localStorage?.getItem('userId');
            if (storedUserId) {
                setUserId(storedUserId);
            } else {
                console.error('No user ID found! Cannot function correctly.');
            }
        }
    }, []);

    useEffect(() => {
        const fetchLimits = async () => {
            if (!userId) return;
            setLimitsLoading(true);
            setLimitsError(null);
            try {
                const limitsResponse = await getUserLimits(userId);
                if (limitsResponse?.success && limitsResponse?.data) {
                    setUserLimits(limitsResponse.data);
                } else {
                    setLimitsError(limitsResponse?.error || 'Failed to load usage limits.');
                    setUserLimits(null);
                }
            } catch (error) {
                setLimitsError('An error occurred while fetching usage limits.');
                setUserLimits(null);
            } finally {
                setLimitsLoading(false);
            }
        };
        fetchLimits();
    }, [userId]);

    useEffect(() => {
        fetchPostUsage();
    }, [fetchPostUsage]);

    const fetchSocialMediaAccounts = useCallback(async () => {
        if (!userId) return false;
        try {
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
                }
                // No TikTok for text posts
                // const tiktokData = userData.data.providerData.tiktok;
                // if (tiktokData) { ... }
                localStorage.setItem('socialMediaData', JSON.stringify(socialMediaData));
                if (accountsFoundInDb) localStorage.setItem('socialMediaDataUpdated', Date.now().toString());
                return accountsFoundInDb;
            } else { return false; }
        } catch (error) { console.error('Error fetching/processing social media accounts:', error); return false; }
    }, [userId]);

    const loadAccountsFromStorage = useCallback(() => {
        let twitterLoaded = false;
        try {
            const str = localStorage?.getItem('socialMediaData');
            if (str) {
                const data = JSON.parse(str);
                if (data.twitter) { setTwitterAccounts(data.twitter); twitterLoaded = true; }
                // No TikTok for text posts
            }
        } catch (e) { console.error('Failed to load accounts from localStorage:', e); }
        return twitterLoaded; // Only twitter matters here
    }, []);

    useEffect(() => {
        const loadAllAccounts = async () => {
            const loadedFromStorage = loadAccountsFromStorage();
            if (!loadedFromStorage || Date.now() - parseInt(localStorage?.getItem('socialMediaDataUpdated') || '0') > 300000) { // 5 mins
                await fetchSocialMediaAccounts();
            }
        };
        if (userId) loadAllAccounts();
    }, [userId, loadAccountsFromStorage, fetchSocialMediaAccounts]);
    
    // --- Account selection handlers (TikTok removed) ---
    const handleTwitterAccountToggle = (account) => {
        setSelectedTwitterAccounts(prev =>
            prev.find(a => a.userId === account.userId)
                ? prev.filter(a => a.userId !== account.userId)
                : [...prev, account]
        );
    };

    const handleAccountToggle = (account) => {
        if (account.platform === 'twitter') {
            handleTwitterAccountToggle(account);
        }
        // No TikTok for text posts
    };

    const resetForNewPost = () => {
        setTextContent('');
        setSelectedTwitterAccounts([]);
        // No TikTok for text posts setSelectedTiktokAccounts([]);
        setIsScheduled(false);
        setScheduledDate('');
        setScheduledTime('');
        setPostSuccess(false);
        setScheduleSuccess(false);
        setPlatformResults({});
        setPostError('');
        setCreatedPostId(null);
        setShowLoader(false);
        // Fetch updated post usage
        fetchPostUsage();
    };

    const getScheduledDateTime = () => {
        if (!isScheduled || !scheduledDate || !scheduledTime) {
            return null;
        }
        try {
            const [year, month, day] = scheduledDate.split('-').map(Number);
            const [hours, minutes] = scheduledTime.split(':').map(Number);
            // Validate date and time components
            if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
                 throw new Error('Invalid date or time components');
            }
            // Create date in local timezone, then convert to UTC for backend
            const localDate = new Date(year, month - 1, day, hours, minutes);
            if (isNaN(localDate.getTime())) {
                throw new Error('Invalid date object created from components');
            }
            if (localDate < new Date()) {
                throw new Error('Scheduled time must be in the future.');
            }
            return localDate;
        } catch (error) {
            console.error("Error creating scheduled date object:", error);
            setPostError(error.message || 'Invalid scheduled date or time.');
            return null;
        }
    };
    
    const handlePost = async () => {
        if (isPosting) return;

        if (!textContent.trim()) {
            setPostError('Please enter some text to post.');
            return;
        }
        
        const hasSelectedTwitter = selectedTwitterAccounts.length > 0;
        
        if (!hasSelectedTwitter) { // Only check Twitter
            setPostError('Please select at least one Twitter account to post to.');
            return;
        }

        if (isScheduled) {
            try {
                const scheduledAtLocal = getScheduledDateTime();
                if (!scheduledAtLocal) {
                    // Error is set by getScheduledDateTime
                    return;
                }
            } catch (error) {
                setPostError(error.message || 'Invalid scheduling date/time');
                return;
            }
        }
        
        setIsPosting(true);
        setIsScheduling(isScheduled);
        setShowLoader(true);
        setPlatformResults([]);
        setPostError('');
        setCreatedPostId(null);

        let scheduledAtISO = null;
        if (isScheduled) {
            const scheduledAtLocal = getScheduledDateTime();
            if (scheduledAtLocal) {
                scheduledAtISO = scheduledAtLocal.toISOString();
            } else {
                setIsPosting(false);
                setIsScheduling(false);
                setShowLoader(false);
                // Error already set by getScheduledDateTime
                return;
            }
        }
        
        const payload = {
            userId,
            postType: 'text', // Set postType to text
            textContent: textContent.trim(), // Send text content
            post_description: '', // Optional: use caption as description or title
            platforms: [],
            isScheduled: !!isScheduled,
            scheduledDate: scheduledAtISO,
            twitter_accounts: selectedTwitterAccounts.map(acc => ({ 
                userId: acc.userId, 
                username: acc.username 
            })),
            // No TikTok accounts
        };

        if (hasSelectedTwitter) payload.platforms.push('twitter');

        console.log('Posting text with payload:', payload);

        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sociallane-backend.mindio.chat';
            const fullApiUrl = `${backendUrl}/posts`;
            
            const response = await fetchWithTimeoutAndRetry(fullApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Post API error:', data);
                throw new Error(data.error || `Failed to ${isScheduled ? 'schedule' : 'post'}. Status: ${response.status}`);
            }
            
            console.log('Post API success:', data);
            if (data.success && data.post && data.post._id) {
                 setCreatedPostId(data.post._id); // Store the created post ID
            } else if (data.success && data.postId) { // Handle case where ID is returned as postId
                 setCreatedPostId(data.postId);
            }


            if (isScheduled) {
                setScheduleSuccess(true);
                setPostSuccess(false); // Ensure postSuccess is false if only scheduled
            } else {
                setPostSuccess(true);
                setScheduleSuccess(false); // Ensure scheduleSuccess is false if posted directly
                 // For direct posts, platform results might be available immediately if backend processes synchronously
                if (data.results) { // Or whatever the backend calls it
                    setPlatformResults(data.results);
                }
            }
             // Fetch updated post usage after successful post/schedule
            await fetchPostUsage();

        } catch (error) {
            console.error('Error during post/schedule:', error);
            setPostError(error.message || 'An unexpected error occurred.');
            setPostSuccess(false);
            setScheduleSuccess(false);
        } finally {
            setIsPosting(false);
            setIsScheduling(false);
            // setShowLoader(false); // Loader will be hidden by PostingLoader component
        }
    };
    
    const PostingLoader = ({ 
        show, 
        isPosting, 
        isScheduling, 
        scheduleSuccess, 
        postSuccess, 
        platformResults, 
        createdPostId, 
        postError, // Explicitly listed
        onClose 
    }) => {
        if (!show) return null;

        const getTitle = () => {
            if (isPosting || isScheduling) return isScheduling ? 'Scheduling Your Post...' : 'Posting Your Content...';
            if (scheduleSuccess) return 'Post Scheduled Successfully!';
            if (postSuccess) return 'Post Sent Successfully!';
            return 'Processing...'; // Fallback title
        };
    
        const getMessage = () => {
            if (isPosting) return 'Please wait while we send your text post.';
            if (isScheduling) return 'Hold on, we\'re scheduling your text post.';
            if (scheduleSuccess) return 'Your text post has been scheduled. You can view it in your scheduled posts.';
            if (postSuccess) return 'Your text post has been sent! Check the results below.';
            return 'Please wait.';
        };

        const isLoading = isPosting || isScheduling;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out">
                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 ease-in-out scale-100">
                    <h3 className="text-xl sm:text-2xl font-semibold text-center text-slate-800 dark:text-slate-100 mb-4 sm:mb-6">
                        {getTitle()}
                    </h3>
                    
                    {isLoading && (
                        <div className="flex justify-center items-center my-6 sm:my-8">
                            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-t-4 border-b-4 border-blue-600 dark:border-blue-500"></div>
                        </div>
                    )}
                    
                    <p className="text-sm sm:text-base text-center text-slate-600 dark:text-slate-300 mb-6 sm:mb-8">
                        {getMessage()}
                    </p>

                    {(!isLoading && (postSuccess || scheduleSuccess)) && (
                        <div className="mt-4 space-y-3">
                             {createdPostId && (
                                <Link href={`/created-post/${createdPostId}`} legacyBehavior>
                                    <a className="block w-full text-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors duration-150">
                                        View Post Details
                                    </a>
                                </Link>
                            )}
                            <button
                                onClick={resetForNewPost}
                                className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium transition-colors duration-150"
                            >
                                Create Another Post
                            </button>
                            <button
                                onClick={() => { setShowLoader(false); if (onClose) onClose(); }}
                                className="w-full px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 font-medium transition-colors duration-150"
                            >
                                Close
                            </button>
                        </div>
                    )}
                     {(!isLoading && !(postSuccess || scheduleSuccess) && postError) && (
                        <div className="mt-4 space-y-3">
                            <p className="text-center text-red-500 dark:text-red-400">{postError}</p>
                            <button
                                onClick={() => { setShowLoader(false); if (onClose) onClose(); }}
                                className="w-full px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 font-medium transition-colors duration-150"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };
    
    const AccountStatusIndicator = ({ status }) => {
        // ... (Keep this component as is, or simplify if not needed for text posts)
        return null; // Simplified for now
    };

    const isPostLimitReached = useMemo(() => {
        if (!postUsage || !userLimits) return false;
        if (userLimits.planType === 'Starter') {
             return postUsage.postsRemaining !== -1 && postUsage.postsRemaining <= 0 && !postUsage.needsCycleReset;
        }
        return false; // No limit for paid plans, or handled by backend
    }, [postUsage, userLimits]);

    const postLimitMessage = useMemo(() => {
        if (!isPostLimitReached || !postUsage) return '';
        return `You have reached the maximum of ${postUsage.limit} posts for the free Starter plan this cycle. Your limit resets on ${new Date(postUsage.nextResetDate).toLocaleDateString()}. Please upgrade for unlimited posts.`;
    }, [isPostLimitReached, postUsage]);

    const isPageDisabledByLimit = isPostLimitReached && !(postSuccess || scheduleSuccess);


    // --- JSX Structure ---
    return (
        <ProtectedRoute>
            <Head>
                <title>Create Text Post | Social Lane</title>
                <meta name="description" content="Create and schedule text-only posts to your social media accounts." />
            </Head>

            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-[1400px] mx-auto">
                    {/* Header */}
                    <div className="mb-8 text-center sm:text-left">
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                            Create Text Post
                        </h1>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Write and share your thoughts directly. Text posts are great for updates, announcements, or engaging questions.
                        </p>
                    </div>
                    
                    {/* Post Limit Reached Banner */}
                     {isPageDisabledByLimit && (
                        <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-400 p-4 mt-3 mb-6 rounded-md shadow-md" role="alert">
                            <div className="flex items-center">
                                <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 00.293.707l3 3a1 1 0 001.414-1.414L11 10.586V5z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="font-bold">Monthly Post Limit Reached</p>
                                    <p className="text-sm">{postLimitMessage}</p>
                                    <Link href="/subscription" legacyBehavior>
                                        <a className="text-sm font-medium text-primary hover:text-primary-dark underline mt-1 inline-block">
                                            Upgrade Plan
                                        </a>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}


                    {/* Main Content Area - Two Columns */}
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Left Column (35%) */}
                        <div className="lg:w-[35%] flex-shrink-0 space-y-6">
                            {/* Platform Selection Card - MOVED HERE */}
                             <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg">
                                <div className="p-6">
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Select Accounts</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Text posts are currently supported on Twitter/X.</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">TikTok does not support text-only posts via API.</p>
                                    
                                    <input
                                        type="search"
                                        placeholder="Search accounts..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full p-2.5 mb-4 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-50 placeholder-slate-400 dark:placeholder-slate-500 text-sm"
                                        disabled={isPageDisabledByLimit || postSuccess || scheduleSuccess || isPosting || isScheduling}
                                    />

                                    <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                                        {filteredAccounts.length === 0 && !limitsLoading && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                No Twitter accounts found or connected. Please <Link href="/settings?tab=accounts" legacyBehavior><a className="text-blue-500 hover:underline">connect one</a></Link>.
                                            </p>
                                        )}
                                        {filteredAccounts.map(account => {
                                            const isSelected = selectedTwitterAccounts.find(a => a.userId === account.userId);
                                            return (
                                                <div 
                                                    key={account.userId} 
                                                    className={`flex items-center p-3 rounded-lg border transition-all duration-150 ease-in-out cursor-pointer
                                                        ${isSelected
                                                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-700 ring-1 ring-blue-500' 
                                                            : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'}
                                                        ${isPageDisabledByLimit || postSuccess || scheduleSuccess || isPosting || isScheduling ? 'opacity-60 cursor-not-allowed' : ''}
                                                    `}
                                                    onClick={() => !(isPageDisabledByLimit || postSuccess || scheduleSuccess || isPosting || isScheduling) && handleAccountToggle(account)}
                                                >
                                                    <div className="flex-shrink-0 mr-3">
                                                        {account.profileImageUrl ? (
                                                            <img src={account.profileImageUrl} alt={account.username} className="w-10 h-10 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300 text-lg font-medium">
                                                                {account.username ? account.username.charAt(0).toUpperCase() : 'T'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-grow">
                                                        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                                                            {account.displayName || account.name || account.username}
                                                        </span>
                                                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                                                            @{account.username} {account.platform === 'twitter' && <TwitterIcon className="w-4 h-4 inline-block ml-1" />}
                                                        </span>
                                                    </div>
                                                    {isSelected && (
                                                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column (65%) */}
                        <div className="lg:w-[65%] space-y-6">
                            {/* Text Content Area Card - MOVED HERE */}
                            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg overflow-hidden">
                                <div className="p-6">
                                    <label htmlFor="textContent" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                                        Your Text Post
                                    </label>
                                    <textarea
                                        id="textContent"
                                        name="textContent"
                                        rows={8}
                                        className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-50 placeholder-slate-400 dark:placeholder-slate-500 transition duration-150 ease-in-out resize-none"
                                        placeholder="What&apos;s on your mind? Type your text post here..."
                                        value={textContent}
                                        onChange={(e) => setTextContent(e.target.value)}
                                        disabled={isPageDisabledByLimit || isPosting || isScheduling || postSuccess || scheduleSuccess}
                                    />
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        Character limits may apply depending on the platform (e.g., Twitter/X).
                                    </p>
                                </div>
                            </div>

                            {/* Scheduling Options Card - MOVED HERE */}
                            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg">
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Schedule Post</h3>
                                        <Switch
                                            checked={isScheduled}
                                            onChange={setIsScheduled}
                                            disabled={isPageDisabledByLimit || postSuccess || scheduleSuccess || isPosting || isScheduling}
                                        />
                                    </div>
                                    {isScheduled && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <label htmlFor="scheduledDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                                                <input
                                                    type="date"
                                                    id="scheduledDate"
                                                    value={scheduledDate}
                                                    onChange={(e) => setScheduledDate(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-50 text-sm"
                                                    min={new Date().toISOString().split('T')[0]}
                                                    disabled={isPageDisabledByLimit || postSuccess || scheduleSuccess || isPosting || isScheduling}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="scheduledTime" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time</label>
                                                <input
                                                    type="time"
                                                    id="scheduledTime"
                                                    value={scheduledTime}
                                                    onChange={(e) => setScheduledTime(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-50 text-sm"
                                                    disabled={isPageDisabledByLimit || postSuccess || scheduleSuccess || isPosting || isScheduling}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons Card - MOVED HERE */}
                            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg">
                                <div className="p-6">
                                    {postError && (
                                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm transition-all animate-shake">
                                            {postError}
                                        </div>
                                    )}
                                    
                                    {(postSuccess || scheduleSuccess) ? (
                                        <div className="space-y-3">
                                            <button
                                                onClick={resetForNewPost}
                                                className="w-full flex items-center justify-center px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium transition-colors duration-150"
                                            >
                                                 <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                </svg>
                                                Create Another Text Post
                                            </button>
                                            {createdPostId && (
                                                <Link href={`/created-post/${createdPostId}`} legacyBehavior>
                                                    <a className="w-full flex items-center justify-center px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors duration-150">
                                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                        View Post Details
                                                    </a>
                                                </Link>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handlePost}
                                            disabled={isPageDisabledByLimit || isPosting || isScheduling || !textContent.trim() || selectedTwitterAccounts.length === 0}
                                            className="w-full flex items-center justify-center px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {isPosting ? (
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : isScheduled ? (
                                                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                </svg>
                                            )}
                                            {isScheduling ? 'Scheduling Post...' : isPosting ? 'Posting Now...' : isScheduled ? 'Schedule Text Post' : 'Post Text Now'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <PostingLoader
                show={showLoader}
                isPosting={isPosting}
                isScheduling={isScheduling}
                scheduleSuccess={scheduleSuccess}
                postSuccess={postSuccess}
                platformResults={platformResults}
                createdPostId={createdPostId}
                postError={postError}
                onClose={() => {
                    setShowLoader(false);
                    // If there was an error, don't reset, let user correct.
                    // If success, resetForNewPost is handled by its own button.
                }}
            />
        </ProtectedRoute>
    );
}

export default function TextPostingPage() {
    return <TextPosting />;
} 