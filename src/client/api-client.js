// API client with retry logic and rate limiting
import { config } from '../config/index.js';

class ApiClient {
  constructor() {
    this.baseUrl = config.api.baseUrl;
    this.timeout = config.api.timeout;
    this.retries = config.api.retries;
    this.requestQueue = [];
    this.isProcessing = false;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async requestWithRetry(endpoint, options = {}) {
    let lastError;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        lastError = error;

        if (attempt < this.retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

export default ApiClient;
