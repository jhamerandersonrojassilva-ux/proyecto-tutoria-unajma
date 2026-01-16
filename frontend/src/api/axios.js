import axios from 'axios';

const api = axios.create({
  // Asegúrate de que este puerto coincida con tu index.js (3001)
  baseURL: 'http://localhost:3001', 
});

// --- INTERCEPTOR DE SEGURIDAD (TOKEN JWT) ---
// Este código se ejecuta automáticamente antes de cada petición al servidor
api.interceptors.request.use(
  (config) => {
    // 1. Buscamos la sesión guardada en el navegador
    const userStorage = localStorage.getItem('user');
    
    if (userStorage) {
      try {
        const user = JSON.parse(userStorage);
        // 2. Si el usuario tiene un token, lo inyectamos en el encabezado
        if (user.token) {
          config.headers['Authorization'] = `Bearer ${user.token}`;
        }
      } catch (error) {
        console.error("Error al leer el token de seguridad:", error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;