// Check if we have valid credentials before enabling the button
const hasValidCredentials = selectedAccount && 
                           selectedAccount.accessToken && 
                           selectedAccount.accessTokenSecret;

// Condition for Twitter post button to be enabled
const canPostToTwitter = 
  videoUrl && 
  selectedAccount && 
  selectedAccount.accessToken && 
  selectedAccount.accessTokenSecret;

<button 
  className="post-now-button" 
  onClick={handlePostNow}
  disabled={isPosting || !videoUrl || !hasValidCredentials || !canPostToTwitter}
>
  Post Now
</button> 

// Add this near your Post Now button to debug
console.log('Post button state:', {
  hasVideo: !!videoUrl,
  hasAccount: !!selectedAccount,
  hasAccessToken: selectedAccount ? !!selectedAccount.accessToken : false,
  hasAccessTokenSecret: selectedAccount ? !!selectedAccount.accessTokenSecret : false,
  isButtonDisabled: !videoUrl || !selectedAccount?.accessToken || !selectedAccount?.accessTokenSecret || isPosting
});

const ReviewPost = ({ videoUrl, caption, platforms, connectedAccounts, handlePost, isPosting }) => {
  // Add logic to check if each platform has valid credentials
  const twitterAccount = platforms.includes('twitter') ? 
    connectedAccounts.find(acc => acc.accessToken && acc.accessTokenSecret) : 
    null;
  
  // Check if posting is possible (has video and valid accounts for selected platforms)
  const canPost = videoUrl && 
    ((platforms.includes('twitter') && twitterAccount) || 
     (platforms.includes('tiktok') && tiktokAccount) || 
     // other platforms...
    );
  
  return (
    <div className="review-post-container">
      {/* ...other code... */}
      
      <button 
        className="post-now-button" 
        onClick={handlePost}
        disabled={isPosting || !canPost}
      >
        {isPosting ? 'Posting...' : 'Post Now'}
      </button>
    </div>
  );
}; 