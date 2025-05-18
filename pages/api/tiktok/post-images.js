import axios from 'axios';

// Function to retry failed requests
const axiosWithRetry = async (config, maxRetries = 3, baseDelay = 1000) => {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[TIKTOK POST IMAGES] Request attempt ${attempt} of ${maxRetries}`);
      return await axios(config);
    } catch (error) {
      lastError = error;
      console.error(`[TIKTOK POST IMAGES] Attempt ${attempt} failed:`, error.message);
      
      // Check if we should retry
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(1.5, attempt - 1); // Exponential backoff
        console.log(`[TIKTOK POST IMAGES] Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
};

export default async function handler(req, res) {
  console.log('[TIKTOK POST IMAGES] Post images request received');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrls, accessToken, refreshToken, caption, userId, accountId } = req.body;
    
    if (!imageUrls || (Array.isArray(imageUrls) && imageUrls.length === 0)) {
      return res.status(400).json({ error: 'Missing image URLs' });
    }

    // Prepare the data to send to backend
    const postData = {
      imageUrls,
      caption
    };
    
    // Send userId if available (preferred method)
    if (userId) {
      postData.userId = userId;
      console.log('[TIKTOK POST IMAGES] Using userId for authentication:', userId);
      
      // Also send accountId if available for specific account selection
      if (accountId) {
        postData.accountId = accountId;
        console.log('[TIKTOK POST IMAGES] Including accountId:', accountId);
      }
    } 
    // Fallback to direct tokens if provided (legacy method)
    else if (accessToken && refreshToken) {
      postData.accessToken = accessToken;
      postData.refreshToken = refreshToken;
      console.log('[TIKTOK POST IMAGES] Using direct token authentication (legacy method)');
    }
    else {
      return res.status(400).json({ error: 'Authentication required. Please provide either userId or tokens.' });
    }

    // Forward the request to the backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';
    const apiUrl = `${backendUrl}/tiktok/post-images`;
    
    console.log('[TIKTOK POST IMAGES] Forwarding request to backend:', apiUrl);
    console.log(`[TIKTOK POST IMAGES] Request payload:`, JSON.stringify({
      imageUrls: Array.isArray(imageUrls) ? `[${imageUrls.length} URLs]` : '1 URL',
      caption,
      userId,
      accountId
    }));

    // Make request with longer timeout
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });

    // Process response differently based on status
    if (response.ok) {
      const data = await response.json();
      console.log('[TIKTOK POST IMAGES] Backend returned success with data:', {
        message: data.message || 'Images posted successfully',
        status: response.status
      });
      
      return res.status(200).json({
        success: true,
        message: data.message || 'Images posted successfully',
        publishId: data.publishId,
        contentId: data.contentId
      });
    } else {
      // Handle error response
      let errorMessage = '';
      let requiresReconnect = false;
      let errorCode = '';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || `Error ${response.status}`;
        requiresReconnect = errorData.requiresReconnect || false;
        errorCode = errorData.code || '';
        
        if (requiresReconnect) {
          console.log('[TIKTOK POST IMAGES] TikTok account requires reconnection');
        }
        
        // Handle specific errors with more helpful messages
        if (errorMessage.includes('media_type') || errorMessage.includes('post_mode') || errorCode === 'INVALID_MEDIA_FORMAT') {
          console.log('[TIKTOK POST IMAGES] Invalid media format or post mode error');
          errorMessage = "TikTok couldn't process this image. This may be due to:";
          errorMessage += "\n- Image format not supported by TikTok (try JPG/PNG)";
          errorMessage += "\n- Image resolution or size issues";
          errorMessage += "\n- Missing permissions for image posting";
          errorCode = 'INVALID_MEDIA_FORMAT';
        }
      } catch (jsonError) {
        try {
          const text = await response.text();
          errorMessage = text.substring(0, 200); // First 200 chars for readability
        } catch (textError) {
          errorMessage = `Server error (${response.status}) - unable to read error details`;
        }
      }
      
      console.log('[TIKTOK POST IMAGES] Backend returned error:', {
        status: response.status,
        message: errorMessage,
        requiresReconnect
      });
      
      // Create descriptive user-facing error message
      let userMessage = errorMessage;
      if (requiresReconnect) {
        userMessage = 'Your TikTok account needs to be reconnected. Please go to the account settings page.';
      } else if (response.status === 429) {
        userMessage = 'Too many requests to TikTok API. Please try again later.';
      }
      
      return res.status(response.status).json({
        success: false,
        error: userMessage,
        requiresReconnect,
        code: errorCode
      });
    }
  } catch (error) {
    console.log('[TIKTOK POST IMAGES] Error posting images:', error);
    
    // Network errors or unexpected issues
    return res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred',
      userMessage: 'We couldn\'t reach the server. Please check your connection and try again.'
    });
  }
} 