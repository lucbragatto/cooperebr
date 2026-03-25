import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Enviar contexto ativo para o backend
  if (typeof window !== 'undefined') {
    const contexto = localStorage.getItem('contexto_ativo');
    if (contexto) {
      config.headers['X-Contexto-Ativo'] = contexto;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      Cookies.remove('token');
      Cookies.remove('usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
