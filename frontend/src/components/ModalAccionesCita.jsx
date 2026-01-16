import React from 'react';

export default function ModalAccionesCita({ cita, onClose, onSeleccionar, onEliminar }) {
  if (!cita) return null;

  const estudiante = cita.resource?.estudiantes;
  const esGrupal = !estudiante; // Si no hay estudiante ID, asumimos que es una cita grupal/general

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* ENCABEZADO MODERNO CON GRADIENTE */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Gestión de Sesión</h2>
            <p style={styles.subtitle}>
              {esGrupal 
                ? `📅 Evento: ${cita.title}` 
                : `🎓 Estudiante: ${estudiante.nombres_apellidos}`}
            </p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.content}>
          <p style={styles.instruction}>Selecciona el formato para ejecutar ahora:</p>

          <div style={styles.grid}>
            {/* OPCIÓN 1: SEGUIMIENTO (F04) - La más común */}
            {!esGrupal && (
              <div style={styles.card} onClick={() => onSeleccionar('F04', estudiante)}>
                <div style={{...styles.iconBox, background: '#e0f2fe', color: '#0284c7'}}>📊</div>
                <div style={styles.cardContent}>
                  <h3 style={styles.cardTitle}>Seguimiento (F04)</h3>
                  <p style={styles.cardText}>Registro rutinario de sesión de tutoría individual.</p>
                </div>
                <div style={styles.arrow}>→</div>
              </div>
            )}

            {/* OPCIÓN 2: ENTREVISTA (F03) */}
            {!esGrupal && (
              <div style={styles.card} onClick={() => onSeleccionar('F03', estudiante)}>
                <div style={{...styles.iconBox, background: '#fef3c7', color: '#d97706'}}>📝</div>
                <div style={styles.cardContent}>
                  <h3 style={styles.cardTitle}>Entrevista (F03)</h3>
                  <p style={styles.cardText}>Entrevista profunda o diagnóstico personal.</p>
                </div>
                <div style={styles.arrow}>→</div>
              </div>
            )}

            {/* OPCIÓN 3: DERIVACIÓN (F05) */}
            {!esGrupal && (
              <div style={styles.card} onClick={() => onSeleccionar('F05', estudiante)}>
                <div style={{...styles.iconBox, background: '#fee2e2', color: '#dc2626'}}>🚑</div>
                <div style={styles.cardContent}>
                  <h3 style={styles.cardTitle}>Derivación (F05)</h3>
                  <p style={styles.cardText}>Derivar a Psicología, Médico u otra área.</p>
                </div>
                <div style={styles.arrow}>→</div>
              </div>
            )}

            {/* OPCIÓN 4: FICHA INTEGRAL (F01) */}
            {!esGrupal && (
              <div style={styles.card} onClick={() => onSeleccionar('F01', estudiante)}>
                <div style={{...styles.iconBox, background: '#f3f4f6', color: '#4b5563'}}>🗂️</div>
                <div style={styles.cardContent}>
                  <h3 style={styles.cardTitle}>Ficha Integral (F01)</h3>
                  <p style={styles.cardText}>Registrar datos iniciales del estudiante.</p>
                </div>
                <div style={styles.arrow}>→</div>
              </div>
            )}

            {/* OPCIÓN 5: GRUPAL (F02) - Siempre visible o solo si es grupal */}
            <div style={styles.card} onClick={() => onSeleccionar('F02', estudiante)}>
              <div style={{...styles.iconBox, background: '#dcfce7', color: '#16a34a'}}>👥</div>
              <div style={styles.cardContent}>
                <h3 style={styles.cardTitle}>Tutoría Grupal (F02)</h3>
                <p style={styles.cardText}>Sesión colectiva o taller con asistencia.</p>
              </div>
              <div style={styles.arrow}>→</div>
            </div>
          </div>

          {/* --- NUEVA SECCIÓN: ELIMINAR CITA --- */}
          <div style={styles.deleteSection}>
             <button 
              style={styles.deleteBtn}
              onClick={() => onEliminar(cita.id)}
             >
               🗑️ Eliminar esta cita del calendario
             </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// --- ESTILOS VISUALES MODERNOS (Mantenidos y actualizados) ---
const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000
  },
  modal: {
    backgroundColor: 'white', width: '600px', maxWidth: '95%',
    borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden', animation: 'fadeIn 0.2s ease-out'
  },
  header: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    color: 'white'
  },
  title: { margin: 0, fontSize: '18px', fontWeight: '700' },
  subtitle: { margin: '5px 0 0 0', fontSize: '13px', opacity: 0.8, fontWeight: '400' },
  closeBtn: {
    background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
    width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'
  },
  content: { padding: '25px', backgroundColor: '#f8fafc' },
  instruction: { marginTop: 0, marginBottom: '20px', fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr', gap: '12px' },
  card: {
    display: 'flex', alignItems: 'center', gap: '15px',
    backgroundColor: 'white', padding: '15px', borderRadius: '12px',
    border: '1px solid #e2e8f0', cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
  },
  cardContent: { flex: 1 },
  iconBox: {
    width: '40px', height: '40px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '20px', fontWeight: 'bold'
  },
  cardTitle: { margin: 0, fontSize: '14px', fontWeight: '700', color: '#334155' },
  cardText: { margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' },
  arrow: { color: '#cbd5e1', fontWeight: 'bold', fontSize: '18px' },

  // Estilos del botón de eliminar
  deleteSection: {
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'center'
  },
  deleteBtn: {
    background: 'none',
    border: '1px solid #fee2e2',
    color: '#ef4444',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }
};