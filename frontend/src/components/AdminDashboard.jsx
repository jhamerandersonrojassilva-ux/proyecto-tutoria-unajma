import React, { useState, useEffect } from 'react';
import TutorManager from './TutorManager';
import BulkAsignacion from './BulkAsignacion';
import api from '../api/axios'; 
import { toast } from 'sonner'; 
import { generarPDFConsolidado } from '../utils/generadorConsolidado';
import Swal from 'sweetalert2'; 

// URL BASE PARA DESCARGAS (Ajusta si tu puerto cambia)
const BASE_URL = 'http://localhost:3001';

const AdminDashboard = () => {
  // --- ESTADOS PRINCIPALES ---
  const [tab, setTab] = useState('ciclos');
  const [roles, setRoles] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [ciclos, setCiclos] = useState([]); 
  const [cicloActivo, setCicloActivo] = useState(null);
  const [seguimiento, setSeguimiento] = useState([]);

  // --- ESTADOS PARA GESTIÓN DE CICLOS ---
  const [nuevoCiclo, setNuevoCiclo] = useState(""); 
  const [cicloEditando, setCicloEditando] = useState(null);
  const [nombreEditado, setNombreEditado] = useState("");

  // --- ESTADOS PARA EDICIÓN DE ESTUDIANTE ---
  const [busquedaEstudiante, setBusquedaEstudiante] = useState("");
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [estudianteEditando, setEstudianteEditando] = useState(null);
  
  const [formEstudiante, setFormEstudiante] = useState({
    nombres: '', dni: '', codigo: '', tutor_id: '', telefono: ''
  });

  // --- ESTADOS PARA NOTIFICACIONES WHATSAPP ---
  const [listaNotificaciones, setListaNotificaciones] = useState([]);
  const [enviadosLocalmente, setEnviadosLocalmente] = useState([]); 
  const [modoEnvioActivo, setModoEnvioActivo] = useState(false);

  // --- ESTADOS PARA MODAL LEGAJO ---
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
        api.get('/roles'), api.get('/tutores'), api.get('/admin/ciclos')
      ]);
      setRoles(resRoles.data);
      setTutores(resTutores.data);
      setCiclos(resCiclos.data); 
      setCicloActivo(resCiclos.data.find(c => c.activo));
    } catch (err) { console.error("Error datos admin:", err); }
  };

  // --- LOGICA NOTIFICACIONES ---
  const cargarNotificaciones = async () => {
    try {
        const res = await api.get('/admin/notificaciones-asignacion');
        setListaNotificaciones(res.data);
        setModoEnvioActivo(false);
    } catch (error) { toast.error("Error cargando lista"); }
  };

  const enviarWhatsApp = (est) => {
    if (!est.telefono || est.telefono.length < 9) {
        const nuevoTel = prompt(`El estudiante ${est.estudiante} no tiene celular registrado. Ingrésalo (9 dígitos):`);
        if (nuevoTel && nuevoTel.length >= 9) {
            api.patch(`/admin/estudiantes/${est.id}/telefono`, { telefono: nuevoTel });
            est.telefono = nuevoTel;
            setListaNotificaciones(prev => 
                prev.map(p => p.id === est.id ? { ...p, telefono: nuevoTel } : p)
            );
        } else {
            return toast.warning("Cancelado: Se requiere un número válido.");
        }
    }

    const mensaje = encodeURIComponent(
        `👋 Hola *${est.estudiante}*.\n\n` +
        `✅ Se te ha asignado un Tutor Académico para el ciclo ${cicloActivo?.nombre_ciclo || 'actual'}.\n` +
        `👨‍🏫 Tutor: *${est.tutor}*\n\n` +
        `Por favor, mantente atento a las indicaciones de tu docente. ¡Éxitos!`
    );

    window.open(`https://web.whatsapp.com/send?phone=51${est.telefono}&text=${mensaje}&app_absent=0`, '_blank');
    setEnviadosLocalmente([...enviadosLocalmente, est.id]);
  };

  const siguienteEnCola = listaNotificaciones.find(est => !enviadosLocalmente.includes(est.id));
  const progreso = enviadosLocalmente.length;
  const total = listaNotificaciones.length;
  const faltanTelefonos = listaNotificaciones.filter(e => !e.telefono || e.telefono.length < 9).length;

  // --- LOGICA BUSQUEDA Y EDICIÓN ---
  const buscarEstudiante = async (e) => {
    e.preventDefault();
    if (!busquedaEstudiante.trim()) return;
    try {
      const res = await api.get(`/admin/estudiantes/buscar?q=${busquedaEstudiante}`);
      setResultadosBusqueda(res.data);
      setEstudianteEditando(null); 
    } catch (error) { toast.error("Error al buscar"); }
  };

  const seleccionarEstudiante = (est) => {
    setEstudianteEditando(est);
    setResultadosBusqueda([]); 
    setBusquedaEstudiante("");
    setFormEstudiante({
        nombres: est.nombres_apellidos,
        dni: est.dni,
        codigo: est.codigo_estudiante,
        tutor_id: est.tutor_asignado_id || "",
        telefono: est.telefono || "" 
    });
  };

  const guardarCambiosEstudiante = async () => {
    if (!estudianteEditando) return;
    if (!formEstudiante.tutor_id) return toast.warning("Debe asignar un tutor");

    try {
      await api.put(`/admin/estudiantes/${estudianteEditando.id}`, {
        ...formEstudiante,
        ciclo_id: cicloActivo?.id 
      });
      toast.success("✅ Datos actualizados correctamente");
      setEstudianteEditando(null);
      setFormEstudiante({ nombres: '', dni: '', codigo: '', tutor_id: '', telefono: '' });
      fetchData(); 
    } catch (error) {
      toast.error(error.response?.data?.error || "Error al actualizar");
    }
  };

  // --- OTROS HANDLERS ---
  const crearCiclo = async (e) => { e.preventDefault(); try { await api.post('/admin/ciclos', { nombre_ciclo: nuevoCiclo }); toast.success("Creado"); setNuevoCiclo(""); fetchData(); } catch (error) { toast.error("Error"); } };
  const activarCiclo = async (id) => { try { await api.patch(`/admin/ciclos/${id}/activar`); toast.success("Activado"); fetchData(); } catch (e) { toast.error("Error"); }};
  const iniciarEdicion = (c) => { setCicloEditando(c.id); setNombreEditado(c.nombre_ciclo); };
  const cancelarEdicion = () => { setCicloEditando(null); setNombreEditado(""); };
  const guardarEdicion = async (id) => { try { await api.put(`/admin/ciclos/${id}`, { nombre_ciclo: nombreEditado }); toast.success("Editado"); setCicloEditando(null); fetchData(); } catch (e) { toast.error("Error"); }};
  const eliminarCiclo = async (id) => { if(window.confirm("¿Eliminar?")) try { await api.delete(`/admin/ciclos/${id}`); toast.success("Eliminado"); fetchData(); } catch(e) { toast.error("Error"); }};
  
  const cargarSeguimiento = async () => { try { const res = await api.get('/admin/seguimiento-remisiones'); setSeguimiento(res.data); } catch (e) { console.error(e); }};
  
  const abrirLegajo = async (t) => { try { setTutorSeleccionado(t); const res = await api.get(`/admin/resumen-legajo/${t.id}`); setResumenLegajo(res.data); setMostrarModalLegajo(true); } catch (e) { console.error(e); }};
  
  const manejarDescargaConsolidado = async () => { if(!tutorSeleccionado) return; setCargandoReporte(true); try { const res = await api.get(`/admin/reporte-consolidado/${tutorSeleccionado.id}`); generarPDFConsolidado(res.data, cicloActivo?.nombre_ciclo); toast.success("Generado"); } catch (e) { toast.error("Error"); } finally { setCargandoReporte(false); }};
  
  return (
    <div style={localStyles.container}>
      <header style={localStyles.header}>
        <h1 style={localStyles.title}>⚙️ Panel de Control Administrativo</h1>
        <p style={localStyles.subtitle}>Gestión Académica Integral - Ingeniería de Sistemas</p>
      </header>

      <div style={localStyles.tabContainer}>
        <button onClick={() => setTab('ciclos')} style={tab === 'ciclos' ? localStyles.tabActive : localStyles.tab}>📅 Ciclos</button>
        <button onClick={() => setTab('tutores')} style={tab === 'tutores' ? localStyles.tabActive : localStyles.tab}>👨‍🏫 Tutores</button>
        <button onClick={() => setTab('carga')} style={tab === 'carga' ? localStyles.tabActive : localStyles.tab}>📤 Carga Masiva</button>
        <button onClick={() => setTab('reasignacion')} style={tab === 'reasignacion' ? localStyles.tabActive : localStyles.tab}>🎓 Gestión de Estudiantes</button>
        <button onClick={() => { setTab('notificaciones'); cargarNotificaciones(); }} style={tab === 'notificaciones' ? localStyles.tabActive : localStyles.tab}>📢 Notificaciones</button>
        <button onClick={() => { setTab('seguimiento'); cargarSeguimiento(); }} style={tab === 'seguimiento' ? localStyles.tabActive : localStyles.tab}>📊 Seguimiento</button>
      </div>

      <div style={localStyles.contentCard}>
        {tab === 'ciclos' && (
          <div>
            <h3 style={localStyles.sectionTitle}>Administración de Ciclos</h3>
            <form onSubmit={crearCiclo} style={localStyles.formInline}>
              <input type="text" placeholder="Ej: 2025-I" value={nuevoCiclo} onChange={(e) => setNuevoCiclo(e.target.value)} style={localStyles.input} />
              <button type="submit" style={localStyles.createBtn}>+ Crear</button>
            </form>
            <table style={localStyles.table}>
              <thead><tr style={localStyles.trHead}><th style={localStyles.th}>Ciclo</th><th style={localStyles.th}>Estado</th><th style={localStyles.th}>Acciones</th></tr></thead>
              <tbody>
                {ciclos.map(c => (
                  <tr key={c.id} style={localStyles.tr}>
                    <td style={localStyles.td}>{cicloEditando === c.id ? <input value={nombreEditado} onChange={e=>setNombreEditado(e.target.value)} style={localStyles.inputSmall}/> : <strong>{c.nombre_ciclo}</strong>}</td>
                    <td style={localStyles.td}><span onClick={() => activarCiclo(c.id)} style={{...localStyles.badge, backgroundColor: c.activo?'#dcfce7':'#f1f5f9', color: c.activo?'#166534':'#64748b', cursor:'pointer'}}>{c.activo ? '● ACTIVO' : '○ INACTIVO'}</span></td>
                    <td style={localStyles.td}>{cicloEditando === c.id ? <><button onClick={()=>guardarEdicion(c.id)} style={localStyles.iconBtn}>💾</button><button onClick={cancelarEdicion} style={localStyles.iconBtn}>❌</button></> : <><button onClick={()=>iniciarEdicion(c)} style={localStyles.iconBtn}>✏️</button><button onClick={()=>eliminarCiclo(c.id)} style={{...localStyles.iconBtn, opacity:c.activo?0.3:1}} disabled={c.activo}>🗑️</button></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'tutores' && <TutorManager roles={roles} onUpdate={fetchData} />}
        {tab === 'carga' && <BulkAsignacion tutores={tutores} cicloActivo={cicloActivo} />}

        {/* --- PESTAÑA: GESTIÓN DE ESTUDIANTES --- */}
        {tab === 'reasignacion' && (
          <div style={{animation: 'fadeIn 0.3s'}}>
            <h3 style={localStyles.sectionTitle}>✏️ Edición y Reasignación de Estudiantes</h3>
            <form onSubmit={buscarEstudiante} style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
              <input type="text" placeholder="Buscar por DNI, Nombres o Código..." value={busquedaEstudiante} onChange={(e) => setBusquedaEstudiante(e.target.value)} style={{flex:1, padding:'12px', borderRadius:'8px', border:'1px solid #cbd5e1'}} />
              <button type="submit" style={localStyles.searchBtn}>🔍 Buscar</button>
            </form>

            {resultadosBusqueda.length > 0 && (
              <div style={localStyles.resultsBox}>
                {resultadosBusqueda.map(res => {
                  const tutorActual = tutores.find(t => t.id === res.tutor_asignado_id);
                  return (
                    <div key={res.id} onClick={() => seleccionarEstudiante(res)} style={localStyles.resultItem}>
                      <div><div style={{fontWeight:'bold'}}>{res.nombres_apellidos}</div><div style={{fontSize:'12px', color:'#64748b'}}>Código: {res.codigo_estudiante} | DNI: {res.dni}</div></div>
                      <div style={{fontSize:'12px', textAlign:'right'}}><div style={{color: '#64748b'}}>Tutor Actual:</div><strong style={{color: tutorActual ? '#0f172a' : '#ef4444'}}>{tutorActual ? tutorActual.nombres_apellidos : "--- Sin Asignar ---"}</strong></div>
                    </div>
                  );
                })}
              </div>
            )}

            {estudianteEditando && (
              <div style={localStyles.editPanel}>
                <h4 style={{marginTop:0, color:'#1e293b', borderBottom:'1px solid #e2e8f0', paddingBottom:'10px'}}>📝 Editando Datos</h4>
                <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:'15px', marginBottom:'15px'}}>
                    <div><label style={localStyles.label}>Apellidos y Nombres</label><input type="text" value={formEstudiante.nombres} onChange={e => setFormEstudiante({...formEstudiante, nombres: e.target.value})} style={localStyles.inputEdit} /></div>
                    <div><label style={localStyles.label}>Código Universitario</label><input type="text" value={formEstudiante.codigo} onChange={e => setFormEstudiante({...formEstudiante, codigo: e.target.value})} style={localStyles.inputEdit} /></div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 2fr', gap:'15px', marginBottom:'20px'}}>
                    <div><label style={localStyles.label}>DNI</label><input type="text" maxLength="8" value={formEstudiante.dni} onChange={e => setFormEstudiante({...formEstudiante, dni: e.target.value})} style={localStyles.inputEdit} /></div>
                    <div><label style={localStyles.label}>Celular / WhatsApp</label><input type="text" maxLength="9" placeholder="Ej: 999123456" value={formEstudiante.telefono} onChange={e => setFormEstudiante({...formEstudiante, telefono: e.target.value})} style={localStyles.inputEdit} /></div>
                    <div><label style={localStyles.label}>Tutor Asignado</label><select value={formEstudiante.tutor_id} onChange={(e) => setFormEstudiante({...formEstudiante, tutor_id: e.target.value})} style={localStyles.selectEdit}><option value="">-- Seleccione Ingeniero --</option>{tutores.map(t => (<option key={t.id} value={t.id}>{t.nombres_apellidos}</option>))}</select></div>
                </div>
                <div style={{display:'flex', gap:'10px', justifyContent:'flex-end'}}><button onClick={() => setEstudianteEditando(null)} style={localStyles.btnCancel}>Cancelar</button><button onClick={guardarCambiosEstudiante} style={localStyles.btnSave}>💾 Guardar Cambios</button></div>
              </div>
            )}
          </div>
        )}

        {/* --- PESTAÑA NOTIFICACIONES --- */}
        {tab === 'notificaciones' && (
            <div style={{animation: 'fadeIn 0.3s'}}>
                <h3 style={localStyles.sectionTitle}>📢 Centro de Notificaciones (WhatsApp)</h3>
                {!modoEnvioActivo ? (
                  <div style={{backgroundColor:'#f0f9ff', padding:'25px', borderRadius:'12px', border:'1px solid #bfdbfe', marginBottom:'20px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div><h2 style={{margin:'0 0 10px 0', color:'#1e3a8a'}}>1️⃣ Revisión de Lista</h2><p style={{margin:0, color:'#1e40af'}}>Hay <strong>{total} estudiantes</strong> listos. {faltanTelefonos > 0 ? <span style={{color:'#dc2626'}}>⚠️ Faltan {faltanTelefonos} celulares.</span> : "✅ Todo listo."}</p></div>
                      <button onClick={() => setModoEnvioActivo(true)} style={{...localStyles.btnWhatsApp, backgroundColor:'#2563eb'}}>🚀 INICIAR COLA</button>
                    </div>
                  </div>
                ) : (
                  <div style={{marginBottom:'20px'}}>
                    <button onClick={() => setModoEnvioActivo(false)} style={{marginBottom:'10px', background:'none', border:'none', color:'#64748b', cursor:'pointer', textDecoration:'underline'}}>← Volver</button>
                    {siguienteEnCola ? (
                        <div style={localStyles.queueCard}>
                            <div style={{textAlign:'center', marginBottom:'15px'}}><div style={{fontSize:'12px', fontWeight:'bold', color:'#3b82f6'}}>SIGUIENTE</div><h2 style={{margin:'5px 0', fontSize:'28px', color:'#1e293b'}}>{siguienteEnCola.estudiante}</h2><p style={{margin:'5px 0', fontSize:'14px', fontWeight:'bold', color: siguienteEnCola.telefono ? '#166534' : '#ef4444'}}>📱 {siguienteEnCola.telefono ? `+51 ${siguienteEnCola.telefono}` : 'FALTA CELULAR'}</p></div>
                            <button onClick={() => enviarWhatsApp(siguienteEnCola)} style={localStyles.btnWhatsApp}>{siguienteEnCola.telefono ? '📲 Enviar WhatsApp' : '✏️ Ingresar Celular'}</button>
                            <div style={{marginTop:'20px', width:'100%', maxWidth:'400px'}}><div style={{backgroundColor:'#e2e8f0', height:'8px', borderRadius:'4px'}}><div style={{width: `${(progreso / total) * 100}%`, backgroundColor:'#22c55e', height:'100%'}}></div></div><div style={{textAlign:'center', fontSize:'11px', marginTop:'5px'}}>{progreso} de {total}</div></div>
                        </div>
                    ) : (<div style={{padding:'40px', textAlign:'center', backgroundColor:'#f0fdf4', borderRadius:'12px', border:'2px solid #bbf7d0'}}><h3 style={{color:'#166534', margin:0}}>¡Finalizado!</h3><button onClick={() => {setEnviadosLocalmente([]); setModoEnvioActivo(false);}} style={{marginTop:'10px', background:'none', border:'none', textDecoration:'underline', color:'#166534', cursor:'pointer'}}>Reiniciar</button></div>)}
                  </div>
                )}
                <div>
                    <h4 style={{fontSize:'14px', color:'#475569', marginBottom:'10px'}}>📋 Detalle de Estudiantes</h4>
                    <div style={{maxHeight:'400px', overflowY:'auto', border:'1px solid #e2e8f0', borderRadius:'8px'}}>
                        <table style={localStyles.table}>
                            <thead><tr style={localStyles.trHead}><th style={localStyles.th}>Estudiante</th><th style={localStyles.th}>Celular</th><th style={localStyles.th}>Tutor</th><th style={localStyles.th}>Estado</th>{!modoEnvioActivo && <th style={localStyles.th}>Acción</th>}</tr></thead>
                            <tbody>{listaNotificaciones.map(est => { const enviado = enviadosLocalmente.includes(est.id); return (<tr key={est.id} style={{backgroundColor: enviado ? '#f0fdf4' : 'white', borderBottom:'1px solid #f1f5f9'}}><td style={localStyles.td}>{est.estudiante}</td><td style={localStyles.td}>{est.telefono || '--'}</td><td style={localStyles.td}>{est.tutor}</td><td style={localStyles.td}><span style={{...localStyles.badge, backgroundColor: enviado ? '#dcfce7' : '#f1f5f9', color: enviado ? '#166534' : '#64748b'}}>{enviado ? 'ENVIADO' : 'PENDIENTE'}</span></td>{!modoEnvioActivo && (<td style={localStyles.td}><button onClick={() => {const n = prompt("Editar número:", est.telefono); if(n) { api.patch(`/admin/estudiantes/${est.id}/telefono`, {telefono:n}); est.telefono=n; setListaNotificaciones([...listaNotificaciones]); }}} style={{...localStyles.actionBtn, backgroundColor:'#e2e8f0', color:'#334155'}}>✏️ Editar Tel</button></td>)}</tr>); })}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* --- PESTAÑA: SEGUIMIENTO Y GESTIÓN DE INFORMES --- */}
        {tab === 'seguimiento' && (
          <div style={{ animation: 'fadeIn 0.5s' }}>
            <h3 style={localStyles.sectionTitle}>📋 Gestión de Informes Semestrales</h3>
            <table style={localStyles.table}>
              <thead>
                <tr style={localStyles.trHead}>
                  <th style={localStyles.th}>Fecha Recepción</th>
                  <th style={localStyles.th}>Docente</th>
                  <th style={localStyles.th}>Estado Actual</th>
                  <th style={localStyles.th}>Datos Clave</th>
                  <th style={localStyles.th}>Acciones de Gestión</th>
                </tr>
              </thead>
              <tbody>
                {seguimiento.length > 0 ? (
                  seguimiento.map((rem) => (
                    <tr key={rem.id} style={{borderBottom:'1px solid #f1f5f9', backgroundColor: rem.estado === 'OBSERVADO' ? '#fff7ed' : 'white'}}>
                      
                      {/* 1. FECHA */}
                      <td style={localStyles.td}>
                        {new Date(rem.fecha_envio).toLocaleDateString()}
                        <div style={{fontSize:'11px', color:'#94a3b8'}}>{new Date(rem.fecha_envio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      </td>

                      {/* 2. DOCENTE */}
                      <td style={localStyles.td}>
                        <div style={{fontWeight:'700', color:'#334155'}}>{rem.nombre_tutor || 'Sin Nombre'}</div>
                      </td>

                      {/* 3. ESTADO (CON COLORES) */}
                      <td style={localStyles.td}>
                        <span style={{
                          padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', display:'inline-block',
                          backgroundColor: rem.estado === 'APROBADO' ? '#dcfce7' : rem.estado === 'OBSERVADO' ? '#ffedd5' : '#dbeafe',
                          color: rem.estado === 'APROBADO' ? '#166534' : rem.estado === 'OBSERVADO' ? '#9a3412' : '#1e40af',
                          border: rem.estado === 'APROBADO' ? '1px solid #86efac' : rem.estado === 'OBSERVADO' ? '1px solid #fed7aa' : '1px solid #93c5fd'
                        }}>
                          {rem.estado === 'APROBADO' ? '✅ APROBADO' : rem.estado === 'OBSERVADO' ? '⚠️ OBSERVADO' : '📩 ENVIADO'}
                        </span>
                      </td>

                      {/* 4. DATOS */}
                      <td style={localStyles.td}>
                         <div style={{fontSize:'12px', lineHeight:'1.4'}}>👥 <b>{rem.total_estudiantes}</b> Estudiantes<br/>📊 Avance: <b>{rem.avance_porcentaje}%</b></div>
                      </td>

                      {/* 5. ACCIONES EJECUTIVAS */}
                      <td style={localStyles.td}>
                        <div style={{display:'flex', gap:'8px'}}>
                            
                            {/* --- BOTÓN DE AUDITORÍA (VER EVIDENCIAS) --- */}
                            <button 
                                onClick={async () => {
                                    const toastId = toast.loading("Generando expediente para revisión...");
                                    try {
                                        const res = await api.get(`/admin/reporte-consolidado/${rem.tutor_id}`);
                                        await generarPDFConsolidado(res.data, rem.semestre || 'Ciclo Actual');
                                        toast.dismiss(toastId);
                                        toast.success("📂 Expediente descargado para revisión");
                                    } catch (e) {
                                        console.error(e);
                                        toast.dismiss(toastId);
                                        toast.error("Error al generar la evidencia");
                                    }
                                }}
                                title="Descargar Expediente con Evidencias (Sistema)"
                                style={{...localStyles.actionBtn, backgroundColor:'#6366f1', minWidth:'40px'}} 
                            >
                                📄
                            </button>

                            {/* --- BOTÓN DESCARGAR ADJUNTO (Si existe) --- */}
                            {rem.archivo_url && (
                                <button 
                                    onClick={() => {
                                        const url = `${BASE_URL}${rem.archivo_url}`;
                                        window.open(url, '_blank');
                                    }}
                                    title="Descargar Informe Adjunto (PDF/Word)"
                                    style={{...localStyles.actionBtn, backgroundColor:'#8b5cf6', minWidth:'40px'}} 
                                >
                                    📥
                                </button>
                            )}

                            {/* LEER OBSERVACIONES */}
                            <button 
                                onClick={() => {
                                    Swal.fire({
                                        title: `<h3 style="color:#1e293b; margin:0;">📑 Informe del Docente</h3>`,
                                        html: `
                                            <div style="text-align: left; font-size: 14px; color: #334155;">
                                                <p><strong>Docente:</strong> ${rem.nombre_tutor}</p>
                                                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 10px 0;">
                                                <p><strong>Comentarios / Observaciones del Tutor:</strong></p>
                                                <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; font-style: italic; border-left: 4px solid #3b82f6;">
                                                    "${rem.observaciones || 'Sin comentarios registrados.'}"
                                                </div>
                                            </div>
                                        `,
                                        width: '500px',
                                        confirmButtonText: 'Cerrar',
                                        confirmButtonColor: '#64748b'
                                    });
                                }}
                                title="Leer conclusiones del tutor"
                                style={{...localStyles.actionBtn, backgroundColor:'#3b82f6', minWidth:'40px'}}
                            >
                                👁️
                            </button>

                            {/* APROBAR (Cierra el ciclo) */}
                            {rem.estado !== 'APROBADO' && (
                                <button 
                                    onClick={() => {
                                        Swal.fire({
                                            title: '¿Validar Informe?',
                                            text: "Al aprobar, confirmas que el docente ha cumplido con sus labores.",
                                            icon: 'success',
                                            showCancelButton: true,
                                            confirmButtonColor: '#16a34a',
                                            cancelButtonColor: '#94a3b8',
                                            confirmButtonText: 'Sí, Validar',
                                            cancelButtonText: 'Cancelar'
                                        }).then(async (result) => {
                                            if (result.isConfirmed) {
                                                try {
                                                    await api.patch(`/admin/informes/${rem.id}/estado`, { estado: 'APROBADO' });
                                                    toast.success("✅ Informe validado correctamente");
                                                    cargarSeguimiento();
                                                } catch(e) { toast.error("Error al validar"); }
                                            }
                                        });
                                    }}
                                    title="Validar y Archivar"
                                    style={{...localStyles.actionBtn, backgroundColor:'#16a34a', minWidth:'40px'}}
                                >
                                    ✅
                                </button>
                            )}

                            {/* DEVOLVER / RECHAZAR */}
                            {rem.estado !== 'APROBADO' && (
                                <button 
                                    onClick={() => {
                                        Swal.fire({
                                            title: '¿Devolver Informe?',
                                            text: "Esto anulará el envío actual y permitirá al docente corregir y volver a enviar.",
                                            icon: 'warning',
                                            showCancelButton: true,
                                            confirmButtonColor: '#ea580c',
                                            cancelButtonColor: '#94a3b8',
                                            confirmButtonText: 'Sí, Devolver',
                                            cancelButtonText: 'Cancelar'
                                        }).then(async (result) => {
                                            if (result.isConfirmed) {
                                                try {
                                                    await api.delete(`/admin/informes/${rem.id}`);
                                                    Swal.fire('Devuelto', 'El informe ha sido devuelto al docente para correcciones.', 'info');
                                                    cargarSeguimiento();
                                                } catch(e) { toast.error("Error al devolver"); }
                                            }
                                        });
                                    }}
                                    title="Devolver al Docente (Permite corregir)"
                                    style={{...localStyles.actionBtn, backgroundColor:'#ea580c', minWidth:'40px'}}
                                >
                                    🔄
                                </button>
                            )}
                            
                            {/* ELIMINAR (Solo si aprobado) */}
                            {rem.estado === 'APROBADO' && (
                                <button 
                                    onClick={async () => {
                                        if(await Swal.fire({title:'¿Borrar historial?', text:'Esta acción es irreversible.', icon:'error', showCancelButton:true, confirmButtonText:'Borrar'}).then(r=>r.isConfirmed)) {
                                            await api.delete(`/admin/informes/${rem.id}`);
                                            cargarSeguimiento();
                                        }
                                    }}
                                    title="Eliminar del historial"
                                    style={{...localStyles.actionBtn, backgroundColor:'#cbd5e1', color:'#475569'}}
                                >
                                    🗑️
                                </button>
                            )}

                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{padding:'40px', textAlign:'center', color:'#64748b'}}>
                        <div style={{fontSize:'30px', marginBottom:'10px'}}>📭</div>
                        No hay informes pendientes de revisión.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mostrarModalLegajo && (
        <div style={localStyles.modalOverlay}><div style={localStyles.modalContent}><div style={localStyles.modalHeader}><h2 style={{margin:0, fontSize:'18px'}}>📂 Legajo: {tutorSeleccionado?.nombre}</h2><button onClick={() => setMostrarModalLegajo(false)} style={localStyles.closeBtn}>✕</button></div><div style={{padding:'20px'}}><div style={localStyles.gridLegajo}>{['F01', 'F02', 'F03', 'F04', 'F05'].map(f => { const d = resumenLegajo.find(r => r.tipo === f) || { cantidad: 0 }; return <div key={f} style={localStyles.cardLegajo}><span style={localStyles.tag}>{f}</span><span style={localStyles.qty}>{d.cantidad}</span></div> })}</div><button disabled={cargandoReporte} onClick={manejarDescargaConsolidado} style={localStyles.downloadBtn}>{cargandoReporte ? 'Generando...' : '📥 Descargar Consolidado PDF'}</button></div></div></div>
      )}
    </div>
  );
};

const localStyles = {
  container: { padding: '30px', height: '100%', overflowY: 'auto', backgroundColor: '#f8fafc' },
  header: { marginBottom: '25px' },
  title: { fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: 0 },
  subtitle: { fontSize: '14px', color: '#64748b' },
  tabContainer: { display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' },
  tab: { padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: '#64748b', fontWeight: '600' },
  tabActive: { padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)' },
  contentCard: { backgroundColor: 'white', borderRadius: '12px', padding: '25px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  sectionTitle: { marginBottom: '20px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' },
  
  // Estilos de Tablas y Listas
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  trHead: { backgroundColor: '#f8fafc', textAlign: 'left' },
  th: { padding: '12px', borderBottom: '2px solid #e2e8f0', color: '#475569' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px', color: '#334155' },
  badge: { padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
  
  // Estilos Edición Estudiante
  searchBtn: { backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '0 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  resultsBox: { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', marginBottom: '20px', maxHeight: '200px', overflowY: 'auto' },
  resultItem: { padding: '10px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s', ':hover': { backgroundColor: '#f8fafc' } },
  editPanel: { backgroundColor: '#fffbeb', padding: '25px', borderRadius: '8px', border: '1px solid #fcd34d' },
  label: { display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '5px' },
  inputEdit: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' },
  selectEdit: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: 'white' },
  btnSave: { backgroundColor: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
  btnCancel: { backgroundColor: '#94a3b8', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer' },
  
  // Estilos Notificaciones WhatsApp (NUEVO)
  queueCard: { backgroundColor: '#f8fafc', padding: '30px', borderRadius: '12px', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  btnWhatsApp: { backgroundColor: '#16a34a', color: 'white', padding: '15px 30px', borderRadius: '30px', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.4)', transition: 'transform 0.1s', display:'flex', alignItems:'center', gap:'8px' },
  actionBtn: { backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },

  formInline: { display: 'flex', gap: '10px', marginBottom: '20px' },
  input: { flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' },
  inputSmall: { padding: '5px', borderRadius: '4px', border: '1px solid #3b82f6' },
  createBtn: { backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' },
  iconBtn: { border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' },

  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: 'white', width: '550px', borderRadius: '12px', overflow: 'hidden' },
  modalHeader: { padding: '15px 20px', backgroundColor: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer' },
  gridLegajo: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' },
  cardLegajo: { border: '1px solid #e2e8f0', padding: '15px 5px', borderRadius: '8px', textAlign: 'center', backgroundColor: '#fcfcfc' },
  tag: { display: 'block', fontWeight: 'bold', color: '#3b82f6', fontSize: '13px' },
  qty: { fontSize: '20px', fontWeight: '800', color: '#0f172a' },
  downloadBtn: { width: '100%', backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }
};

export default AdminDashboard;