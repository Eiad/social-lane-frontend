import axios from 'axios';

export default async function handler(req, res) {
  console.log('[USER API] Request received:', req.method);
  
  if (req.method === 'GET') {
    try {
      const { uid } = req.query;
      
      if (!uid) {
        console.log('[USER API] Error: Missing user ID');
        return res.status(400).json({ error: 'Missing user ID' });
      }

      // Get backend URL from environment or use default
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';
      const backendEndpoint = `${apiBaseUrl}/users/${uid}`;
      
      console.log(`[USER API] Fetching user data from backend: ${backendEndpoint}`);
      
      const response = await axios({
        method: 'get',
        url: backendEndpoint,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 seconds timeout
      });
      
      console.log('[USER API] Backend response status:', response.status);
      console.log('[USER API] Backend response success:', response?.data?.success);
      
      // Return the response from the backend
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[USER API] Error:', error?.response?.data || error?.message);
      
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