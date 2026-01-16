// src/components/TablaEstudiantes.jsx
import React from 'react';

export default function TablaEstudiantes({ 
  estudiantes, 
  onNuevaSesion, 
  onVerHistorial, 
  onDerivar, 
  onNuevaFichaIntegral, 
  onNuevaFichaEntrevista, 
  onSeleccionar, 
  estudianteActivoId 
}) {
  return (
    // IMPORTANTE: El contenedor debe tener una altura definida (o flex: 1) para que el sticky funcione dentro de él
    <div style={{ overflowX: 'auto', marginTop: '10px', height: '100%',width: '100%', position: 'relative' }}>
      <table style={styles.table}>
        <thead style={styles.theadSticky}>
          <tr style={styles.headerRow}>
            <th style={styles.th}>ESTUDIANTE</th>
            <th style={styles.thCenter}>F01</th>
            <th style={styles.thCenter}>F02</th>
            <th style={styles.thCenter}>F03</th>
            <th style={styles.thCenter}>F04</th>
            <th style={styles.thCenter}>F05</th>
            <th style={styles.th}>PROGRESO</th>
            <th style={styles.thCenter}>GESTIÓN</th>
          </tr>
        </thead>
        <tbody>
          {estudiantes.length > 0 ? (
            estudiantes.map((est) => {
              // --- CÁLCULOS ---
              const tieneF01 = est.sesiones?.some(s => s.tipo_formato === 'F01');
              
              // Contadores
              const cantF02 = est.sesiones?.filter(s => s.tipo_formato === 'F02').length || 0;
              const cantF03 = est.sesiones?.filter(s => s.tipo_formato === 'F03').length || 0;
              const cantF04 = est.sesiones?.filter(s => (s.tipo_formato === 'F04' || !s.tipo_formato) && s.tipo_formato !== 'F03').length || 0;
              const cantF05 = est.sesiones?.filter(s => s.tipo_formato === 'F05' || s.tipo_formato === 'Derivación').length || 0;
              
              // Cálculo Progreso
              let progreso = 0;
              if (tieneF01) progreso += 40;
              progreso += (cantF02 * 10) + (cantF03 * 15) + (cantF04 * 10);
              if (progreso > 100) progreso = 100;

              const colorBarra = progreso < 30 ? '#ef4444' : progreso < 70 ? '#f59e0b' : '#3b82f6';
              const esSeleccionado = estudianteActivoId === est.id;

              return (
                <tr 
                  key={est.id} 
                  onClick={() => onSeleccionar(est)}
                  style={esSeleccionado ? styles.trActive : styles.tr}
                  onMouseOver={(e) => { if (!esSeleccionado) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                  onMouseOut={(e) => { if (!esSeleccionado) e.currentTarget.style.backgroundColor = 'white'; }}
                >
                  {/* 1. DATOS ESTUDIANTE */}
                  <td style={styles.td}>
                    <div style={styles.profileCell}>
                      <div style={styles.avatar}>{est.nombres_apellidos.charAt(0)}</div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={styles.nameText}>{est.nombres_apellidos}</span>
                        <div style={styles.metaRow}>
                           <span style={styles.codeText}>{est.codigo_estudiante}</span>
                           <span style={styles.separator}>•</span>
                           <span style={styles.phoneText}>📞 {est.celular || est.telefono || 'Sin celular'}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 2. F01 */}
                  <td style={styles.tdCenter}>
                    {tieneF01 ? <div style={styles.checkIcon}>✔</div> : <div style={styles.pendingDot}>•</div>}
                  </td>

                  {/* 3. F02 */}
                  <td style={styles.tdCenter}>
                    {cantF02 > 0 ? <span style={styles.badgePurple}>{cantF02}</span> : <span style={styles.textGray}>-</span>}
                  </td>

                  {/* 4. F03 */}
                  <td style={styles.tdCenter}>
                    {cantF03 > 0 ? <span style={styles.badgeBlue}>{cantF03}</span> : <span style={styles.textGray}>-</span>}
                  </td>

                  {/* 5. F04 */}
                  <td style={styles.tdCenter}>
                    {cantF04 > 0 ? <span style={styles.badgeGray}>{cantF04}</span> : <span style={styles.textGray}>-</span>}
                  </td>

                  {/* 6. F05 */}
                  <td style={styles.tdCenter}>
                    {cantF05 > 0 ? <span style={styles.alertIcon}>⚠️</span> : <span style={styles.textGray}>-</span>}
                  </td>

                  {/* 7. PROGRESO */}
                  <td style={styles.td}>
                    <div style={styles.progressWrapper}>
                      <div style={styles.progressContainer}>
                        <div style={{...styles.progressBar, width: `${progreso}%`, backgroundColor: colorBarra}}></div>
                      </div>
                      <span style={styles.progressText}>{progreso}%</span>
                    </div>
                  </td>

                  {/* 8. GESTIÓN */}
                  <td style={styles.tdCenter}>
                    <div style={styles.actionGroup}>
                       <button onClick={(e) => { e.stopPropagation(); if(onNuevaFichaIntegral) onNuevaFichaIntegral(est); }} 
                               title="Ficha Integral"
                               style={btnStyle(tieneF01 ? '#64748b' : '#16a34a')}>
                         {tieneF01 ? 'Ver F01' : '+ F01'}
                       </button>
                       
                       <button onClick={(e) => { e.stopPropagation(); if(onNuevaFichaEntrevista) onNuevaFichaEntrevista(est); }} 
                               title="Nueva Entrevista"
                               style={btnStyle('#3b82f6')}>
                         + F03
                       </button>

                       <button onClick={(e) => { e.stopPropagation(); if(onNuevaSesion) onNuevaSesion(est); }} 
                               title="Seguimiento"
                               style={btnStyle('#6366f1')}>
                         + F04
                       </button>

                       <button onClick={(e) => { e.stopPropagation(); if(onDerivar) onDerivar(est); }} 
                               title="Derivación"
                               style={btnStyle('#ef4444')}>
                         F05
                       </button>

                       <button onClick={(e) => { e.stopPropagation(); if(onVerHistorial) onVerHistorial(est); }} 
                               title="Ver Historial Completo"
                               style={btnStyle('#475569')}>
                         Historial
                       </button>
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="8" style={styles.emptyState}>
                 📭 No se encontraron estudiantes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- ESTILOS ACTUALIZADOS PARA STICKY HEADER ---
const styles = {
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '900px', fontFamily: '"Segoe UI", sans-serif' },
  
  // ESTILO CLAVE: Cabecera pegajosa
  theadSticky: {
    position: 'sticky',
    top: 0,
    zIndex: 10, // Asegura que quede encima del contenido al hacer scroll
    backgroundColor: '#f8fafc', // Mismo color de fondo para que no sea transparente
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)' // Sombra sutil al deslizar
  },

  headerRow: { backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' },
  
  th: { 
      padding: '16px', 
      textAlign: 'left', 
      fontSize: '11px', 
      fontWeight: '700', 
      color: '#64748b', 
      textTransform: 'uppercase', 
      letterSpacing: '0.5px',
      position: 'sticky', // Refuerzo para algunos navegadores
      top: 0,
      backgroundColor: '#f8fafc',
      borderBottom: '2px solid #e2e8f0'
  },
  thCenter: { 
      padding: '16px', 
      textAlign: 'center', 
      fontSize: '11px', 
      fontWeight: '700', 
      color: '#64748b', 
      textTransform: 'uppercase', 
      letterSpacing: '0.5px',
      position: 'sticky', // Refuerzo
      top: 0,
      backgroundColor: '#f8fafc',
      borderBottom: '2px solid #e2e8f0'
  },
  
  tr: { borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s', backgroundColor: 'white' },
  trActive: { borderBottom: '1px solid #cbd5e1', backgroundColor: '#eff6ff', cursor: 'pointer' },
  
  td: { padding: '12px 16px', verticalAlign: 'middle', borderBottom: '1px solid #f1f5f9' }, // Añadido borde inferior directo a td
  tdCenter: { padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center', borderBottom: '1px solid #f1f5f9' },

  profileCell: { display: 'flex', alignItems: 'center', gap: '12px' },
  avatar: { width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' },
  nameText: { fontSize: '13px', fontWeight: '700', color: '#1e293b' },
  
  metaRow: { display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' },
  codeText: { fontSize: '11px', color: '#64748b', fontWeight: '600' },
  separator: { fontSize: '10px', color: '#cbd5e1' },
  phoneText: { fontSize: '11px', color: '#059669', backgroundColor: '#ecfdf5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #d1fae5' },

  checkIcon: { width: '24px', height: '24px', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', margin: '0 auto' },
  pendingDot: { fontSize: '20px', color: '#cbd5e1', lineHeight: 0 },
  
  badgeBlue: { backgroundColor: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' },
  badgePurple: { backgroundColor: '#f5f3ff', color: '#7c3aed', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' },
  badgeGray: { backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' },
  textGray: { color: '#cbd5e1', fontSize: '14px' },
  alertIcon: { fontSize: '16px', filter: 'drop-shadow(0 2px 2px rgba(239, 68, 68, 0.2))' },

  progressWrapper: { display: 'flex', alignItems: 'center', gap: '10px', width: '120px' },
  progressContainer: { flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: '10px', transition: 'width 0.5s ease-out' },
  progressText: { fontSize: '10px', color: '#64748b', width: '25px', textAlign: 'right' },

  actionGroup: { display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '300px' },
  emptyState: { padding: '40px', textAlign: 'center', color: '#94a3b8', backgroundColor: 'white', borderRadius: '12px', fontStyle: 'italic', fontSize: '13px' }
};

const btnStyle = (bg) => ({
  backgroundColor: bg,
  color: 'white',
  border: 'none',
  padding: '4px 8px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '10px',
  fontWeight: '600',
  transition: '0.2s',
  whiteSpace: 'nowrap'
});