import React, { useState } from 'react';
import api from '../api/axios';
import { toast } from 'sonner';
import { generarF04 } from '../utils/generadorPDF'; 
import { generarF05 } from '../utils/generadorF05';
import { generarF01 } from '../utils/generadorF01';
import { generarF02 } from '../utils/generadorF02'; 
import { generarF03 } from '../utils/generadorF03';
import ModalEditarSesion from './ModalEditarSesion';

// --- HELPERS ---
const formatearFechaSQL = (fechaStr) => {
  if (!fechaStr) return "---";
  try {
    const soloFecha = fechaStr.split('T')[0]; 
    const [y, m, d] = soloFecha.split('-');
    return `${d}/${m}/${y}`; 
  } catch(e) { return "---"; }
};

const formatearHora = (fechaStr) => {
  if (!fechaStr || !fechaStr.includes('T')) return "";
  try {
    const date = new Date(fechaStr);
    return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch(e) { return ""; }
};

const esRegistroNuevo = (fechaStr) => {
    if (!fechaStr) return false;
    const fecha = new Date(fechaStr);
    const hoy = new Date();
    return fecha.getDate() === hoy.getDate() &&
           fecha.getMonth() === hoy.getMonth() &&
           fecha.getFullYear() === hoy.getFullYear();
};

export default function ModalHistorial({ estudiante, historial = [], onClose, onRefrescar, onEliminar, onEditar }) {
  const [sesionEditando, setSesionEditando] = useState(null);
  
  if (!estudiante) return null;

  const listaHistorial = Array.isArray(historial) ? historial : [];

  // --- ESTADÍSTICAS ---
  const stats = {
    totalF04: listaHistorial.filter(s => s && (s.tipo_formato === 'F04' || !s.tipo_formato)).length,
    totalF03: listaHistorial.filter(s => s && s.tipo_formato === 'F03').length,
    totalF02: listaHistorial.filter(s => s && s.tipo_formato === 'F02').length, 
    totalF05: listaHistorial.filter(s => s && (s.tipo_formato === 'F05' || s.tipo_formato === 'Derivación')).length,
    totalF01: listaHistorial.filter(s => s && s.tipo_formato === 'F01').length,
    ultimaActividad: listaHistorial.length > 0 
      ? formatearFechaSQL(listaHistorial[0].fecha || listaHistorial[0].fecha_solicitud) 
      : 'Sin registros'
  };

  // --- PDF ---
  const manejarDescargaPDF = (s) => {
    if (!s) return;
    try {
      if (s.tipo_formato === 'F01') {
        let datos = {};
        try { datos = typeof s.desarrollo_entrevista === 'string' ? JSON.parse(s.desarrollo_entrevista) : s.desarrollo_entrevista; } catch (e) { datos = s; }
        generarF01({ ...datos, firma_tutor_url: s.firma_tutor_url, firma_estudiante_url: s.firma_estudiante_url }, estudiante);
      } 
      else if (s.tipo_formato === 'F02') generarF02(s, s.estudiantes_asistentes || []);
      else if (s.tipo_formato === 'F03') generarF03(s, estudiante);
      else if (s.tipo_formato === 'F05' || s.tipo_formato === 'Derivación') generarF05(s, estudiante);
      else generarF04(s, estudiante);
    } catch (error) { toast.error("Error al generar PDF"); }
  };

  // --- ELIMINAR (LÓGICA CORREGIDA) ---
  const eliminarRegistro = async (registro) => {
    const idASuprimir = registro.id; 
    if (!idASuprimir) return;
  
    if (!window.confirm("¿Estás seguro de eliminar este registro?")) return;
  
    try {
      // ESCENARIO A: Delegar al padre
      if (onEliminar) {
          await onEliminar(idASuprimir); 
          return; 
      }

      // ESCENARIO B: Eliminar localmente
      let ruta = `/sesiones/${idASuprimir}`;
      if (registro.tipo_formato === 'F02') {
        ruta = `/sesiones-grupales/${idASuprimir}`;
      }
  
      await api.delete(ruta);
      toast.success("Registro eliminado correctamente");
  
      if (onRefrescar) {
        await onRefrescar(); 
      }

    } catch (err) {
      console.error("Error al eliminar:", err);
      toast.error("No se pudo eliminar el registro");
    }
  };

  // --- LÓGICA DE EDICIÓN ---
  const manejarEdicion = (sesion) => {
      const tipo = sesion.tipo_formato;

      // F01, F02, F03, F05 delegan al padre (Dashboard)
      if (['F01', 'F02', 'F03', 'F05', 'Derivación'].includes(tipo)) {
          if (onEditar) {
              onEditar(sesion); 
          } else {
              toast.info("La edición de este formato no está disponible aquí.");
          }
      } 
      // F04 (Seguimiento) se edita aquí mismo (Modal interno)
      else { 
          setSesionEditando(sesion);
      }
  };

  // --- GUARDAR EDICIÓN LOCAL (Solo para F04) ---
  const guardarEdicionLocal = async (datosActualizados) => {
      try {
          await api.put(`/sesiones/${datosActualizados.id}`, datosActualizados);
          toast.success("Registro actualizado");

          try {
              generarF04(datosActualizados, estudiante);
              toast.success("Descargando PDF actualizado...");
          } catch (pdfError) { console.error(pdfError); }

          setSesionEditando(null);
          if (onRefrescar) onRefrescar(); 
      } catch (error) {
          console.error(error);
          toast.error("Error al guardar los cambios");
      }
  };

  return (
    <div className="modal-overlay" style={overlayStyle}>
      <div className="modal-content" style={{ ...containerStyle, width: sesionEditando ? '900px' : '1100px' }}>
        
        {/* HEADER */}
        <header style={headerStyle}>
          <div>
            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px', fontWeight: '700' }}>Expediente del Estudiante</h3>
            <span style={{ color: '#64748b', fontSize: '13px' }}>
                Tutorado: <strong>{estudiante?.nombres_apellidos || "..."}</strong>
            </span>
          </div>
          <button onClick={onClose} style={closeCircleBtnStyle}>×</button>
        </header>

        {!sesionEditando ? (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            
            {/* LISTA (TIMELINE) */}
            <div style={{ flex: '1', padding: '25px', overflowY: 'auto', backgroundColor: 'white' }}>
              {listaHistorial.length > 0 ? (
                listaHistorial.sort((a,b) => {
                    const fA = new Date(a.fecha || a.fecha_solicitud || 0);
                    const fB = new Date(b.fecha || b.fecha_solicitud || 0);
                    return fB - fA; 
                }).map(s => {
                  const fechaRaw = s.fecha || s.fecha_solicitud;
                  const esNuevo = esRegistroNuevo(fechaRaw);
                  const badge = getBadgeConfig(s.tipo_formato);

                  return (
                    <div key={`${s.tipo_formato}-${s.id}`} style={{ display: 'flex', backgroundColor: esNuevo ? '#f0fdf4' : 'white', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <div style={{ width: '5px', backgroundColor: badge.color }}></div>
                      <div style={{ padding: '15px', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ backgroundColor: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800' }}>{s.tipo_formato || 'F04'}</span>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>📅 {formatearFechaSQL(fechaRaw)}</span>
                            {formatearHora(fechaRaw) && (<span style={{ fontSize: '11px', color: '#94a3b8', backgroundColor: '#f8fafc', padding: '2px 5px', borderRadius: '4px' }}>🕒 {formatearHora(fechaRaw)}</span>)}
                            {esNuevo && (<span style={{ fontSize: '10px', backgroundColor: '#22c55e', color: 'white', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>NUEVO</span>)}
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => manejarDescargaPDF(s)} style={actionBtnStyle('#f1f5f9', '#475569')} title="PDF">📄</button>
                            
                            {/* BOTÓN EDITAR SIEMPRE VISIBLE (AHORA INCLUYE F02) */}
                            <button onClick={() => manejarEdicion(s)} style={actionBtnStyle('#fffbeb', '#d97706')} title="Editar">✏️</button>
                            
                            <button onClick={() => eliminarRegistro(s)} style={actionBtnStyle('#fef2f2', '#dc2626')} title="Eliminar">🗑️</button>
                          </div>
                        </div>

                        <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#1e293b', fontWeight: '700' }}>
                            {s.tipo_formato === 'F01' ? "FICHA INTEGRAL" : (s.tema || s.motivo_consulta || s.motivo_derivacion || '---')}
                        </h4>
                        {s.observaciones && <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>"{s.observaciones.substring(0,80)}..."</p>}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>📭 No hay registros.</div>
              )}
            </div>

            {/* BARRA LATERAL */}
            <aside style={asideStyle}>
              <div style={statsBoxStyle}>
                <h4 style={statsTitleStyle}>RESUMEN</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '15px' }}>
                    <StatCard num={stats.totalF04} label="F04" color="#3b82f6" bg="#eff6ff" />
                    <StatCard num={stats.totalF03} label="F03" color="#f59e0b" bg="#fffbeb" />
                    <StatCard num={stats.totalF02} label="F02" color="#8b5cf6" bg="#f5f3ff" />
                    <StatCard num={stats.totalF05} label="F05" color="#ef4444" bg="#fef2f2" />
                    <StatCard num={stats.totalF01} label="F01" color="#10b981" bg="#ecfdf5" />
                </div>
                <div style={statsDetailStyle}>
                  <p style={{margin:'0 0 6px 0'}}><strong>Código:</strong> {estudiante?.codigo_estudiante}</p>
                  <p style={{margin:0}}><strong>Última:</strong> <span style={{color:'#0f172a', fontWeight:'700'}}>{stats.ultimaActividad}</span></p>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* MODO EDICIÓN LOCAL (SOLO F04) */
          <div style={{ flex: 1, backgroundColor: 'white', overflowY: 'auto', padding: '0' }}>
              <ModalEditarSesion 
                sesion={sesionEditando} 
                estudiante={estudiante} 
                onClose={() => setSesionEditando(null)} 
                onGuardar={guardarEdicionLocal}
              />
          </div>
        )}
      </div>
    </div>
  );
}

// --- ESTILOS ---
const getBadgeConfig = (tipo) => {
    switch(tipo) {
        case 'F01': return { color: '#10b981', bg: '#ecfdf5' };
        case 'F02': return { color: '#8b5cf6', bg: '#f5f3ff' };
        case 'F03': return { color: '#f59e0b', bg: '#fffbeb' };
        case 'F05': return { color: '#ef4444', bg: '#fef2f2' };
        default: return { color: '#3b82f6', bg: '#eff6ff' };
    }
};

const StatCard = ({ num, label, color, bg }) => (
  <div style={{ backgroundColor: bg, color: color, padding: '10px', borderRadius: '8px', textAlign: 'center', border:`1px solid ${color}20` }}>
    <b style={{fontSize:'16px'}}>{num}</b><br/>
    <small style={{fontSize:'11px', fontWeight:'600'}}>{label}</small>
  </div>
);

const overlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(2px)' };
const containerStyle = { backgroundColor: 'white', borderRadius: '12px', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
const headerStyle = { padding: '15px 25px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' };
const asideStyle = { width: '260px', backgroundColor: '#f8fafc', borderLeft: '1px solid #e2e8f0', padding: '20px' };
const statsBoxStyle = { backgroundColor: 'white', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' };
const statsTitleStyle = { margin: '0 0 15px 0', fontSize: '11px', color: '#64748b', letterSpacing: '0.05em', fontWeight:'700', textTransform:'uppercase' };
const statsDetailStyle = { borderTop: '1px solid #f1f5f9', paddingTop: '12px', fontSize: '12px', color: '#475569' };

const actionBtnStyle = (bg, color) => ({ 
    backgroundColor: bg, 
    color: color, 
    border: `1px solid ${color}20`, 
    padding: '5px 8px', 
    borderRadius: '6px', 
    cursor: 'pointer', 
    fontWeight: 'bold', 
    fontSize: '12px',
    transition: 'all 0.2s'
});

const closeCircleBtnStyle = { 
    width: '28px', height: '28px', borderRadius: '50%', border: 'none', 
    backgroundColor: '#e2e8f0', cursor: 'pointer', fontSize: '16px', 
    color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' 
};