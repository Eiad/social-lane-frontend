import axios from 'axios';

// Function to retry failed requests
const axiosWithRetry = async (config, maxRetries = 3, baseDelay = 1000) => {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[TIKTOK POST] Request attempt ${attempt} of ${maxRetries}`);
      return await axios(config);
    } catch (error) {
      lastError = error;
      console.error(`[TIKTOK POST] Attempt ${attempt} failed:`, error.message);
      
      // Check if we should retry
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(1.5, attempt - 1); // Exponential backoff
        console.log(`[TIKTOK POST] Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
};

export default async function handler(req, res) {
  console.log('[TIKTOK POST] Post video request received');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoUrl, accessToken, refreshToken, caption, userId, accountId } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'Missing video URL' });
    }

    // Prepare the data to send to backend
    const postData = {
      videoUrl,
      caption
    };
    
    // Send userId if available (preferred method)
    if (userId) {
      postData.userId = userId;
      console.log('[TIKTOK POST] Using userId for authentication:', userId);
      
      // Also send accountId if available for specific account selection
      if (accountId) {
        postData.accountId = accountId;
      }
    } 
    // Fallback to direct tokens if provided (legacy method)
    else if (accessToken && refreshToken) {
      postData.accessToken = accessToken;
      postData.refreshToken = refreshToken;
      console.log('[TIKTOK POST] Using direct token authentication (legacy method)');
    }
    else {
      return res.status(400).json({ error: 'Authentication required. Please provide either userId or tokens.' });
    }

    // Forward the request to the backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiUrl = `${backendUrl}/tiktok/post-video`;
    
    console.log('[TIKTOK POST] Forwarding request to backend:', apiUrl);

    // Function that wraps fetch with a timeout
    const fetchWithTimeout = async (url, options, timeout = 300000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };

    // Make request with longer timeout and better error handling
    const response = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      },
      300000 // 5 minute timeout
    );

    // Process response differently based on status and content type
    if (response.ok) {
      // Check for JSON response
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        console.log('[TIKTOK POST] Backend returned success with data:', {
          message: data.message || 'Video posted successfully',
          status: response.status
        });
        
        return res.status(200).json({
          success: true,
          message: data.message || 'Video posted successfully',
          ...data
        });
      } else {
        // Handle non-JSON success response
        const text = await response.text();
        console.log('[TIKTOK POST] Backend returned non-JSON success response');
        
        return res.status(200).json({
          success: true,
          message: 'Video posted successfully',
          rawResponse: text.substring(0, 100) + '...' // Only include beginning of response
        });
      }
    } else {
      // Error handling
      let errorData;
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json();
        } else {
          const text = await response.text();
          errorData = { error: `Server error: ${response.status}`, details: text.substring(0, 200) + '...' };
        }
      } catch (parseError) {
        errorData = { error: `Error parsing response: ${parseError.message}` };
      }
      
      console.log('[TIKTOK POST] Backend returned error:', {
        status: response.status,
        error: errorData.error || 'Unknown error'
      });
      
      return res.status(response.status).json({
        success: false,
        error: errorData.error || `Server returned ${response.status}`,
        details: errorData.details || errorData.message || 'No additional details'
      });
    }
  } catch (error) {
    console.log('[TIKTOK POST] Error posting video:', error);
    
    // Special handling for timeout errors
    if (error.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        error: 'The request timed out. The video may still be processing on TikTok.',
        details: 'TikTok processing can take some time. Check your TikTok account to confirm if the post was published.'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred',
      details: error.stack ? error.stack.split('\n')[0] : 'No additional details'
    });
  }
} 