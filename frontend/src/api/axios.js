import axios from 'axios';

// Asegúrate de que este puerto coincida con tu backend
const api = axios.create({
    baseURL: 'http://localhost:3001', 
});

// INTERCEPTOR: Antes de cada petición, pega el token
api.interceptors.request.use(
    (config) => {
        const user = localStorage.getItem('user');
        if (user) {
            const parsedUser = JSON.parse(user);
            if (parsedUser && parsedUser.token) {
                config.headers['Authorization'] = `Bearer ${parsedUser.token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;