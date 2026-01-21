import React, { useState, useEffect } from 'react';
import api from "../api/axios";

const GestionPersonal = ({ user }) => {
  const [responsables, setResponsables] = useState([]);
  const [nuevoResp, setNuevoResp] = useState({ 
    username: '', 
    password: '', 
    telefono: '', 
    documento: null 
  });
  const [cargando, setCargando] = useState(false);

  // Cargar la lista al montar el componente
  useEffect(() => {
    if (user && user.escuela_id) {
      cargarResponsables();
    }
  }, [user]);

  const cargarResponsables = async () => {
    try {
      // Esta petición fallaba antes con 403. Ahora funcionará.
      const res = await api.get(`/admin/listar-responsables?escuela_id=${user.escuela_id}`);
      setResponsables(res.data);
    } catch (err) { 
      console.error("Error cargando responsables:", err);
      if (err.response?.status === 403) {
        alert("No tienes permisos para ver esta lista. Verifica tu sesión.");
      }
    }
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    setCargando(true);

    try {
      const formData = new FormData();
      formData.append('username', nuevoResp.username);
      formData.append('password', nuevoResp.password);
      formData.append('telefono', nuevoResp.telefono);
      formData.append('escuela_id', user.escuela_id);
      
      if (nuevoResp.documento) {
        formData.append('documento', nuevoResp.documento);
      }

      await api.post('/admin/registrar-responsable', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert("Responsable registrado y documento de designación adjuntado correctamente.");
      setNuevoResp({ username: '', password: '', telefono: '', documento: null });
      cargarResponsables(); // Recargar la tabla
    } catch (err) { 
      console.error(err);
      alert("Error al crear responsable. Verifique los datos."); 
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* HEADER DE SECCIÓN */}
      <div style={styles.header}>
        <h2 style={styles.sectionTitle}>Gestión de Responsables de Tutoría</h2>
        <p style={styles.schoolBadge}>
          <span style={styles.iconBadge}>🏛️</span> 
          Escuela: <b>{user.escuela_nombre || 'Ingeniería de Sistemas'}</b>
        </p>
      </div>

      {/* TARJETA DE REGISTRO */}
      <div style={styles.formCard}>
        <h4 style={styles.formTitle}>Formalizar Nueva Designación (Oficio/Memo)</h4>
        <form onSubmit={handleCrear} style={styles.inputGroup}>
          <div style={styles.inputWrapper}>
            <span style={styles.inputIcon}>👤</span>
            <input 
              type="text" 
              placeholder="Nombre de Usuario" 
              style={styles.input}
              value={nuevoResp.username}
              onChange={e => setNuevoResp({...nuevoResp, username: e.target.value})}
              required
            />
          </div>
          <div style={styles.inputWrapper}>
            <span style={styles.inputIcon}>🔑</span>
            <input 
              type="password" 
              placeholder="Contraseña" 
              style={styles.input}
              value={nuevoResp.password}
              onChange={e => setNuevoResp({...nuevoResp, password: e.target.value})}
              required
            />
          </div>
          <div style={styles.inputWrapper}>
            <span style={styles.inputIcon}>📞</span>
            <input 
              type="text" 
              placeholder="Teléfono" 
              style={styles.input}
              value={nuevoResp.telefono}
              onChange={e => setNuevoResp({...nuevoResp, telefono: e.target.value})}
            />
          </div>

          {/* CAMPO ADJUNTO */}
          <div style={styles.inputWrapper}>
            <label style={styles.fileInputLabel}>
              <span style={{marginRight: '8px'}}>📄</span>
              {nuevoResp.documento ? (
                <span style={{color: '#0f172a', fontWeight: 'bold'}}>
                  {nuevoResp.documento.name.substring(0, 15)}...
                </span>
              ) : (
                "Adjuntar Oficio/Memo (PDF)"
              )}
              <input 
                type="file" 
                accept=".pdf" 
                style={{display: 'none'}} 
                onChange={e => setNuevoResp({...nuevoResp, documento: e.target.files[0]})}
              />
            </label>
          </div>

          <button type="submit" style={styles.registerBtn} disabled={cargando}>
            <span>{cargando ? '⏳' : '+'}</span> {cargando ? 'Guardando...' : 'Registrar'}
          </button>
        </form>
      </div>

      {/* TABLA */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Responsable</th>
              <th style={styles.th}>Designación (PDF)</th>
              <th style={styles.th}>Teléfono</th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {responsables.length > 0 ? (
              responsables.map(r => (
                <tr key={r.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.userInfo}>
                      <div style={styles.userAvatar}>
                        {r.username.charAt(0).toUpperCase()}
                      </div>
                      <span style={styles.userNameText}>{r.username}</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    {r.url_documento ? (
                      <a 
                        // Ajusta localhost:3001 si tu base URL es diferente
                        href={`http://localhost:3001${r.url_documento}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={styles.docLink}
                      >
                        📥 Ver Documento
                      </a>
                    ) : (
                      <span style={{color: '#94a3b8', fontSize: '12px', fontStyle: 'italic'}}>No adjunto</span>
                    )}
                  </td>
                  <td style={styles.td}>{r.telefono || '---'}</td>
                  <td style={styles.td}>
                    <span style={styles.activeBadge}>Activo</span>
                  </td>
                  <td style={styles.td}>
                    <button style={styles.actionBtn} title="Editar">✏️</button>
                    <button style={styles.deleteBtn} title="Eliminar">🗑️</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{...styles.td, textAlign: 'center', padding: '40px', color: '#94a3b8'}}>
                  No hay responsables registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- ESTILOS DEFINITIVOS ---
const styles = {
  container: { padding: '30px', backgroundColor: '#f8fafc', minHeight: '100%', fontFamily: 'Inter, sans-serif' },
  header: { marginBottom: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' },
  sectionTitle: { fontSize: '24px', color: '#0f172a', fontWeight: '700', margin: '0 0 8px 0' },
  schoolBadge: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '8px', fontSize: '14px', margin: 0, border: '1px solid #dbeafe' },
  iconBadge: { fontSize: '16px' },
  formCard: { backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginBottom: '30px', border: '1px solid #e2e8f0' },
  formTitle: { margin: '0 0 20px 0', color: '#64748b', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' },
  inputGroup: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'end' },
  inputWrapper: { position: 'relative' },
  inputIcon: { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#94a3b8', zIndex: 1 },
  input: { width: '100%', padding: '12px 12px 12px 42px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#fcfcfd', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box' },
  
  fileInputLabel: { 
    display: 'flex', 
    alignItems: 'center',
    justifyContent: 'center',
    height: '42px', // Altura igual a los inputs
    borderRadius: '10px', 
    border: '2px dashed #94a3b8', 
    fontSize: '13px', 
    color: '#475569', 
    backgroundColor: '#f1f5f9', 
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxSizing: 'border-box'
  },

  registerBtn: { 
    height: '42px',
    backgroundColor: '#0f172a', 
    color: '#ffffff', 
    padding: '0 24px', 
    borderRadius: '10px', 
    border: 'none', 
    fontWeight: '600', 
    fontSize: '14px', 
    cursor: 'pointer', 
    transition: 'all 0.2s', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: '8px',
    boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.2)'
  },
  
  tableContainer: { backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  th: { backgroundColor: '#f8fafc', padding: '16px 24px', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '16px 24px', fontSize: '14px', color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  
  docLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: '#2563eb',
    textDecoration: 'none',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: '#eff6ff',
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #bfdbfe',
    transition: 'all 0.2s'
  },

  userInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
  userNameText: { fontWeight: '600', color: '#0f172a' },
  userAvatar: { width: '36px', height: '36px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold' },
  activeBadge: { backgroundColor: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' },
  actionBtn: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', cursor: 'pointer', marginRight: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  deleteBtn: { background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#e11d48' }
};

export default GestionPersonal;