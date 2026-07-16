import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  try {
    const userStr = localStorage.getItem('synora_user');
    if (userStr && userStr !== 'undefined') {
      const user = JSON.parse(userStr);
      if (user && user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    }
  } catch (error) {
    console.error('API Interceptor: Failed to parse user token', error);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login if it's a 401 and not an auth request
    const url = error.config?.url || '';
    const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/register');
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('synora_user');
      window.dispatchEvent(new Event('unauthorized'));
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

