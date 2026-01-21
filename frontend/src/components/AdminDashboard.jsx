import React, { useState, useEffect } from 'react';
import TutorManager from './TutorManager';
import BulkAsignacion from './BulkAsignacion';
import GestionPersonal from './GestionPersonal';
import api from '../api/axios';
import { toast } from 'sonner';
import { generarPDFConsolidado } from '../utils/generadorConsolidado';
import Swal from 'sweetalert2';
import { descargarPortafolioZip } from '../utils/generadorPortafolio';
import DashboardReportes from './DashboardReportes'; // <--- NUEVO IMPORT
// URL BASE
const BASE_URL = 'http://localhost:3001';

const AdminDashboard = ({ user, onLogout }) => {
  // --- NAVEGACIÓN ---
  const [tab, setTab] = useState(user?.is_super_user ? 'resumen' : 'ciclos');
  
  // --- ESTADOS DE DATOS ---
  const [roles, setRoles] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [cicloActivo, setCicloActivo] = useState(null);
  
  // --- ESTADOS REPORTES ---
  const [seguimiento, setSeguimiento] = useState([]);
  const [stats, setStats] = useState({ tutores: 0, informes: 0 });

  // --- ESTADOS GESTIÓN CICLOS ---
  const [nuevoCiclo, setNuevoCiclo] = useState("");
  const [cicloEditando, setCicloEditando] = useState(null);
  const [nombreEditado, setNombreEditado] = useState("");

  // --- ESTADOS GESTIÓN ESTUDIANTES ---
  const [busquedaEstudiante, setBusquedaEstudiante] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [estudianteEditando, setEstudianteEditando] = useState(null);
  const [formEstudiante, setFormEstudiante] = useState({
    nombres: '', dni: '', codigo: '', tutor_id: '', telefono: ''
  });

  // --- ESTADOS WHATSAPP ---
  const [listaNotificaciones, setListaNotificaciones] = useState([]);
  const [enviadosLocalmente, setEnviadosLocalmente] = useState([]);
  const [modoEnvioActivo, setModoEnvioActivo] = useState(false);

  // --- ESTADOS LEGAJO ---
  const [mostrarModalLegajo, setMostrarModalLegajo] = useState(false);
  const [tutorSeleccionado, setTutorSeleccionado] = useState(null);
  const [resumenLegajo, setResumenLegajo] = useState([]);
  const [cargandoReporte, setCargandoReporte] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resRoles, resTutores, resCiclos] = await Promise.all([
        api.get('/roles').catch(e => ({ data: [] })), 
        api.get('/tutores').catch(e => ({ data: [] })), 
        api.get('/admin/ciclos').catch(e => ({ data: [] }))
      ]);

      if (resRoles.data) setRoles(resRoles.data);
      if (resTutores.data) {
        setTutores(resTutores.data);
        setStats(prev => ({ ...prev, tutores: resTutores.data.length }));
      }
      
      if (resCiclos.data && resCiclos.data.length > 0) {
        setCiclos(resCiclos.data);
        setCicloActivo(prev => prev || resCiclos.data.find(c => c.activo));
      }
      
      if (user?.is_super_user) {
        const resInformes = await api.get('/admin/informes').catch(() => ({ data: [] }));
        setStats(prev => ({ ...prev, informes: resInformes.data.length }));
      }

    } catch (err) { 
      console.error("Error inicial:", err);
    }
  };

  // --- FUNCIONES AUXILIARES ---
  const descargarAdjuntoConNombre = async (urlRelativa, nombreTutor, tipoDoc = "Informe") => {
    try {
      if (!urlRelativa) return toast.error("No hay archivo.");
      const toastId = toast.loading("Descargando...");
      const response = await fetch(`${BASE_URL}${urlRelativa}`);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `${tipoDoc}_${(nombreTutor||"Doc").replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.dismiss(toastId);
    } catch (error) {
      toast.error("Error descarga directa. Abriendo pestaña...");
      window.open(`${BASE_URL}${urlRelativa}`, '_blank');
    }
  };

  const cargarSeguimiento = async () => {
    try {
      const res = await api.get('/admin/informes');
      setSeguimiento(res.data);
      setStats(prev => ({ ...prev, informes: res.data.length }));
    } catch (e) { console.error(e); }
  };

  // --- HANDLERS ---
  const buscarEstudiante = async (e) => { e.preventDefault(); try { const res = await api.get(`/admin/estudiantes/buscar?q=${busquedaEstudiante}`); setResultadosBusqueda(res.data); } catch(e){ toast.error("Error"); }};
  const seleccionarEstudiante = (est) => { setEstudianteEditando(est); setFormEstudiante({ nombres: est.nombres_apellidos, dni: est.dni, codigo: est.codigo_estudiante, tutor_id: est.tutor_asignado_id || "", telefono: est.telefono || "" }); };
  const guardarCambiosEstudiante = async () => { try { await api.put(`/admin/estudiantes/${estudianteEditando.id}`, { ...formEstudiante, ciclo_id: cicloActivo?.id }); toast.success("Guardado"); setEstudianteEditando(null); fetchData(); } catch(e){ toast.error("Error"); }};

  const cargarNotificaciones = async () => { try { const res = await api.get('/admin/notificaciones-asignacion'); setListaNotificaciones(res.data); setModoEnvioActivo(false); } catch(e){ toast.error("Error"); }};
  const enviarWhatsApp = (est) => {
    if (!est.telefono || est.telefono.length < 9) {
        const n = prompt("Celular faltante:"); if(n) { api.patch(`/admin/estudiantes/${est.id}/telefono`,{telefono:n}); est.telefono=n; } else return;
    }
    window.open(`https://web.whatsapp.com/send?phone=51${est.telefono}&text=${encodeURIComponent(`Hola ${est.estudiante}, tu tutor asignado es: ${est.tutor}`)}`, '_blank');
    setEnviadosLocalmente([...enviadosLocalmente, est.id]);
  };

  const crearCiclo = async (e) => { e.preventDefault(); await api.post('/admin/ciclos', {nombre_ciclo: nuevoCiclo}); fetchData(); setNuevoCiclo(""); };
  const activarCiclo = async (id) => { await api.patch(`/admin/ciclos/${id}/activar`); fetchData(); };
  const eliminarCiclo = async (id) => { if(window.confirm("¿Borrar?")) await api.delete(`/admin/ciclos/${id}`); fetchData(); };
  const abrirLegajo = async (t) => { setTutorSeleccionado(t); const res = await api.get(`/admin/resumen-legajo/${t.id}`); setResumenLegajo(res.data); setMostrarModalLegajo(true); };
  const manejarDescargaConsolidado = async () => { setCargandoReporte(true); try{ const res = await api.get(`/admin/reporte-consolidado/${tutorSeleccionado.id}`); generarPDFConsolidado(res.data, cicloActivo?.nombre_ciclo); }finally{ setCargandoReporte(false); } };

  const siguienteEnCola = listaNotificaciones.find(est => !enviadosLocalmente.includes(est.id));
  const progreso = enviadosLocalmente.length;
  const total = listaNotificaciones.length;

  return (
    <div style={localStyles.container}>
      
      {/* --- ENCABEZADO Y TÍTULO --- */}
      <div style={localStyles.header}>
        <div>
          <h1 style={localStyles.title}>Panel Académico</h1>
          <p style={localStyles.subtitle}>
            Bienvenida, <strong>{user?.username}</strong> ({user?.is_super_user ? 'Dirección' : 'Administración'})
          </p>
        </div>
        <div style={localStyles.cycleBadge}>
          Ciclo Activo: <strong>{cicloActivo?.nombre_ciclo || '...'}</strong>
        </div>
      </div>

      {/* --- BARRA DE NAVEGACIÓN (TABS HORIZONTALES) --- */}
      <div style={localStyles.navBar}>
        {user?.is_super_user ? (
          /* PESTAÑAS DIRECTORA */
          <>
            <button style={tab === 'resumen' ? localStyles.tabActive : localStyles.tab} onClick={() => setTab('resumen')}>
              📊 Resumen
            </button>
            <button style={tab === 'personal' ? localStyles.tabActive : localStyles.tab} onClick={() => setTab('personal')}>
              👥 Responsables
            </button>
            <button style={tab === 'seguimiento' ? localStyles.tabActive : localStyles.tab} onClick={() => { setTab('seguimiento'); cargarSeguimiento(); }}>
              📑 Reportes
            </button>
          </>
        ) : (
          /* PESTAÑAS RESPONSABLE */
          <>
            <button style={tab === 'ciclos' ? localStyles.tabActive : localStyles.tab} onClick={() => setTab('ciclos')}>📅 Ciclos</button>
            <button style={tab === 'tutores' ? localStyles.tabActive : localStyles.tab} onClick={() => setTab('tutores')}>👨‍🏫 Tutores</button>
            <button style={tab === 'carga' ? localStyles.tabActive : localStyles.tab} onClick={() => setTab('carga')}>📤 Carga</button>
            <button style={tab === 'reasignacion' ? localStyles.tabActive : localStyles.tab} onClick={() => setTab('reasignacion')}>🎓 Alumnos</button>
            <button style={tab === 'notificaciones' ? localStyles.tabActive : localStyles.tab} onClick={() => { setTab('notificaciones'); cargarNotificaciones(); }}>📢 WhatsApp</button>
            <button style={tab === 'seguimiento' ? localStyles.tabActive : localStyles.tab} onClick={() => { setTab('seguimiento'); cargarSeguimiento(); }}>📊 Informes</button>
          </>
        )}
      </div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div style={localStyles.content}>

        {/* VISTA RESUMEN (HOME) */}
        {tab === 'resumen' && user?.is_super_user && (
          <div style={{animation: 'fadeIn 0.5s'}}>
            <div style={localStyles.statsGrid}>
              <div style={localStyles.statCard}>
                <div style={localStyles.statNumber}>{stats.tutores}</div>
                <div style={localStyles.statLabel}>Tutores Activos</div>
              </div>
              <div style={localStyles.statCard}>
                <div style={localStyles.statNumber}>{stats.informes}</div>
                <div style={localStyles.statLabel}>Informes Recibidos</div>
              </div>
              <div style={localStyles.statCard}>
                <div style={localStyles.statNumber}>{cicloActivo?.nombre_ciclo}</div>
                <div style={localStyles.statLabel}>Semestre Actual</div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA GESTIÓN PERSONAL */}
        {tab === 'personal' && (
          <div style={{animation: 'fadeIn 0.5s'}}>
            <GestionPersonal user={user} />
          </div>
        )}

        {/* VISTA REPORTES (CON EL NUEVO DISEÑO VISUAL) */}
        {tab === 'seguimiento' && (
          <DashboardReportes 
            informes={seguimiento} 
            onRefresh={cargarSeguimiento} 
            descargarAdjunto={descargarAdjuntoConNombre} 
          />
        )}

        {/* --- VISTAS RESPONSABLE --- */}
        {tab === 'ciclos' && (
          <div style={localStyles.card}>
            <h3>Gestión de Ciclos</h3>
            <form onSubmit={crearCiclo} style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
              <input style={localStyles.input} placeholder="Nombre (ej: 2025-I)" value={nuevoCiclo} onChange={e=>setNuevoCiclo(e.target.value)} />
              <button type="submit" style={localStyles.primaryBtn}>+ Crear</button>
            </form>
            <table style={localStyles.table}>
              <thead><tr><th style={localStyles.th}>Nombre</th><th style={localStyles.th}>Estado</th><th style={localStyles.th}>Acción</th></tr></thead>
              <tbody>{ciclos.map(c => (<tr key={c.id}><td style={localStyles.td}>{c.nombre_ciclo}</td><td style={localStyles.td}><span onClick={() => activarCiclo(c.id)} style={{cursor:'pointer', color: c.activo ? 'green' : 'gray'}}>{c.activo ? 'ACTIVO' : 'INACTIVO'}</span></td><td style={localStyles.td}><button onClick={()=>eliminarCiclo(c.id)}>🗑️</button></td></tr>))}</tbody>
            </table>
          </div>
        )}

        {tab === 'tutores' && <TutorManager roles={roles} onUpdate={fetchData} />}
        {tab === 'carga' && <BulkAsignacion tutores={tutores} cicloActivo={cicloActivo} />}
        
        {tab === 'reasignacion' && (
          <div style={localStyles.card}>
            <h3>Búsqueda de Estudiantes</h3>
            <form onSubmit={buscarEstudiante} style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
              <input style={localStyles.input} placeholder="Buscar..." value={busquedaEstudiante} onChange={e=>setBusquedaEstudiante(e.target.value)} />
              <button type="submit" style={localStyles.primaryBtn}>🔍 Buscar</button>
            </form>
            {resultadosBusqueda.map(r => (
              <div key={r.id} onClick={()=>seleccionarEstudiante(r)} style={{padding:'10px', borderBottom:'1px solid #eee', cursor:'pointer'}}>
                <strong>{r.nombres_apellidos}</strong> - {r.dni}
              </div>
            ))}
            {estudianteEditando && (
              <div style={{marginTop:'20px', padding:'15px', backgroundColor:'#f8fafc', borderRadius:'8px'}}>
                <h4>Editando: {estudianteEditando.nombres_apellidos}</h4>
                <div style={{display:'grid', gap:'10px', gridTemplateColumns:'1fr 1fr'}}>
                  <input style={localStyles.input} value={formEstudiante.dni} onChange={e=>setFormEstudiante({...formEstudiante, dni: e.target.value})} placeholder="DNI" />
                  <input style={localStyles.input} value={formEstudiante.telefono} onChange={e=>setFormEstudiante({...formEstudiante, telefono: e.target.value})} placeholder="Teléfono" />
                  <select style={localStyles.input} value={formEstudiante.tutor_id} onChange={e=>setFormEstudiante({...formEstudiante, tutor_id: e.target.value})}>
                    <option value="">Seleccionar Tutor</option>
                    {tutores.map(t => <option key={t.id} value={t.id}>{t.nombres_apellidos}</option>)}
                  </select>
                </div>
                <button onClick={guardarCambiosEstudiante} style={{...localStyles.primaryBtn, marginTop:'10px'}}>Guardar Cambios</button>
              </div>
            )}
          </div>
        )}

        {tab === 'notificaciones' && (
          <div style={localStyles.card}>
            <h3>Envío Masivo WhatsApp</h3>
            {!modoEnvioActivo ? (
              <div style={{textAlign:'center', padding:'30px'}}>
                <p>Pendientes: <strong>{listaNotificaciones.length}</strong></p>
                <button onClick={()=>setModoEnvioActivo(true)} style={localStyles.primaryBtn}>🚀 Iniciar Cola</button>
              </div>
            ) : (
              <div style={{textAlign:'center'}}>
                <button onClick={()=>setModoEnvioActivo(false)} style={{marginBottom:'20px'}}>Cancelar</button>
                {siguienteEnCola ? (
                  <div style={{padding:'30px', border:'2px dashed #ccc', borderRadius:'10px'}}>
                    <h2>{siguienteEnCola.estudiante}</h2>
                    <p>📱 {siguienteEnCola.telefono}</p>
                    <button onClick={()=>enviarWhatsApp(siguienteEnCola)} style={{...localStyles.primaryBtn, backgroundColor:'#25D366'}}>📲 Enviar</button>
                    <p style={{marginTop:'10px', fontSize:'12px'}}>{progreso} / {total}</p>
                  </div>
                ) : <p>✅ ¡Todos enviados!</p>}
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL LEGAJO */}
      {mostrarModalLegajo && (
        <div style={localStyles.modalOverlay}>
          <div style={localStyles.modalContent}>
            <h3>Legajo: {tutorSeleccionado?.nombres_apellidos}</h3>
            <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px', margin:'20px 0'}}>
              {resumenLegajo.map((r, i) => (
                <div key={i} style={{border:'1px solid #ddd', padding:'10px', textAlign:'center', borderRadius:'5px'}}>
                  <strong>{r.tipo}</strong><br/>{r.cantidad}
                </div>
              ))}
            </div>
            <button onClick={manejarDescargaConsolidado} disabled={cargandoReporte} style={localStyles.primaryBtn}>
              {cargandoReporte ? 'Generando...' : 'Descargar Consolidado PDF'}
            </button>
            <button onClick={()=>setMostrarModalLegajo(false)} style={{marginLeft:'10px'}}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- ESTILOS SIN SIDEBAR LATERAL (SOLO CONTENIDO) ---
const localStyles = {
  // Eliminamos display flex para que ocupe el ancho del contenedor padre
  container: { padding: '20px', backgroundColor: '#f8fafc', minHeight: '100%' },
  
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: 0 },
  subtitle: { fontSize: '14px', color: '#64748b', margin: 0 },
  cycleBadge: { padding: '5px 12px', backgroundColor: '#eff6ff', color: '#1d4ed8', borderRadius: '20px', fontSize: '13px', fontWeight: '600' },

  // Barra de navegación superior (Tabs)
  navBar: { display: 'flex', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '25px', overflowX: 'auto' },
  tab: { padding: '10px 16px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: '600', fontSize: '14px', borderRadius: '6px', whiteSpace: 'nowrap' },
  tabActive: { padding: '10px 16px', backgroundColor: '#0f172a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', whiteSpace: 'nowrap' },

  content: { animation: 'fadeIn 0.3s' },

  // Grillas y Tarjetas
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' },
  statCard: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', textAlign: 'center', border: '1px solid #e2e8f0' },
  statNumber: { fontSize: '36px', fontWeight: '800', color: '#0f172a', marginBottom: '5px' },
  statLabel: { fontSize: '13px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' },

  card: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '20px', border: '1px solid #e2e8f0' },
  
  // Tablas
  tableContainer: { backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #e2e8f0' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  trHead: { backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  th: { padding: '15px', textAlign: 'left', color: '#475569', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '15px', color: '#334155', verticalAlign: 'middle' },
  
  // Botones y Elementos
  primaryBtn: { backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' },
  btnRefresh: { backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', color: '#475569', fontSize: '13px', fontWeight: '600' },
  actionBtn: { padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer' },
  input: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' },
  badge: { padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },

  // Modal
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  modalContent: { backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '600px', maxWidth: '90%' }
};

export default AdminDashboard;