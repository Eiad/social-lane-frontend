import axios from 'axios';

export default async function handler(req, res) {
  console.log('[USER TIKTOK ACCOUNT] Request received:', req.method, req.query);
  
  if (req.method === 'DELETE') {
    try {
      const { uid, accountId } = req.query;
      
      if (!uid) {
        console.log('[USER TIKTOK ACCOUNT] Error: Missing user ID in DELETE request');
        return res.status(400).json({ error: 'Missing user ID' });
      }
      
      if (!accountId) {
        console.log('[USER TIKTOK ACCOUNT] Error: Missing TikTok accountId in DELETE request');
        return res.status(400).json({ error: 'Missing TikTok accountId' });
      }
      
      // Forward the delete request to the backend
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';
      const apiUrl = `${backendUrl}/users/${uid}/social/tiktok?openId=${accountId}`;
      
      console.log('[USER TIKTOK ACCOUNT] Forwarding DELETE request to backend:', apiUrl);
      
      const response = await axios({
        method: 'delete',
        url: apiUrl,
        timeout: 15000 // 15 seconds timeout
      });
      
      console.log('[USER TIKTOK ACCOUNT] Backend DELETE response status:', response.status);
      console.log('[USER TIKTOK ACCOUNT] Backend DELETE response success:', response?.data?.success);
      
      // Return the response from the backend
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[USER TIKTOK ACCOUNT] Error deleting account:', error?.message);
      
      if (error?.response) {
        console.error('[USER TIKTOK ACCOUNT] Backend delete error response:', {
          status: error.response?.status,
          data: error.response?.data
        });
      }
      
      // Return appropriate error response
      const status = error.response?.status || 500;
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      
      return res.status(status).json({ 
        error: 'Error deleting TikTok account', 
        details: errorMessage 
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 