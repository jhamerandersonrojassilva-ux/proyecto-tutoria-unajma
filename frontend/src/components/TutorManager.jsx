import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { toast } from "sonner";

const TutorManager = ({ roles, onUpdate }) => {
  const [tutores, setTutores] = useState([]);
  const [cargando, setCargando] = useState(false);
  
  // Estado para controlar edición
  const [modoEdicion, setModoEdicion] = useState(false);
  const [idEdicion, setIdEdicion] = useState(null);

  // Estados para Modal de Estudiantes
  const [mostrarModalAlumnos, setMostrarModalAlumnos] = useState(false);
  const [alumnosTutor, setAlumnosTutor] = useState([]);
  const [tutorActual, setTutorActual] = useState(null);

  // Estado del formulario
  const [form, setForm] = useState({ 
    nombres: '', dni: '', codigo: '', correo: '', especialidad: '', telefono: '' 
  });

  useEffect(() => { cargarTutores(); }, []);

  const cargarTutores = async () => {
    try {
      const res = await api.get('/tutores'); 
      setTutores(res.data);
    } catch (error) { console.error("Error al cargar tutores:", error); }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // --- LOGICA DE ALUMNOS ---
  const verAlumnos = async (tutor) => {
    setTutorActual(tutor);
    try {
      const res = await api.get(`/admin/tutores/${tutor.id}/estudiantes`);
      setAlumnosTutor(res.data);
      setMostrarModalAlumnos(true);
    } catch (error) {
      toast.error("No se pudieron cargar los alumnos");
    }
  };

  // --- LÓGICA DE GUARDADO ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombres || !form.dni) return toast.warning("Nombre y DNI son obligatorios");

    setCargando(true);
    try {
      if (modoEdicion) {
        await api.put(`/admin/tutores/${idEdicion}`, form);
        toast.success("✅ Datos actualizados");
        cancelarEdicion();
      } else {
        const rolTutor = roles?.find(r => r.nombre_rol === 'TUTOR') || { id: 2 };
        await api.post('/admin/tutores-completo', { ...form, rol_id: rolTutor.id });
        toast.success("✅ Tutor registrado correctamente");
        setForm({ nombres: '', dni: '', codigo: '', correo: '', especialidad: '', telefono: '' });
      }
      cargarTutores();
      if (onUpdate) onUpdate();
    } catch (err) { 
      toast.error("Error al procesar la solicitud."); 
    } finally { setCargando(false); }
  };

  const iniciarEdicion = (tutor) => {
    setModoEdicion(true);
    setIdEdicion(tutor.id);
    setForm({
      nombres: tutor.nombres_apellidos,
      dni: tutor.dni,
      codigo: tutor.codigo_docente || '',
      correo: tutor.correo_institucional || '',
      especialidad: tutor.especialidad || '',
      telefono: tutor.usuario?.telefono || tutor.telefono || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setModoEdicion(false);
    setIdEdicion(null);
    setForm({ nombres: '', dni: '', codigo: '', correo: '', especialidad: '', telefono: '' });
  };

  const eliminarTutor = async (id) => {
    if (!window.confirm("⚠️ ¿Eliminar este tutor? Se borrará su acceso.")) return;
    try {
      await api.delete(`/admin/tutores/${id}`);
      toast.success("🗑️ Eliminado correctamente");
      cargarTutores();
    } catch (error) { toast.error(error.response?.data?.error || "Error al eliminar"); }
  };

  const enviarAccesosWA = (tutor) => {
    const tel = tutor.usuario?.telefono || tutor.telefono || form.telefono;
    if (!tel) return toast.error("Sin celular registrado");
    const mensaje = encodeURIComponent(`Hola *${tutor.nombres_apellidos}*, sus credenciales UNAJMA son:\nUsuario: ${tutor.dni}\nClave: ${tutor.dni}`);
    window.open(`https://wa.me/51${tel}?text=${mensaje}`, '_blank');
  };

  return (
    <div style={styles.gridContainer}>
      {/* FORMULARIO */}
      <div style={modoEdicion ? styles.cardFormEdit : styles.cardForm}>
        <h2 style={styles.cardTitle}>{modoEdicion ? '✏️ Editando Tutor' : '🆕 Nuevo Tutor'}</h2>
        <form onSubmit={handleSubmit} style={styles.formStack}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Nombres y Apellidos</label>
            <input type="text" name="nombres" placeholder="Ej: Ing. Juan Perez" style={styles.input} required value={form.nombres} onChange={handleChange} />
          </div>
          <div style={styles.rowGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>DNI (Usuario)</label>
              <input type="text" name="dni" maxLength="8" placeholder="DNI" style={styles.input} required value={form.dni} onChange={handleChange} disabled={modoEdicion} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Código</label>
              <input type="text" name="codigo" placeholder="DOC-001" style={styles.input} required value={form.codigo} onChange={handleChange} />
            </div>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Celular</label>
            <input type="text" name="telefono" maxLength="9" placeholder="900000000" style={styles.input} required value={form.telefono} onChange={handleChange} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Correo</label>
            <input type="email" name="correo" placeholder="email@unajma.edu.pe" style={styles.input} value={form.correo} onChange={handleChange} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Especialidad</label>
            <input type="text" name="especialidad" placeholder="Ej: Redes" style={styles.input} value={form.especialidad} onChange={handleChange} />
          </div>
          <div style={{display: 'flex', gap: '10px'}}>
            <button type="submit" style={modoEdicion ? styles.btnUpdate : styles.btnPrimary} disabled={cargando}>
              {cargando ? '...' : (modoEdicion ? 'Actualizar' : 'Guardar')}
            </button>
            {modoEdicion && <button type="button" onClick={cancelarEdicion} style={styles.btnCancel}>Cancelar</button>}
          </div>
        </form>
      </div>

      {/* TABLA */}
      <div style={styles.cardTable}>
        <h2 style={styles.cardTitle}>👥 Plantel de Tutores</h2>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>Docente</th>
                <th style={styles.th}>Alumnos</th>
                <th style={{...styles.th, textAlign: 'center'}}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tutores.map(t => (
                <tr key={t.id} style={styles.trHover}>
                  <td style={styles.td}>
                    <div style={{fontWeight: 'bold', color: '#0f172a'}}>{t.nombres_apellidos}</div>
                    <div style={{fontSize: '11px', color: '#64748b', display: 'flex', gap: '5px', marginTop:'4px'}}>
                      <span style={styles.badge}>🪪 {t.dni}</span>
                      {(t.usuario?.telefono || t.telefono) && <span style={{...styles.badge, backgroundColor:'#dcfce7', color:'#166534'}}>📞 {t.usuario?.telefono || t.telefono}</span>}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <button onClick={() => verAlumnos(t)} style={styles.btnAlumnos}>
                      🎓 Ver Asignados
                    </button>
                  </td>
                  <td style={{...styles.td, textAlign: 'center'}}>
                    <div style={{display: 'flex', justifyContent: 'center', gap: '5px'}}>
                      <button onClick={() => enviarAccesosWA(t)} style={styles.btnIcon} title="WhatsApp">📲</button>
                      <button onClick={() => iniciarEdicion(t)} style={styles.btnIconEdit} title="Editar">✏️</button>
                      <button onClick={() => eliminarTutor(t.id)} style={styles.btnIconDelete} title="Eliminar">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE ALUMNOS */}
      {mostrarModalAlumnos && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={{margin:0}}>🎓 Estudiantes Asignados</h3>
              <button onClick={() => setMostrarModalAlumnos(false)} style={styles.closeBtn}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <p style={{fontSize:'14px', marginBottom:'15px'}}>
                Tutor: <strong>{tutorActual?.nombres_apellidos}</strong><br/>
                Total: <strong>{alumnosTutor.length} estudiantes</strong>
              </p>
              
              <div style={{maxHeight:'300px', overflowY:'auto', border:'1px solid #e2e8f0', borderRadius:'8px'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                  <thead style={{position:'sticky', top:0, backgroundColor:'#f1f5f9'}}>
                    <tr>
                      <th style={styles.thModal}>Código</th>
                      <th style={styles.thModal}>Apellidos y Nombres</th>
                      <th style={styles.thModal}>DNI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnosTutor.length > 0 ? alumnosTutor.map(est => (
                      <tr key={est.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                        <td style={styles.tdModal}>{est.codigo_estudiante}</td>
                        <td style={styles.tdModal}>{est.nombres_apellidos}</td>
                        <td style={styles.tdModal}>{est.dni}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="3" style={{padding:'20px', textAlign:'center', color:'#94a3b8'}}>Sin asignaciones</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  gridContainer: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px', alignItems: 'start' },
  cardForm: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', borderTop: '4px solid #4f46e5' },
  cardFormEdit: { backgroundColor: '#fffbeb', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', borderTop: '4px solid #f59e0b' },
  cardTable: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', borderTop: '4px solid #94a3b8' },
  cardTitle: { fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' },
  formStack: { display: 'flex', flexDirection: 'column', gap: '12px' },
  rowGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#475569' },
  input: { padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  btnPrimary: { backgroundColor: '#4f46e5', color: 'white', padding: '10px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', width: '100%' },
  btnUpdate: { backgroundColor: '#f59e0b', color: 'white', padding: '10px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', flex: 1 },
  btnCancel: { backgroundColor: '#94a3b8', color: 'white', padding: '10px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer' },
  
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  trHead: { backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' },
  th: { padding: '10px', textAlign: 'left', fontWeight: '600', color: '#64748b' },
  trHover: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px' },
  badge: { backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' },
  
  btnAlumnos: { backgroundColor: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '5px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  btnIcon: { backgroundColor: '#dcfce7', border: '1px solid #86efac', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer' },
  btnIconEdit: { backgroundColor: '#fef3c7', border: '1px solid #fcd34d', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer' },
  btnIconDelete: { backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer' },

  // Estilos Modal
  modalOverlay: { position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modalContent: { backgroundColor:'white', width:'500px', borderRadius:'10px', overflow:'hidden', boxShadow:'0 10px 25px rgba(0,0,0,0.2)' },
  modalHeader: { backgroundColor:'#1e293b', color:'white', padding:'15px', display:'flex', justifyContent:'space-between', alignItems:'center' },
  closeBtn: { background:'none', border:'none', color:'white', fontSize:'18px', cursor:'pointer' },
  modalBody: { padding:'20px' },
  thModal: { padding:'8px', textAlign:'left', backgroundColor:'#f1f5f9', color:'#64748b', fontSize:'12px', fontWeight:'bold' },
  tdModal: { padding:'8px', borderBottom:'1px solid #f1f5f9', color:'#334155' }
};

export default TutorManager;