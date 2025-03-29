import axios from 'axios';

// Function to retry failed requests
const axiosWithRetry = async (config, maxRetries = 3, baseDelay = 1000) => {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[TIKTOK API] Request attempt ${attempt} of ${maxRetries}`);
      return await axios(config);
    } catch (error) {
      lastError = error;
      console.error(`[TIKTOK API] Attempt ${attempt} failed:`, error.message);
      
      // Check if we should retry
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(1.5, attempt - 1); // Exponential backoff
        console.log(`[TIKTOK API] Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
};

export default async function handler(req, res) {
  console.log('[TIKTOK API] User info request received');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    // Get the refresh token if available
    const refreshToken = req.headers['x-refresh-token'] || '';
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Forward the request to the backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiUrl = `${backendUrl}/tiktok/user-info`;
    
    console.log('[TIKTOK API] Forwarding request to backend:', apiUrl);
    
    const response = await axiosWithRetry({
      method: 'get',
      url: apiUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Refresh-Token': refreshToken
      },
      timeout: 10000 // 10 seconds timeout
    });
    
    console.log('[TIKTOK API] Backend response status:', response.status);
    
    // Return the response from the backend
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[TIKTOK API] Error fetching user info:', error);
    
    // Return appropriate error response
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
    
    return res.status(status).json({ 
      error: 'Error fetching user info', 
      details: errorMessage 
    });
  }
} 