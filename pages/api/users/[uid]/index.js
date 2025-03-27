import axios from 'axios';

// Simple in-memory cache with TTL
const userDataCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

export default async function handler(req, res) {
  console.log('[USER API] Request received:', req.method);
  
  if (req.method === 'GET') {
    try {
      const { uid } = req.query;
      
      if (!uid) {
        console.log('[USER API] Error: Missing user ID');
        return res.status(400).json({ error: 'Missing user ID' });
      }

      // Check if we have a valid cache entry
      const now = Date.now();
      const cacheKey = `user-${uid}`;
      const cachedData = userDataCache.get(cacheKey);
      
      if (cachedData && (now - cachedData.timestamp < CACHE_TTL)) {
        console.log(`[USER API] Using cached data for user ${uid}, age: ${(now - cachedData.timestamp)/1000}s`);
        return res.status(200).json(cachedData.data);
      }
      
      // Get backend URL from environment or use default
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';
      const backendEndpoint = `${apiBaseUrl}/users/${uid}`;
      
      console.log(`[USER API] Fetching user data from backend: ${backendEndpoint}`);
      
      // Use retry logic with exponential backoff
      let response;
      let lastError;
      const MAX_RETRIES = 3;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[USER API] Attempt ${attempt}/${MAX_RETRIES} to fetch user data`);
          
          response = await axios({
            method: 'get',
            url: backendEndpoint,
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000 * attempt // Increase timeout with each retry
          });
          
          // If successful, break out of retry loop
          break;
        } catch (error) {
          lastError = error;
          console.error(`[USER API] Attempt ${attempt} failed:`, error?.message || error);
          
          // If we've exhausted all retries, throw the error to be caught by the outer catch
          if (attempt === MAX_RETRIES) {
            throw error;
          }
          
          // Otherwise, wait with exponential backoff before retrying
          const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s, etc.
          console.log(`[USER API] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      console.log('[USER API] Backend response status:', response.status);
      console.log('[USER API] Backend response success:', response?.data?.success);
      
      // Cache successful responses
      if (response.data && response.data.success) {
        userDataCache.set(cacheKey, {
          timestamp: now,
          data: response.data
        });
        console.log(`[USER API] Cached user data for ${uid}`);
      }
      
      // Return the response from the backend
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[USER API] Error:', error?.response?.data || error?.message);
      
      const { uid } = req.query;
      
      // Try to use stale cache in case of error
      const cacheKey = `user-${uid}`;
      const cachedData = userDataCache.get(cacheKey);
      
      if (cachedData) {
        console.log(`[USER API] Using stale cached data for user ${uid} due to fetch error`);
        
        // Mark the response as from cache
        const cachedResponse = {
          ...cachedData.data,
          fromCache: true,
          cacheTimestamp: cachedData.timestamp
        };
        
        return res.status(200).json(cachedResponse);
      }
      
      // Enhanced error logging
      if (error.response) {
        console.error('[USER API] Error response details:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        console.error('[USER API] Error request details:', {
          method: error.request.method,
          path: error.request.path,
          headers: error.request.headers,
          message: error.message
        });
      } else {
        console.error('[USER API] Error details:', error);
      }
      
      // Return error details
      const statusCode = error?.response?.status || 500;
      const errorMessage = error?.response?.data?.error || error?.message || 'An unknown error occurred';
      
      return res.status(statusCode).json({ 
        success: false, 
        error: errorMessage 
      });
    }
  } else {
    // Method not allowed
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ 
      success: false, 
      error: `Method ${req.method} Not Allowed` 
    });
  }
} 