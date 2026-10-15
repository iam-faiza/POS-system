import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the server says our session is no longer valid (expired token, deleted
// account), tell the app to sign out instead of leaving a half-broken screen.
// Failed logins also return 401, so the login request is excluded.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = String(error.config?.url || '').includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest && localStorage.getItem('token')) {
      window.dispatchEvent(new Event('authExpired'));
    }
    return Promise.reject(error);
  }
);

export default API;
