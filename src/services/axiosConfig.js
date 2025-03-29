import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Create a custom axios instance
const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important for CORS with credentials
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
axiosInstance.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method.toUpperCase()} request to: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response error:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default axiosInstance; 