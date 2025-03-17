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
    const { videoUrl, accessToken, refreshToken, caption } = req.body;
    
    if (!videoUrl || !accessToken) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Forward the request to the backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';
    const apiUrl = `${backendUrl}/tiktok/post-video`;
    
    console.log('[TIKTOK POST] Forwarding request to backend:', apiUrl);
    
    const response = await axiosWithRetry({
      method: 'post',
      url: apiUrl,
      data: {
        videoUrl,
        accessToken,
        refreshToken,
        caption
      },
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 seconds timeout for video posting
    });
    
    console.log('[TIKTOK POST] Backend response status:', response.status);
    
    // Return the response from the backend
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[TIKTOK POST] Error posting video:', error);
    
    // Return appropriate error response
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
    
    return res.status(status).json({ 
      error: 'Error posting video to TikTok', 
      details: errorMessage 
    });
  }
} 