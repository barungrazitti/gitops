/**
 * Error Handler - Consistent API error handling for providers
 */

class ErrorHandler {
  /**
   * Handle API errors consistently across providers
   */
  handleError(error, providerName) {
    // Log the original error for debugging
    console.warn(`Original error from ${providerName}:`, error);

    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      const message =
        error.response.data?.error?.message || error.response.statusText;

      switch (status) {
      case 401:
        throw new Error(
          `Authentication failed for ${providerName}. Please check your API key.`
        );
      case 403:
        throw new Error(
          `Access forbidden for ${providerName}. Please check your permissions.`
        );
      case 429:
        throw new Error(
          `Rate limit exceeded for ${providerName}. Please try again later.`
        );
      case 500:
      case 502:
      case 503:
      case 504:
        throw new Error(
          `${providerName} service is temporarily unavailable. Please try again later.`
        );
      default:
        throw new Error(`${providerName} API error (${status}): ${message}`);
      }
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot connect to ${providerName}. Please check your internet connection.`
      );
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error(
        `Request to ${providerName} timed out. Please try again.`
      );
    } else {
      // Handle undefined error message safely
      const errorMessage = error?.message || 'Unknown error occurred';
      throw new Error(`${providerName} error: ${errorMessage}`);
    }
  }
}

module.exports = new ErrorHandler();
