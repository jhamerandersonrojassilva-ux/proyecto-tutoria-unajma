import React from 'react';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import api from '../api/axios';
import { descargarPortafolioZip } from '../utils/generadorPortafolio';
import { generarPDFConsolidado } from '../utils/generadorConsolidado';

const DashboardReportes = ({ informes, onRefresh, descargarAdjunto }) => {
  
  // 1. CÁLCULOS ESTRATÉGICOS (KPIs)
  const totalInformes = informes.length;
  const totalEstudiantes = informes.reduce((sum, inf) => sum + (inf.estadisticas?.total || inf.total_estudiantes || 0), 0);
  const totalRiesgo = informes.reduce((sum, inf) => sum + (inf.estadisticas?.riesgo || inf.total_riesgo || 0), 0);
  
  // Cálculo de porcentaje de riesgo global
  const porcentajeRiesgo = totalEstudiantes > 0 ? Math.round((totalRiesgo / totalEstudiantes) * 100) : 0;

  // Semáforo de color según riesgo
  const colorSemasforo = porcentajeRiesgo < 10 ? '#10b981' : porcentajeRiesgo < 25 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ animation: 'fadeIn 0.5s' }}>
      
      {/* --- SECCIÓN 1: CABECERA ESTRATÉGICA --- */}
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>📊 Tablero de Mando: Tutoría</h2>
          <p style={styles.subtitle}>Análisis consolidado del semestre 2025-I</p>
        </div>
        <button onClick={onRefresh} style={styles.btnRefresh}>🔄 Actualizar Datos</button>
      </div>

      {/* --- SECCIÓN 2: TARJETAS DE INDICADORES (KPIs) --- */}
      <div style={styles.kpiGrid}>
        
        {/* KPI 1: ALUMNOS EN RIESGO (EL MÁS IMPORTANTE) */}
        <div style={{...styles.card, borderLeft: `5px solid ${colorSemasforo}`}}>
          <div style={styles.cardIcon}>🚨</div>
          <div>
            <div style={styles.cardLabel}>Estudiantes en Riesgo</div>
            <div style={{...styles.cardValue, color: colorSemasforo}}>{totalRiesgo}</div>
            <div style={styles.cardSubtext}>Representa el {porcentajeRiesgo}% del total</div>
          </div>
        </div>

        {/* KPI 2: POBLACIÓN TOTAL */}
        <div style={styles.card}>
          <div style={{...styles.cardIcon, backgroundColor: '#eff6ff'}}>👥</div>
          <div>
            <div style={styles.cardLabel}>Población Atendida</div>
            <div style={styles.cardValue}>{totalEstudiantes}</div>
            <div style={styles.cardSubtext}>Estudiantes bajo tutoría</div>
          </div>
        </div>

        {/* KPI 3: CUMPLIMIENTO DOCENTE */}
        <div style={styles.card}>
          <div style={{...styles.cardIcon, backgroundColor: '#f0fdf4'}}>✅</div>
          <div>
            <div style={styles.cardLabel}>Informes Recibidos</div>
            <div style={styles.cardValue}>{totalInformes}</div>
            <div style={styles.cardSubtext}>Documentos procesados</div>
          </div>
        </div>
      </div>

      {/* --- SECCIÓN 3: TABLA DE GESTIÓN (DETALLE) --- */}
      <div style={styles.tableCard}>
        <h3 style={styles.tableTitle}>📋 Detalle de Informes por Docente</h3>
        <div style={{overflowX: 'auto'}}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}>Docente Tutor</th>
                <th style={styles.th}>Semestre</th>
                <th style={styles.th}>Nivel de Riesgo</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Adjunto</th>
                <th style={styles.th}>Gestión</th>
              </tr>
            </thead>
            <tbody>
              {informes.length > 0 ? informes.map((inf) => {
                const riesgoLocal = inf.total_riesgo || 0;
                const totalLocal = inf.total_estudiantes || 1;
                const pctLocal = Math.round((riesgoLocal / totalLocal) * 100);
                
                return (
                  <tr key={inf.id} style={styles.tr}>
                    <td style={styles.td}>{new Date(inf.fecha).toLocaleDateString()}</td>
                    <td style={styles.td}>
                      <div style={{fontWeight:'bold', color:'#334155'}}>{inf.docente}</div>
                    </td>
                    <td style={styles.td}>{inf.semestre}</td>
                    
                    {/* BARRA VISUAL DE RIESGO */}
                    <td style={styles.td}>
                      <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                        <span style={{fontSize:'12px', fontWeight:'bold', width:'25px'}}>{riesgoLocal}</span>
                        <div style={{flex:1, height:'6px', backgroundColor:'#e2e8f0', borderRadius:'3px', minWidth:'60px'}}>
                          <div style={{
                            width: `${Math.min(pctLocal, 100)}%`, 
                            height:'100%', 
                            borderRadius:'3px',
                            backgroundColor: pctLocal > 20 ? '#ef4444' : pctLocal > 10 ? '#f59e0b' : '#10b981'
                          }}></div>
                        </div>
                      </div>
                    </td>

                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge, 
                        backgroundColor: inf.estado === 'APROBADO' ? '#dcfce7' : '#fff7ed',
                        color: inf.estado === 'APROBADO' ? '#166534' : '#9a3412'
                      }}>
                        {inf.estado}
                      </span>
                    </td>

                    <td style={styles.td}>
                      {inf.url_documento ? (
                        <button 
                          onClick={() => descargarAdjuntoConNombre(inf.url_documento, inf.docente)}
                          style={styles.linkBtn}
                        >
                          📄 Ver PDF
                        </button>
                      ) : <span style={{color:'#cbd5e1', fontSize:'11px'}}>--</span>}
                    </td>

                    <td style={styles.td}>
                      <div style={{display:'flex', gap:'5px'}}>
                        <button 
                          onClick={() => descargarPortafolioZip(inf.id)} 
                          title="Descargar Portafolio ZIP" 
                          style={{...styles.actionBtn, backgroundColor: '#0f172a', color: 'white'}}
                        >
                          📦
                        </button>
                        
                        {inf.estado !== 'APROBADO' && (
                          <button 
                            onClick={async () => {
                              if(await Swal.fire({title:'¿Aprobar Informe?', text: 'Esto confirmará la recepción conforme.', icon:'question', showCancelButton:true}).then(r=>r.isConfirmed)){
                                try {
                                  await api.patch(`/admin/informes/${inf.id}/estado`, {estado:'APROBADO'});
                                  toast.success("Informe Aprobado");
                                  onRefresh();
                                } catch (e) { toast.error("Error al aprobar"); }
                              }
                            }} 
                            style={{...styles.actionBtn, backgroundColor:'#16a34a', color:'white'}}
                            title="Aprobar Informe"
                          >
                            ✅
                          </button>
                        )}

                        <button 
                          onClick={async () => {
                            if(await Swal.fire({title:'¿Eliminar?', text:'Se borrará del historial permanentemente.', icon:'warning', showCancelButton:true}).then(r=>r.isConfirmed)){
                              try {
                                await api.delete(`/admin/informes/${inf.id}`);
                                toast.success("Eliminado");
                                onRefresh();
                              } catch (e) { toast.error("Error al eliminar"); }
                            }
                          }}
                          style={{...localStyles.actionBtn, backgroundColor:'#fee2e2', color:'#ef4444'}}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="7" style={{padding:'40px', textAlign:'center', color:'#64748b'}}>No hay datos para mostrar en este periodo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- ESTILOS EXCLUSIVOS DE ESTE COMPONENTE ---
const styles = {
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
  title: { fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 },
  subtitle: { fontSize: '13px', color: '#64748b', marginTop: '5px' },
  btnRefresh: { backgroundColor: 'white', border: '1px solid #cbd5e1', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', color: '#475569', fontWeight: '600', fontSize: '13px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' },
  card: { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #e2e8f0' },
  cardIcon: { width: '45px', height: '45px', borderRadius: '10px', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' },
  cardLabel: { fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  cardValue: { fontSize: '24px', fontWeight: '800', color: '#1e293b', lineHeight: '1.2' },
  cardSubtext: { fontSize: '11px', color: '#94a3b8' },

  tableCard: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', padding: '20px', border: '1px solid #e2e8f0' },
  tableTitle: { fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '15px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  trHead: { backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' },
  th: { padding: '12px 15px', textAlign: 'left', color: '#475569', fontWeight: '700', textTransform: 'uppercase', fontSize: '11px' },
  tr: { borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' },
  td: { padding: '12px 15px', color: '#334155', verticalAlign: 'middle' },
  
  badge: { padding: '3px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px' },
  linkBtn: { background: 'none', border: '1px solid #bfdbfe', color: '#2563eb', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '500' },
  actionBtn: { width: '32px', height: '32px', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', transition: 'transform 0.1s' }
};

// Pequeño hack para reutilizar estilos del padre si faltan
const localStyles = { actionBtn: styles.actionBtn }; 

export default DashboardReportes;