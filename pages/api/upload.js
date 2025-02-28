import fs from 'fs';
import path from 'path';
import { IncomingForm } from 'formidable';

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
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    console.log('[UPLOAD API] Uploads directory path:', uploadsDir);
    
    if (!fs.existsSync(uploadsDir)) {
      console.log('[UPLOAD API] Creating uploads directory');
      fs.mkdirSync(uploadsDir, { recursive: true });
    } else {
      console.log('[UPLOAD API] Uploads directory already exists');
    }

    // Parse the incoming form data
    console.log('[UPLOAD API] Initializing form parser');
    const form = new IncomingForm({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 500 * 1024 * 1024, // 500MB max file size
      multiples: false, // Only allow one file upload at a time
    });

    return new Promise((resolve, reject) => {
      console.log('[UPLOAD API] Starting form parsing');
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('[UPLOAD API] Error parsing form:', err);
          res.status(500).json({ error: 'Error uploading file', details: err.message });
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
          const finalPath = path.join(uploadsDir, newFilename);
          
          console.log('[UPLOAD API] Renaming file', { 
            originalFilename,
            newFilename,
            finalPath
          });

          // Rename the file
          fs.renameSync(file?.filepath || file?.path, finalPath);
          console.log('[UPLOAD API] File renamed successfully');

          // Generate the public URL
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sociallane-frontend.mindio.chat';
          const fileUrl = `${baseUrl}/uploads/${newFilename}`;
          console.log('[UPLOAD API] Generated public URL:', fileUrl);

          console.log('[UPLOAD API] Upload completed successfully');
          res.status(200).json({ 
            success: true, 
            url: fileUrl,
            filename: newFilename
          });
          return resolve();
        } catch (error) {
          console.error('[UPLOAD API] Error handling file:', error);
          res.status(500).json({ error: 'Error processing uploaded file', details: error.message });
          return resolve();
        }
      });
    });
  } catch (error) {
    console.error('[UPLOAD API] Server error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
} 