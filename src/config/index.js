// Configuration management
export const config = {
  api: {
    baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
    timeout: parseInt(process.env.API_TIMEOUT) || 5000,
    retries: parseInt(process.env.API_RETRIES) || 3,
  },
  auth: {
    tokenExpiry: process.env.TOKEN_EXPIRY || '24h',
    refreshThreshold: parseInt(process.env.REFRESH_THRESHOLD) || 300,
  },
};
