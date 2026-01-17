import React, { useState, useEffect } from 'react';
import TablaEstudiantes from './TablaEstudiantes';
import ModalFichaIntegral from './ModalFichaIntegral';
import ModalHistorial from './ModalHistorial'; 
import api from '../api/axios';
import { toast } from 'sonner';
import Swal from 'sweetalert2'; // Librería para el Modal de Bloqueo
import { generarF01 } from '../utils/generadorF01';

// --- UTILIDADES DE FECHA Y HORA ---
const formatearFechaSegura = (fechaRaw) => {
    if (!fechaRaw) return "---";
    try {
        const fecha = new Date(fechaRaw);
        return new Intl.DateTimeFormat('es-PE', {
            day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Lima' 
        }).format(fecha);
    } catch (error) { return "Pend."; }
};

const esFechaHoy = (fechaRaw) => {
    if (!fechaRaw) return false;
    try {
        const options = { timeZone: 'America/Lima', year: 'numeric', month: 'numeric', day: 'numeric' };
        const fechaRegistro = new Intl.DateTimeFormat('es-PE', options).format(new Date(fechaRaw));
        const fechaHoy = new Intl.DateTimeFormat('es-PE', options).format(new Date());
        return fechaRegistro === fechaHoy;
    } catch (e) { return false; }
};

