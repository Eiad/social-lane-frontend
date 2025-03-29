export default async function handler(req, res) {
  console.log('[TIKTOK AUTH] Auth request received');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the backend URL from environment variables
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    const authUrl = `${backendUrl}/tiktok/auth`;
    
    console.log('[TIKTOK AUTH] Redirecting to backend auth URL:', authUrl);
    
    // Redirect to the backend auth endpoint
    return res.redirect(authUrl);
  } catch (error) {
    console.error('[TIKTOK AUTH] Error initiating auth:', error);
    
    return res.status(500).json({ 
      error: 'Error initiating TikTok authentication', 
      details: error.message || 'Unknown error' 
    });
  }
} 