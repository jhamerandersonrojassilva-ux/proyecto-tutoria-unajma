import React, { useState } from 'react';
import { toast } from 'sonner';
import logoCarrera from '../assets/sistemas.png';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(username, password);
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      {/* Capa de fondo con degradado institucional */}
      <div style={styles.overlay}></div>

      <div style={styles.loginCard}>
        <div style={styles.header}>
          <img src={logoCarrera} alt="Logo Sistemas" style={styles.logo} />
          <h2 style={styles.title}>Tutoría UNAJMA</h2>
          <p style={styles.subtitle}>Escuela Profesional de Ingeniería de Sistemas</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Usuario (DNI)</label>
            <input
              type="text"
              placeholder="Ingrese su DNI"
              style={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              style={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            style={loading ? {...styles.button, opacity: 0.7} : styles.button}
            disabled={loading}
          >
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={styles.footer}>
          <p>© 2026 Universidad Nacional José María Arguedas</p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundImage: 'url("https://images.unsplash.com/photo-1541339907198-e08756ebafe3?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80")', // Imagen de fondo académica
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'relative',
    fontFamily: '"Inter", sans-serif',
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 58, 138, 0.8) 100%)',
    zIndex: 1,
  },
  loginCard: {
    position: 'relative',
    zIndex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    padding: '40px',
    borderRadius: '20px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
  },
  logo: { width: '80px', marginBottom: '15px' },
  title: { fontSize: '24px', fontWeight: '800', color: '#1e293b', margin: '0 0 5px 0' },
  subtitle: { fontSize: '13px', color: '#64748b', marginBottom: '30px' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  inputGroup: { textAlign: 'left' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' },
  input: {
    width: '100%',
    padding: '12px 15px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  button: {
    backgroundColor: '#2563eb',
    color: 'white',
    padding: '12px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)',
    marginTop: '10px',
  },
  footer: { marginTop: '30px', fontSize: '11px', color: '#94a3b8' }
};

export default Login;