export default function DashboardMaestro({
    user, 
    estudiantes = [], 
    onNuevaSesion, 
    onVerHistorial, 
    onDerivar,
    onNuevaFichaIntegral, 
    onEditarFicha, 
    onDescargarPDF, 
    onEliminarRegistro,
    onAbrirModalGrupal,
    onNuevaFichaEntrevista,
    bloqueado // <--- 🔒 RECIBIMOS EL ESTADO DE BLOQUEO DESDE APP.JSX
}) {
    // --- ESTADOS ---
    const [enfoqueDerecho, setEnfoqueDerecho] = useState(null);
    const [ultimoRegistro, setUltimoRegistro] = useState([]);
    const [agendaHoy, setAgendaHoy] = useState([]);

    // Estados Modales
    const [mostrarModalF01, setMostrarModalF01] = useState(false);
    const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
    const [estudianteParaFicha, setEstudianteParaFicha] = useState(null);
    const [estudianteParaHistorial, setEstudianteParaHistorial] = useState(null);
    const [sesionF01Editar, setSesionF01Editar] = useState(null);

    // Estados UI
    const [terminoBusqueda, setTerminoBusqueda] = useState('');
    const [filtroEscuela, setFiltroEscuela] = useState('Todas');
    const [filtroRapido, setFiltroRapido] = useState('Todos');
    const [modalCambioClave, setModalCambioClave] = useState(false);
    const [nuevaClave, setNuevaClave] = useState("");
    
    const escuelasDisponibles = ["Todas", "Ingeniería de Sistemas", "Administración", "Contabilidad", "Educación"];

    // --- EFECTO: MODAL DE BLOQUEO AL ENTRAR (AGRESIVO) ---
    useEffect(() => {
        if (bloqueado) {
            Swal.fire({
                title: '🔒 ACCESO RESTRINGIDO',
                html: `
                    <div style="text-align:left; color:#334155; font-size:14px;">
                        <p>Estimado Docente, usted ya ha <strong>remitido su informe final</strong>.</p>
                        <p>El sistema se encuentra en modo <b>"Solo Lectura"</b> para auditoría.</p>
                        <div style="background:#eff6ff; padding:10px; border-radius:6px; border:1px solid #bfdbfe; margin:10px 0;">
                            <ul style="margin:0; padding-left:20px; color:#1e40af;">
                                <li>🚫 No puede registrar nuevas sesiones.</li>
                                <li>🚫 No puede editar fichas.</li>
                                <li>🚫 No puede realizar derivaciones.</li>
                            </ul>
                        </div>
                        <p style="font-size:13px; color:#dc2626; font-weight:bold;">
                            * Si necesita corregir algo, solicite al Administrador que le "Devuelva" el informe.
                        </p>
                    </div>
                `,
                icon: 'warning',
                confirmButtonText: 'Entendido, modo lectura',
                confirmButtonColor: '#64748b', 
                allowOutsideClick: false, 
                allowEscapeKey: false,    
                backdrop: `rgba(15, 23, 42, 0.8)` 
            });
        }
    }, [bloqueado]);

    // --- EFECTO: VERIFICAR CLAVE ---
    useEffect(() => {
        const usuarioStr = String(user?.usuario || "");
        const claveStr = String(user?.clave || "");
        const hashStr = String(user?.password_hash || "");

        if (usuarioStr && (usuarioStr === claveStr || usuarioStr === hashStr)) {
            setModalCambioClave(true);
        } else {
            setModalCambioClave(false);
        }
    }, [user]);

    // --- EFECTO: PROCESAR DATOS ---
    useEffect(() => {
        const listaValida = Array.isArray(estudiantes) ? estudiantes : [];
        if (listaValida.length > 0) {
            const ordenados = [...listaValida].sort((a, b) => {
                const fechaA = (a.sesiones?.length > 0 && (a.sesiones[0].fecha || a.sesiones[0].fecha_solicitud)) ? new Date(a.sesiones[0].fecha || a.sesiones[0].fecha_solicitud) : new Date(0);
                const fechaB = (b.sesiones?.length > 0 && (b.sesiones[0].fecha || b.sesiones[0].fecha_solicitud)) ? new Date(b.sesiones[0].fecha || b.sesiones[0].fecha_solicitud) : new Date(0);
                return fechaB - fechaA;
            });
            setUltimoRegistro(ordenados);

            const agenda = [];
            listaValida.forEach(est => {
                est.sesiones?.forEach(ses => {
                    if (esFechaHoy(ses.fecha || ses.fecha_solicitud)) {
                        let titulo = ses.titulo_visual || ses.tipo_formato || 'Sesión';
                        if (ses.tipo_formato === 'F03' && !ses.titulo_visual) titulo = 'F03 - Entrevista';
                        agenda.push({ ...ses, estudiante: est, titulo_agenda: titulo });
                    }
                });
            });
            setAgendaHoy(agenda);
            
            if (enfoqueDerecho) {
               const actualizado = listaValida.find(e => e.id === enfoqueDerecho.id);
               if (actualizado) setEnfoqueDerecho(actualizado);
            }
            if (mostrarModalHistorial && estudianteParaHistorial) {
               const actualizado = listaValida.find(e => e.id === estudianteParaHistorial.id);
               if (actualizado) setEstudianteParaHistorial(actualizado);
            }
        }
    }, [estudiantes, user]);

    // --- FUNCIONES PROTEGIDAS CON BLOQUEO ---
    const eliminarSesion = async (idSesion) => {
        if (bloqueado) return Swal.fire('Bloqueado', 'Panel en modo lectura.', 'error');
        if (!idSesion) return toast.error("ID no válido");
        
        const sesionEncontrada = estudianteParaHistorial?.sesiones?.find(s => s.id === idSesion) || enfoqueDerecho?.sesiones?.find(s => s.id === idSesion);
        const registroAEliminar = sesionEncontrada || { id: idSesion, tipo_formato: 'F04' };

        if (mostrarModalHistorial && estudianteParaHistorial) {
            setEstudianteParaHistorial(prev => ({ ...prev, sesiones: prev.sesiones ? prev.sesiones.filter(s => s.id !== idSesion) : [] }));
        }
        if (enfoqueDerecho) {
            setEnfoqueDerecho(prev => ({ ...prev, sesiones: prev.sesiones ? prev.sesiones.filter(s => s.id !== idSesion) : [] }));
        }

        if (onEliminarRegistro) {
            await onEliminarRegistro(registroAEliminar);
        } else {
            try { await api.delete(`/sesiones/${idSesion}`); toast.success("Registro eliminado"); } catch(e) { console.error(e); }
        }
    };

    const abrirExpediente = async (estudiante) => {
        if (!estudiante) return;
        try {
            const { data: historial } = await api.get(`/sesiones/${estudiante.id}`);
            const fichaExistente = historial.find(s => s.tipo_formato === 'F01');
            let datosParaModal = { ...estudiante }; 

            if (fichaExistente) {
                let contenidoGuardado = {};
                try {
                    contenidoGuardado = typeof fichaExistente.desarrollo_entrevista === 'string'
                        ? JSON.parse(fichaExistente.desarrollo_entrevista)
                        : (fichaExistente.desarrollo_entrevista || {});
                } catch (e) { }

                datosParaModal = {
                    ...estudiante, ...contenidoGuardado,
                    id: fichaExistente.id,
                    estudiante_id: estudiante.id,
                    firma_tutor_url: fichaExistente.firma_tutor_url || contenidoGuardado.firma_tutor_url,
                    firma_estudiante_url: fichaExistente.firma_estudiante_url || contenidoGuardado.firma_estudiante_url,
                    familiares: Array.isArray(contenidoGuardado.familiares) ? contenidoGuardado.familiares : []
                };
                setSesionF01Editar(fichaExistente);
            } else {
                setSesionF01Editar(null);
                datosParaModal.familiares = [];
            }
            setEstudianteParaFicha(datosParaModal);
            setMostrarModalF01(true);
        } catch (error) {
            console.error("Error cargando ficha:", error);
            setEstudianteParaFicha({ ...estudiante, familiares: [] });
            setSesionF01Editar(null);
            setMostrarModalF01(true);
        }
    };
    
    const abrirHistorialLocal = (estudiante) => {
        setEstudianteParaHistorial(estudiante);
        setMostrarModalHistorial(true);
    };
    
    const refrescarDatosHistorial = async () => {
       if (!estudianteParaHistorial) return;
       try {
           const { data } = await api.get(`/sesiones/${estudianteParaHistorial.id}`);
           setEstudianteParaHistorial(prev => ({ ...prev, sesiones: data }));
           if (enfoqueDerecho && enfoqueDerecho.id === estudianteParaHistorial.id) {
               setEnfoqueDerecho(prev => ({ ...prev, sesiones: data }));
           }
       } catch (error) { console.error("Error al refrescar historial:", error); }
    };

    const guardarFichaF01 = async (datosFicha) => {
        if (bloqueado) return Swal.fire('Bloqueado', 'Panel en modo lectura.', 'error');
        
        try {
            const idEstudiante = parseInt(estudianteParaFicha?.id);
            const idTutor = parseInt(user?.tutor_id || user?.id);
            
            let datosCompletos = { ...datosFicha };
            if (typeof datosFicha.desarrollo_entrevista === 'string') {
                try { datosCompletos = { ...datosCompletos, ...JSON.parse(datosFicha.desarrollo_entrevista) }; } catch (e) {}
            }
            if (!Array.isArray(datosCompletos.familiares)) datosCompletos.familiares = [];

            const idSesion = sesionF01Editar?.id || datosFicha.id || null;
            const payload = {
                id: idSesion, estudiante_id: idEstudiante, tutor_id: idTutor,
                tipo_formato: 'F01', motivo_consulta: 'Ficha Integral', fecha: new Date().toISOString(),
                acuerdos_compromisos: datosCompletos.acuerdos_compromisos || "",
                observaciones: datosCompletos.observaciones || "",
                firma_tutor_url: datosCompletos.firma_tutor_url, firma_estudiante_url: datosCompletos.firma_estudiante_url,
                desarrollo_entrevista: datosCompletos
            };

            if (idSesion) await api.put(`/sesiones/${idSesion}`, payload);
            else await api.post('/sesiones', payload);

            toast.success("Ficha guardada");
            setMostrarModalF01(false);
            setTimeout(() => { if(onEliminarRegistro) window.location.reload(); }, 800);
        } catch (error) { toast.error("Error guardando ficha"); }
    };
    
    const guardarNuevaClave = async (e) => {
        e.preventDefault();
        if (nuevaClave.length < 6) return toast.warning("Mínimo 6 caracteres");
        try {
            await api.post('/cambiar-clave', { usuario_id: user.id, nueva_clave: nuevaClave });
            toast.success("Clave actualizada");
            setModalCambioClave(false);
            localStorage.removeItem('usuario');
            setTimeout(() => { window.location.href = '/'; }, 1500);
        } catch (error) { toast.error("Error al actualizar."); }
    };

    // --- FILTROS ---
    const estudiantesFiltrados = (Array.isArray(estudiantes) ? estudiantes : []).filter(est => {
        const txt = est.nombres_apellidos?.toLowerCase().includes(terminoBusqueda.toLowerCase()) || est.codigo_estudiante?.includes(terminoBusqueda);
        const esc = filtroEscuela === 'Todas' || est.escuela_profesional === filtroEscuela;
        let chip = true;
        if (filtroRapido === 'Riesgo') chip = est.sesiones?.some(s => s.tipo_formato === 'F05');
        else if (filtroRapido === 'FaltaF01') chip = !est.sesiones?.some(s => s.tipo_formato === 'F01');
        return txt && esc && chip;
    });

    const totalEstudiantes = estudiantesFiltrados.length;
    const f01Completados = estudiantesFiltrados.filter(e => e.sesiones?.some(s => s.tipo_formato === 'F01')).length;
    const totalEntrevistas = estudiantesFiltrados.reduce((acc, curr) => acc + (curr.sesiones?.filter(s => s.tipo_formato === 'F03').length || 0), 0);
    const casosRiesgo = estudiantesFiltrados.filter(e => e.sesiones?.some(s => s.tipo_formato === 'F05' || s.tipo_formato === 'Derivación')).length;

    const sesiones = enfoqueDerecho?.sesiones || [];
    const fichaF01 = sesiones.find(s => s.tipo_formato === 'F01');
    
    return (
        <div style={styles.dashboardContainer}>
            {/* Header */}
            <div style={styles.headerRow}>
                <div><h2 style={styles.pageTitle}>Panel de Control</h2><p style={styles.pageSubtitle}>Bienvenido, Ing. {user.nombres_apellidos}</p></div>
                <div style={styles.searchContainer}>
                    <span style={{ fontSize: '14px', marginRight: '8px', color: '#94a3b8' }}>🔍</span>
                    <input type="text" placeholder="Buscar estudiante..." style={styles.searchInput} value={terminoBusqueda} onChange={(e) => setTerminoBusqueda(e.target.value)} />
                </div>
            </div>

            {/* --- ESCUDO DE BLOQUEO (BANNER VISIBLE SIEMPRE SI ESTÁ BLOQUEADO) --- */}
            {bloqueado && (
                <div style={styles.bannerBloqueo}>
                    <div style={{ fontSize: '36px', marginRight: '20px' }}>🛡️</div>
                    <div>
                        <h3 style={{ margin: '0 0 5px 0', color: '#1e3a8a', fontSize:'18px' }}>PANEL BLOQUEADO POR ENVÍO</h3>
                        <p style={{ margin: 0, fontSize: '14px', color: '#1e40af', lineHeight: '1.4' }}>
                            Usted ya ha remitido su informe semestral. El sistema está en <strong>"Solo Lectura"</strong>.<br/>
                            <em>Para desbloquear, solicite al Administrador la devolución de su informe.</em>
                        </p>
                    </div>
                </div>
            )}

            {/* KPIs */}
            <div style={styles.kpiGrid}>
                <KpiCard label="Total Tutorados" value={totalEstudiantes} icon="👥" color="#3b82f6" bg="#eff6ff" trend="up" />
                <KpiCard label="F01 Completos" value={f01Completados} icon="✅" color="#10b981" bg="#ecfdf5" trend="up" />
                <KpiCard label="Entrevistas" value={totalEntrevistas} icon="💬" color="#f59e0b" bg="#fffbeb" trend="flat" />
                <KpiCard label="Casos Riesgo" value={casosRiesgo} icon="⚠️" color="#ef4444" bg="#fef2f2" trend="down" />
            </div>

            {/* Main */}
            <div style={styles.mainSection}>
                <div style={styles.tablePanel}>
                    <div style={styles.panelHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <h3 style={styles.panelTitle}>Estudiantes</h3>
                            <div style={styles.chipContainer}>
                                <Chip label="Todos" active={filtroRapido === 'Todos'} onClick={() => setFiltroRapido('Todos')} />
                                <Chip label="⚠️ Riesgo" active={filtroRapido === 'Riesgo'} onClick={() => setFiltroRapido('Riesgo')} color="#ef4444" />
                                <Chip label="📝 Falta F01" active={filtroRapido === 'FaltaF01'} onClick={() => setFiltroRapido('FaltaF01')} color="#f59e0b" />
                            </div>
                        </div>
                        <div style={styles.panelActions}>
                            <select value={filtroEscuela} onChange={(e) => setFiltroEscuela(e.target.value)} style={styles.selectFilter}>{escuelasDisponibles.map(e => <option key={e} value={e}>{e}</option>)}</select>
                            
                            {/* BOTÓN GRUPAL BLOQUEADO */}
                            <button 
                                onClick={onAbrirModalGrupal} 
                                disabled={bloqueado} 
                                style={{
                                    ...styles.btnPrimary, 
                                    backgroundColor: bloqueado ? '#94a3b8' : '#0f172a',
                                    cursor: bloqueado ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {bloqueado ? '🔒 Bloqueado' : '+ Grupal'}
                            </button>
                        </div>
                    </div>
                    <div style={styles.tableContainer}>
                        {/* PASAMOS EL CANDADO A LA TABLA */}
                        <TablaEstudiantes
                            estudiantes={estudiantesFiltrados}
                            bloqueado={bloqueado} 
                            onSeleccionar={(est) => { setEnfoqueDerecho(est); }}
                            estudianteActivoId={enfoqueDerecho?.id}
                            onNuevaSesion={onNuevaSesion}
                            onVerHistorial={abrirHistorialLocal} 
                            onDerivar={onDerivar}
                            onNuevaFichaIntegral={abrirExpediente} 
                            onNuevaFichaEntrevista={onNuevaFichaEntrevista}
                        />
                    </div>
                </div>

                <div style={styles.rightColumn}>
                    {/* Agenda y Feed */}
                    <div style={styles.agendaPanel}>
                        <div style={styles.panelHeaderSimple}><h3 style={styles.panelTitle}>📅 Agenda de Hoy</h3></div>
                        <div style={styles.agendaList}>
                            {agendaHoy.length > 0 ? (agendaHoy.map((evt, i) => (
                                <div key={i} style={styles.agendaItem}>
                                    <div style={styles.timeBadge}>HOY</div>
                                    <div>
                                        <div style={styles.agendaTitle}>{evt.estudiante.nombres_apellidos}</div>
                                        <div style={styles.agendaSub}>{evt.titulo_agenda || evt.titulo_visual || evt.tipo_formato || 'Sesión'}</div>
                                    </div>
                                </div>
                            ))) : (<div style={styles.emptyAgenda}><span style={{ fontSize: '24px', marginBottom: '5px' }}>☕</span>No hay sesiones para hoy</div>)}
                        </div>
                    </div>
                    <div style={styles.feedPanel}>
                        <div style={styles.panelHeaderSimple}><h3 style={styles.panelTitle}>🕒 Reciente</h3></div>
                        <div style={styles.timelineContainer}>
                            {ultimoRegistro.slice(0, 5).map((reg, index) => (
                                <div key={`feed-${reg.id}`} style={styles.timelineItem}>
                                    <div style={styles.timelineLeft}><div style={styles.timelineDot}></div>{index !== 4 && <div style={styles.timelineLine}></div>}</div>
                                    <div style={styles.timelineContent}>
                                        <div style={styles.feedTitle}>{reg.sesiones?.[0]?.titulo_visual || reg.sesiones?.[0]?.tipo_formato || 'Actualización'}</div>
                                        <div style={styles.feedUser}>{reg.nombres_apellidos}</div>
                                        <div style={styles.feedDate}>{formatearFechaSegura(reg.sesiones?.[0]?.fecha)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* DRAWER - PERFIL DEL ESTUDIANTE */}
            {enfoqueDerecho && (
                <div style={styles.drawerOverlay}>
                    <div style={styles.drawerContainer}>
                        <div style={styles.drawerHeader}>
                            <h3 style={styles.drawerTitle}>📂 Perfil del Estudiante</h3>
                            <button onClick={() => setEnfoqueDerecho(null)} style={styles.closeBtn}>✕</button>
                        </div>
                        
                        <div style={styles.drawerContent}>
                            <div style={styles.profileSection}>
                                <div style={styles.bigAvatar}>{enfoqueDerecho.nombres_apellidos.charAt(0)}</div>
                                <div>
                                    <div style={{ fontWeight: '800', fontSize: '15px', color: '#1e293b' }}>
                                        {enfoqueDerecho.nombres_apellidos}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                                        Cod: <strong>{enfoqueDerecho.codigo_estudiante}</strong>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                        {enfoqueDerecho.escuela_profesional || "Ingeniería de Sistemas"}
                                    </div>
                                </div>
                            </div>

                            <div style={styles.actionRow}>
                                <button 
                                    onClick={() => onNuevaFichaEntrevista(enfoqueDerecho)} 
                                    disabled={bloqueado}
                                    style={{...styles.btnAction, opacity: bloqueado ? 0.5 : 1, cursor: bloqueado ? 'not-allowed' : 'pointer'}}
                                >
                                    💬 Entrevista
                                </button>
                                <button 
                                    onClick={() => abrirHistorialLocal(enfoqueDerecho)} 
                                    style={styles.btnActionSec}
                                >
                                    🕒 Historial
                                </button>
                            </div>

                            <div style={styles.divider} />

                            {fichaF01 ? (() => {
                                let datos = {};
                                try { 
                                    datos = typeof fichaF01.desarrollo_entrevista === 'string' 
                                        ? JSON.parse(fichaF01.desarrollo_entrevista) 
                                        : (fichaF01.desarrollo_entrevista || {}); 
                                } catch (e) {}

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div style={styles.infoCard}>
                                            <div style={styles.cardHeader}>📞 Contacto</div>
                                            <div style={styles.infoGrid}>
                                                <div><label style={styles.infoLabel}>Celular</label><div style={styles.infoValue}>{datos.celular || datos.telefono || '--'}</div></div>
                                                
                                                {/* CORRECCIÓN: VISUALIZACIÓN ROBUSTA DEL CORREO */}
                                                <div>
                                                    <label style={styles.infoLabel}>Correo</label>
                                                    <div style={styles.infoValue}>
                                                        {datos.correo || datos.email || enfoqueDerecho.correo || enfoqueDerecho.email || enfoqueDerecho.correo_institucional || '--'}
                                                    </div>
                                                </div>

                                                <div style={{gridColumn: 'span 2'}}><label style={styles.infoLabel}>Dirección</label><div style={styles.infoValue}>{datos.direccion_actual || datos.direccion || '--'}</div></div>
                                            </div>
                                        </div>

                                        <div style={styles.infoCard}>
                                            <div style={styles.cardHeader}>👤 Datos Personales</div>
                                            <div style={styles.infoGrid}>
                                                <div><label style={styles.infoLabel}>DNI</label><div style={styles.infoValue}>{enfoqueDerecho.dni}</div></div>
                                                <div><label style={styles.infoLabel}>Fecha Nac.</label><div style={styles.infoValue}>{formatearFechaSegura(datos.fecha_nacimiento)}</div></div>
                                                <div><label style={styles.infoLabel}>Estado Civil</label><div style={styles.infoValue}>{datos.estado_civil || 'Soltero(a)'}</div></div>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => abrirExpediente(enfoqueDerecho)}
                                            disabled={bloqueado}
                                            style={{ 
                                                width: '100%', padding: '10px', 
                                                backgroundColor: '#fff', border: '1px dashed #cbd5e1', 
                                                color: '#64748b', borderRadius: '8px', cursor: bloqueado ? 'not-allowed' : 'pointer',
                                                fontSize: '12px', fontWeight: '600', marginTop: '10px', opacity: bloqueado ? 0.6 : 1
                                            }}
                                        >
                                            {bloqueado ? '🔒 Ficha Bloqueada' : '✏️ Actualizar Ficha Integral'}
                                        </button>
                                    </div>
                                );
                            })() : (
                                <div style={{ textAlign: 'center', padding: '30px 20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                                    <div style={{ fontSize: '30px', marginBottom: '10px' }}>📄</div>
                                    <h4 style={{ margin: '0 0 5px 0', color: '#334155' }}>Sin Ficha Integral</h4>
                                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 15px 0' }}>El estudiante aún no ha registrado sus datos personales.</p>
                                    <button 
                                        onClick={() => abrirExpediente(enfoqueDerecho)} 
                                        disabled={bloqueado}
                                        style={{...styles.btnAction, opacity: bloqueado ? 0.5 : 1, cursor: bloqueado ? 'not-allowed' : 'pointer'}}
                                    >
                                        {bloqueado ? '🔒 Bloqueado' : '+ Crear Ficha F01'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODALES */}
            {mostrarModalF01 && estudianteParaFicha && <ModalFichaIntegral estudiante={estudianteParaFicha} user={user} sesionAEditar={sesionF01Editar} onClose={() => { setMostrarModalF01(false); setEstudianteParaFicha(null); setSesionF01Editar(null); }} onGuardar={guardarFichaF01} />}
            
            {mostrarModalHistorial && estudianteParaHistorial && (
                <ModalHistorial 
                    estudiante={estudianteParaHistorial}
                    historial={estudianteParaHistorial.sesiones || []}
                    onClose={() => setMostrarModalHistorial(false)}
                    onEliminar={eliminarSesion} 
                    onRefrescar={refrescarDatosHistorial} 
                    onEditar={(ses) => { 
                        if (bloqueado) {
                            return Swal.fire('Bloqueado', 'El panel está en modo lectura.', 'error');
                        }
                        if (ses.tipo_formato === 'F01') abrirExpediente(estudianteParaHistorial);
                        else if (ses.tipo_formato === 'F02') { if (onEditarFicha) onEditarFicha(ses, estudianteParaHistorial); }
                        else if (ses.tipo_formato === 'F03') { if (onEditarFicha) onEditarFicha(ses, estudianteParaHistorial); }
                        else if (ses.tipo_formato === 'F05' || ses.tipo_formato === 'Derivación') {
                            if (onDerivar) onDerivar(estudianteParaHistorial, ses);
                        }
                        else {
                            toast.info("Edición rápida no disponible aquí");
                        }
                    }}
                />
            )}

            {modalCambioClave && (
                <div style={styles.securityOverlay}>
                    <div style={styles.securityModal}>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}><div style={{ fontSize: '40px' }}>🛡️</div><h2 style={{ color: '#1e293b', margin: '10px 0' }}>Seguridad de la Cuenta</h2><p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>Por políticas de seguridad, detectamos que usas tu DNI como contraseña.<br />Debes crear una nueva clave personal para continuar.</p></div>
                        <form onSubmit={guardarNuevaClave}><label style={styles.securityLabel}>Nueva Contraseña</label><input type="password" placeholder="Ingresa tu nueva clave secreta" value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} style={styles.securityInput} autoFocus /><button type="submit" style={styles.btnSecuritySave}>💾 Actualizar y Entrar</button></form>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- ESTILOS IGUALES AL ORIGINAL ---
const Chip = ({ label, active, onClick, color = '#3b82f6' }) => (<button onClick={onClick} style={{ padding: '6px 12px', borderRadius: '20px', border: active ? `1px solid ${color}` : '1px solid #e2e8f0', backgroundColor: active ? `${color}15` : 'white', color: active ? color : '#64748b', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>{label}</button>);
const KpiCard = ({ label, value, icon, color, bg, trend }) => (<div style={styles.kpiCard}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><div style={styles.kpiValue}>{value}</div><div style={styles.kpiLabel}>{label}</div></div><div style={{ ...styles.kpiIcon, backgroundColor: bg, color: color }}>{icon}</div></div><div style={{ marginTop: '10px', height: '4px', width: '100%', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}><div style={{ height: '100%', width: trend === 'up' ? '70%' : '40%', backgroundColor: color, opacity: 0.6 }}></div></div></div>);

const styles = {
    dashboardContainer: { padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', height: '100%', width: '100%', boxSizing: 'border-box', overflow: 'hidden' },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
    pageTitle: { margin: 0, fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' },
    pageSubtitle: { margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' },
    searchContainer: { display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    searchInput: { border: 'none', outline: 'none', fontSize: '14px', color: '#334155', width: '220px' },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' },
    kpiCard: { backgroundColor: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    kpiIcon: { width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' },
    kpiValue: { fontSize: '24px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2' },
    kpiLabel: { fontSize: '12px', color: '#64748b', fontWeight: '500' },
    mainSection: { display: 'flex', gap: '20px', flex: 1, minHeight: 0, width: '100%' },
    tablePanel: { flex: 3, backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' },
    panelHeader: { padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    panelTitle: { margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b' },
    chipContainer: { display: 'flex', gap: '8px' },
    panelActions: { display: 'flex', gap: '10px' },
    selectFilter: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' },
    btnPrimary: { color: 'white', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'background 0.2s' },
    tableContainer: { flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' },
    rightColumn: { flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' },
    agendaPanel: { backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', maxHeight: '45%' },
    agendaList: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', overflowY: 'auto', maxHeight: '320px', paddingRight: '5px' },
    agendaItem: { display: 'flex', gap: '12px', alignItems: 'center', padding: '8px', borderRadius: '8px', backgroundColor: '#f8fafc', borderLeft: '3px solid #3b82f6', flexShrink: 0 },
    timeBadge: { fontSize: '10px', fontWeight: '800', color: '#3b82f6', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' },
    agendaTitle: { fontSize: '12px', fontWeight: '700', color: '#334155' },
    agendaSub: { fontSize: '11px', color: '#64748b' },
    emptyAgenda: { fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    feedPanel: { backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', flex: 1, overflowY: 'auto', minHeight: '200px' },
    panelHeaderSimple: { paddingBottom: '10px', borderBottom: '1px solid #f1f5f9', marginBottom: '10px' },
    timelineContainer: { display: 'flex', flexDirection: 'column', marginTop: '5px' },
    timelineItem: { display: 'flex', gap: '10px', minHeight: '50px' },
    timelineLeft: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '16px' },
    timelineDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#cbd5e1', marginTop: '5px' },
    timelineLine: { width: '1px', flex: 1, backgroundColor: '#e2e8f0', marginTop: '2px' },
    timelineContent: { paddingBottom: '15px' },
    feedTitle: { fontSize: '12px', fontWeight: '600', color: '#334155' },
    feedUser: { fontSize: '11px', color: '#64748b' },
    feedDate: { fontSize: '10px', color: '#94a3b8' },
    drawerOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' },
    drawerContainer: { width: '400px', backgroundColor: 'white', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-5px 0 25px rgba(0,0,0,0.1)' },
    drawerHeader: { padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    drawerTitle: { margin: 0, fontSize: '16px', fontWeight: '700' },
    closeBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' },
    drawerContent: { flex: 1, padding: '20px', overflowY: 'auto' },
    profileSection: { display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' },
    bigAvatar: { width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold' },
    actionRow: { display: 'flex', gap: '10px', marginBottom: '20px' },
    btnAction: { flex: 1, padding: '8px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
    btnActionSec: { flex: 1, padding: '8px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
    divider: { height: '1px', backgroundColor: '#e2e8f0', marginBottom: '20px' },
    infoCard: { backgroundColor: '#fff', borderRadius: '10px', padding: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' },
    cardHeader: { fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', marginBottom: '10px', letterSpacing: '0.5px' },
    infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', rowGap: '15px' },
    infoLabel: { display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: '600', marginBottom: '2px' },
    infoValue: { fontSize: '13px', color: '#1e293b', fontWeight: '500', wordBreak: 'break-word' },
    
    // ESTILO DEL ESCUDO (Banner)
    bannerBloqueo: { 
        backgroundColor: '#eff6ff', color: '#1e3a8a', padding: '20px', borderRadius: '12px', 
        border: '2px solid #bfdbfe', marginBottom: '25px', display: 'flex', alignItems: 'center',
        boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)'
    },
    securityOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(5px)' },
    securityModal: { backgroundColor: 'white', padding: '40px', borderRadius: '16px', width: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
    securityLabel: { display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#334155', fontSize: '13px' },
    securityInput: { width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #e2e8f0', marginBottom: '20px', fontSize: '16px', boxSizing: 'border-box' },
    btnSecuritySave: { width: '100%', backgroundColor: '#0f172a', color: 'white', padding: '14px', borderRadius: '8px', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
};