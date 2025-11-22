import { defineBoot } from '#q-app/wrappers';
import axios, { type AxiosInstance } from 'axios';

declare module 'vue' {
  interface ComponentCustomProperties {
    $axios: AxiosInstance;
    $api: AxiosInstance;
  }
}

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)
// Use environment variable or default to localhost:3000
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor to handle errors properly
api.interceptors.response.use(
  (response) => {
    // Return successful responses as-is
    return response;
  },
  (error) => {
    // Extract error message from response body if available
    let errorMessage = 'An unexpected error occurred';

    if (error.response) {
      // Server responded with error status code
      const data = error.response.data;

      if (data?.error) {
        errorMessage = data.error;
      } else if (data?.message) {
        errorMessage = data.message;
      } else if (typeof data === 'string') {
        errorMessage = data;
      } else {
        errorMessage = `Server error: ${error.response.status} ${error.response.statusText}`;
      }
    } else if (error.request) {
      // Request was made but no response received
      errorMessage = 'Network error: Unable to connect to server';
    } else {
      // Something else happened
      errorMessage = error.message || errorMessage;
    }

    // Create a new error with the extracted message
    const enhancedError = new Error(errorMessage);
    Object.assign(enhancedError, error);

    return Promise.reject(enhancedError);
  }
);

export default defineBoot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios;
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  app.config.globalProperties.$api = api;
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
});

export { api };
