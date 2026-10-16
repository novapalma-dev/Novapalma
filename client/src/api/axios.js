import axios from 'axios';

/**
 * Instancia de Axios con Hardening de Seguridad.
 * Para permitir el envío automático
 * de Cookies HttpOnly en cada petición, eliminando la necesidad de manejar tokens en JS.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  withCredentials: true, // Crucial: Permite el transporte de cookies de sesión
});

// Interceptor para manejar errores globales de infraestructura
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si el servidor retorna 401, la sesión ha expirado o es inválida
    if (error.response && error.response.status === 401) {
      // Limpia el estado local del usuario (pero el token ya está protegido en la cookie)
      localStorage.removeItem('user');
      
      // Evitar redirecciones infinitas si ya se encuentra en el login
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
