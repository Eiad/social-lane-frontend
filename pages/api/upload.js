import fs from 'fs';
import path from 'path';
import { IncomingForm } from 'formidable';
import axios from 'axios';
import FormData from 'form-data';

// Disable the default body parser to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  console.log('[UPLOAD API] Request received', { method: req.method });
  
  if (req.method !== 'POST') {
    console.log('[UPLOAD API] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    console.log('[UPLOAD API] Temp directory path:', tempDir);
    
    if (!fs.existsSync(tempDir)) {
      console.log('[UPLOAD API] Creating temp directory');
      fs.mkdirSync(tempDir, { recursive: true });
    } else {
      console.log('[UPLOAD API] Temp directory already exists');
    }

    // Parse the incoming form data
    console.log('[UPLOAD API] Initializing form parser');
    const form = new IncomingForm({
      uploadDir: tempDir,
      keepExtensions: true,
      maxFileSize: 500 * 1024 * 1024, // 500MB max file size
      multiples: false, // Only allow one file upload at a time
    });

    return new Promise((resolve, reject) => {
      console.log('[UPLOAD API] Starting form parsing');
      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.error('[UPLOAD API] Error parsing form:', err);
          res.status(500).json({ error: 'Error uploading file', details: err?.message });
          return resolve();
        }

        console.log('[UPLOAD API] Form parsed successfully', { 
          fieldsReceived: Object.keys(fields || {}),
          filesReceived: Object.keys(files || {})
        });

        try {
          // In formidable v4, files is an object with field names as keys
          // Each field contains an array of file objects
          const file = files?.file?.[0] || Object.values(files || {})?.[0]?.[0];
          
          console.log('[UPLOAD API] File object:', file ? {
            originalName: file?.originalFilename || file?.originalName,
            size: file?.size,
            filepath: file?.filepath || file?.path,
            mimetype: file?.mimetype
          } : 'No file found');
          
          if (!file) {
            console.error('[UPLOAD API] No file uploaded');
            res.status(400).json({ error: 'No file uploaded' });
            return resolve();
          }

          // Generate a unique filename
          const timestamp = Date.now();
          const originalFilename = file?.originalFilename || file?.originalName || 'video.mp4';
          const fileExtension = path.extname(originalFilename);
          const newFilename = `video-${timestamp}${fileExtension}`;
          const tempFilePath = file?.filepath || file?.path;
          
          console.log('[UPLOAD API] Processing file', { 
            originalFilename,
            newFilename,
            tempFilePath
          });

          // Upload to R2 via backend API
          console.log('[UPLOAD API] Uploading to R2 via backend');
          const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';
          const uploadUrl = `${backendUrl}/upload`;
          
          // Create a Node.js compatible FormData
          const formData = new FormData();
          // Append the file directly from the file path
          formData.append('file', fs.createReadStream(tempFilePath), {
            filename: newFilename,
            contentType: file.mimetype || 'video/mp4'
          });
          
          const uploadResponse = await axios.post(uploadUrl, formData, {
            headers: {
              ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          });
          
          console.log('[UPLOAD API] R2 upload response:', uploadResponse?.data);
          
          // Clean up the temp file
          try {
            fs.unlinkSync(tempFilePath);
            console.log('[UPLOAD API] Temp file deleted');
          } catch (cleanupError) {
            console.error('[UPLOAD API] Error cleaning up temp file:', cleanupError);
          }
          
          if (uploadResponse?.data?.success && uploadResponse?.data?.url) {
            console.log('[UPLOAD API] Upload completed successfully');
            res.status(200).json({ 
              success: true, 
              url: uploadResponse.data.url,
              filename: newFilename
            });
          } else {
            throw new Error('Failed to upload to R2: ' + (uploadResponse?.data?.error || 'Unknown error'));
          }
          
          return resolve();
        } catch (error) {
          console.error('[UPLOAD API] Error handling file:', error);
          res.status(500).json({ error: 'Error processing uploaded file', details: error?.message });
          return resolve();
        }
      });
    });
  } catch (error) {
    console.error('[UPLOAD API] Server error:', error);
    res.status(500).json({ error: 'Server error', details: error?.message });
  }
} 