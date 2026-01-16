import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { generarF02 } from '../utils/generadorF02'; // <--- IMPORTANTE: Importamos el generador

export default function ModalTutoriaGrupal({ estudiantes = [], onGuardar, onClose, user, sesionAEditar }) {
  
  // --- 1. FUNCIÓN HELPER PARA FECHA LOCAL (CORREGIDO) ---
  const obtenerFechaHoy = () => {
    const ahora = new Date();
    // Ajustamos la zona horaria restando el offset (en minutos)
    const fechaLocal = new Date(ahora.getTime() - (ahora.getTimezoneOffset() * 60000));
    // Retornamos solo la parte de la fecha YYYY-MM-DD para el input type="date"
    return fechaLocal.toISOString().split('T')[0];
  };

  // --- ESTADOS ---
  const [tema, setTema] = useState('');
  // Inicializamos con la fecha correcta local
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [horaInicio, setHoraInicio] = useState('');
  const [horaCierre, setHoraCierre] = useState('');
  const [area, setArea] = useState('Académica');
  const [totalAsignados, setTotalAsignados] = useState(estudiantes.length || 20);
  
  // --- ESTADOS PARA EVIDENCIA ---
  const [evidencia, setEvidencia] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const [asistentes, setAsistentes] = useState([]);
  const [enviando, setEnviando] = useState(false);

  // --- ESTADO PARA CONTROLAR FIRMA ---
  const [editandoFirma, setEditandoFirma] = useState(true);

  const sigCanvasTutor = useRef(null);

  // --- EFECTO DE CARGA ---
  useEffect(() => {
    if (sesionAEditar) {
        setTema(sesionAEditar.tema || '');
        
        // --- CORRECCIÓN DE FECHA AL EDITAR ---
        if (sesionAEditar.fecha) {
            const fechaGuardada = new Date(sesionAEditar.fecha);
            // Ajustamos zona horaria para evitar que salga un día antes
            const fechaAjustada = new Date(fechaGuardada.getTime() - (fechaGuardada.getTimezoneOffset() * 60000));
            setFecha(fechaAjustada.toISOString().split('T')[0]);
        }
        
        setHoraInicio(sesionAEditar.hora_inicio || '');
        setHoraCierre(sesionAEditar.hora_cierre || '');
        setArea(sesionAEditar.area_tema || sesionAEditar.area || 'Académica');
        
        // Cargar asistentes
        if (sesionAEditar.asistentes_ids) {
            setAsistentes(sesionAEditar.asistentes_ids);
        } else if (sesionAEditar.estudiantes_asistentes) {
             // Si viene del historial completo (objeto profundo)
             const ids = sesionAEditar.estudiantes_asistentes.map(e => e.id);
             setAsistentes(ids);
        }

        // Cargar evidencia si existe
        if (sesionAEditar.evidencia_url) {
            setPreviewUrl(sesionAEditar.evidencia_url);
        }

        // Verificar firma existente
        const firmaExistente = sesionAEditar.firma_img || sesionAEditar.firma_tutor_url || sesionAEditar.firma_tutor;
        if (firmaExistente && firmaExistente.length > 50) {
            setEditandoFirma(false);
        } else {
            setEditandoFirma(true);
        }

    } else {
        // MODO NUEVO: Aseguramos fecha de hoy correcta
        setFecha(obtenerFechaHoy());
        setEditandoFirma(true);
    }
  }, [sesionAEditar]);

  const toggleAsistencia = (id) => {
    setAsistentes(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEvidencia(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // Helper para convertir archivo a Base64 (para el PDF inmediato)
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (asistentes.length === 0) return alert("Debe marcar al menos un asistente.");
    
    // 1. Preparar Firma
    let firmaUrl = null;
    if (editandoFirma) {
        if (sigCanvasTutor.current.isEmpty()) return alert("Debe firmar el documento.");
        firmaUrl = sigCanvasTutor.current.getCanvas().toDataURL('image/png');
    } else {
        firmaUrl = sesionAEditar?.firma_img || sesionAEditar?.firma_tutor_url || sesionAEditar?.firma_tutor;
    }

    setEnviando(true);
    try {
        // 2. Preparar Datos para Guardar en BD
        const datosParaGuardar = {
            id: sesionAEditar?.id,
            tema,
            fecha, // Enviamos la fecha YYYY-MM-DD correcta
            hora_inicio: horaInicio,
            hora_cierre: horaCierre,
            area_tema: area,
            asistentes_ids: asistentes,
            total_asignados: parseInt(totalAsignados),
            total_asistentes: asistentes.length,
            firma_img: firmaUrl, 
            archivo_evidencia: evidencia,
        };

        // 3. Guardar en Backend
        const exito = await onGuardar(datosParaGuardar);

        if (exito === true) {
            // 4. GENERAR PDF AUTOMÁTICAMENTE
            try {
                // Preparamos la imagen de evidencia para el PDF (si es nueva)
                let fotoParaPdf = null;
                if (evidencia instanceof File) {
                    fotoParaPdf = await fileToBase64(evidencia);
                }

                // Construimos el objeto completo para el PDF
                const datosParaPDF = {
                    ...datosParaGuardar,
                    foto_pdf: fotoParaPdf, // Pasamos la base64 directa
                    evidencia_url: sesionAEditar?.evidencia_url // O la URL antigua si existe
                };

                // Obtenemos los objetos completos de los estudiantes asistentes
                const listaAsistentes = estudiantes.filter(est => asistentes.includes(est.id));

                // ¡Generamos el PDF!
                await generarF02(datosParaPDF, listaAsistentes);
                
            } catch (pdfError) {
                console.error("Error generando PDF:", pdfError);
                alert("Se guardó el registro, pero hubo un error generando el PDF.");
            }

            // 5. Cerrar Modal
            onClose(); 
        }
    } catch (error) {
        alert("❌ Error local al procesar.");
    } finally {
        setEnviando(false);
    }
  };

  const getFirmaActual = () => {
      if (!sesionAEditar) return null;
      return sesionAEditar.firma_img || sesionAEditar.firma_tutor_url || sesionAEditar.firma_tutor;
  };

  // --- RENDERIZADO (ESTILO DOCUMENTO OFICIAL F02) ---
  return (
    <div style={styles.overlay}>
      <div style={styles.modalPaper}>
        
        {/* ENCABEZADO OFICIAL */}
        <div style={styles.modalHeader}>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
             <img src="/logo_unajma.png" alt="UNAJMA" style={{width:'40px', height:'40px'}} />
             <div>
                <div style={{fontSize:'11px', fontWeight:'900', color:'#0f172a'}}>UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS</div>
                <div style={{fontSize:'10px', color:'#64748b', fontWeight:'600'}}>OFICINA DE TUTORÍA Y APOYO PEDAGÓGICO</div>
             </div>
          </div>
          <div style={{textAlign:'right'}}>
             <div style={{fontSize:'11px', fontWeight:'bold', color:'#004a99'}}>F02</div>
             {!enviando && <button onClick={onClose} style={styles.closeBtn}>Cerrar ✕</button>}
          </div>
        </div>

        <h2 style={styles.documentTitle}>FICHA DE TUTORÍA GRUPAL</h2>

        <div style={styles.modalContent}>
            <form onSubmit={handleSubmit} id="f02Form">
              
              {/* DATOS DEL TALLER */}
              <div style={styles.infoBox}>
                  <div style={{marginBottom:'8px'}}>
                      <span style={styles.labelBold}>TEMA / ACTIVIDAD: </span>
                      <input type="text" value={tema} onChange={e=>setTema(e.target.value)} style={styles.inputFull} placeholder="Ingrese el tema..." required />
                  </div>
                  
                  {/* GRID DE FECHA, HORA Y ÁREA (ALINEADO) */}
                  <div style={{display:'flex', gap:'10px', alignItems:'center', justifyContent: 'space-between'}}>
                      
                      <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                          <span style={styles.labelBold}>FECHA: </span>
                          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={styles.dateInput} required />
                      </div>

                      <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                          <span style={styles.labelBold}>HORA: </span>
                          <input type="time" value={horaInicio} onChange={e=>setHoraInicio(e.target.value)} style={{...styles.dateInput, width: 'auto'}} required />
                          <span style={{fontSize:'11px', fontWeight:'bold', color:'#666'}}> a </span>
                          <input type="time" value={horaCierre} onChange={e=>setHoraCierre(e.target.value)} style={{...styles.dateInput, width: 'auto'}} required />
                      </div>

                      <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                          <span style={styles.labelBold}>ÁREA: </span>
                          <select value={area} onChange={e=>setArea(e.target.value)} style={styles.selectInput}>
                              <option value="Académica">Académica</option>
                              <option value="Personal">Personal</option>
                              <option value="Profesional">Profesional</option>
                              <option value="Convivencia">Convivencia</option>
                          </select>
                      </div>
                  </div>
              </div>

              {/* LISTA DE ASISTENCIA */}
              <div style={{marginBottom:'15px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
                      <div style={styles.labelSection}>LISTA DE ASISTENCIA</div>
                      <span style={styles.counterBadge}>Marcados: {asistentes.length} / {totalAsignados}</span>
                  </div>
                  
                  <div style={styles.attendanceBox}>
                      {estudiantes.map((est, index) => (
                          <div key={est.id} onClick={() => toggleAsistencia(est.id)}
                              style={{...styles.attendanceRow, backgroundColor: asistentes.includes(est.id) ? '#f0fdf4' : '#fff'}}>
                              <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                  <span style={{fontSize:'11px', color:'#64748b', width:'20px'}}>{index + 1}.</span>
                                  <div>
                                      <div style={{fontSize:'12px', fontWeight:'600', color:'#334155'}}>{est.nombres_apellidos}</div>
                                      <div style={{fontSize:'10px', color:'#94a3b8'}}>{est.codigo_estudiante}</div>
                                  </div>
                              </div>
                              <div style={asistentes.includes(est.id) ? styles.checkActive : styles.checkInactive} />
                          </div>
                      ))}
                  </div>
              </div>

              {/* EVIDENCIA */}
              <div style={styles.evidenceSection}>
                  <label style={{fontSize:'11px', fontWeight:'bold', color:'#444', display:'block', marginBottom:'5px'}}>EVIDENCIA FOTOGRÁFICA:</label>
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                      <input type="file" accept="image/*" onChange={handleFileChange} style={{fontSize:'11px'}} />
                      {previewUrl && <span style={{fontSize:'10px', color:'green'}}>✅ Imagen lista</span>}
                  </div>
                  {previewUrl && (
                      <img src={previewUrl} alt="Preview" style={{height:'60px', marginTop:'5px', border:'1px solid #ccc'}} />
                  )}
                  {!previewUrl && sesionAEditar?.evidencia_url && (
                      <div style={{fontSize:'10px', color:'#004a99', marginTop:'4px'}}>📸 Hay una foto guardada previamente.</div>
                  )}
              </div>

              {/* FIRMA TUTOR */}
              <div style={{marginTop:'20px', textAlign:'center'}}>
                  <div style={styles.signatureBox}>
                      {!editandoFirma && getFirmaActual() ? (
                          <img src={getFirmaActual()} alt="Firma" style={{height:'100%', objectFit:'contain'}} onError={()=>setEditandoFirma(true)} />
                      ) : (
                          <SignatureCanvas ref={sigCanvasTutor} penColor='black' canvasProps={{style: {width:'100%', height:'100%'}}} />
                      )}
                  </div>
                  <div style={styles.sigLine}></div>
                  <div style={styles.sigLabel}>FIRMA DEL TUTOR(A) RESPONSABLE</div>
                  
                  <div style={{marginTop:'5px', display:'flex', justifyContent:'center', gap:'10px'}}>
                      {!editandoFirma ? (
                          <button type="button" onClick={()=>setEditandoFirma(true)} style={styles.linkBtn}>Cambiar Firma</button>
                      ) : (
                          <>
                              <button type="button" onClick={()=>sigCanvasTutor.current.clear()} style={styles.linkBtn}>Limpiar</button>
                              {getFirmaActual() && (
                                  <button type="button" onClick={()=>setEditandoFirma(false)} style={styles.linkBtn}>Cancelar</button>
                              )}
                          </>
                      )}
                  </div>
              </div>

            </form>
        </div>

        {/* FOOTER */}
        <div style={styles.modalFooter}>
            <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={enviando}>Cancelar</button>
            <button type="submit" form="f02Form" style={styles.saveBtn} disabled={enviando}>
                {enviando ? 'GUARDANDO...' : 'GUARDAR Y GENERAR PDF'}
            </button>
        </div>
      </div>
    </div>
  );
}

// --- ESTILOS "AL RAS" TIPO DOCUMENTO ---
const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 2000,
    display: 'flex', justifyContent: 'center',
    alignItems: 'flex-start', // Al ras arriba
    paddingTop: '20px', paddingBottom: '20px',
    backdropFilter: 'blur(3px)'
  },
  modalPaper: {
    backgroundColor: '#fff',
    height: '95vh', width: '700px', maxWidth: '95%',
    borderRadius: '4px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden'
  },
  
  // Encabezado
  modalHeader: {
    padding: '15px 25px', borderBottom: '2px solid #004a99',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff'
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '11px', color: '#64748b',
    cursor: 'pointer', fontWeight: 'bold', marginLeft: '10px'
  },
  documentTitle: {
    textAlign: 'center', fontSize: '15px', fontWeight: 'bold', color: '#000',
    marginTop: '15px', marginBottom: '10px', textDecoration: 'underline'
  },
  modalContent: { padding: '10px 30px', overflowY: 'auto', flex: 1 },

  // Info Box
  infoBox: {
    backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px',
    padding: '12px', marginBottom: '15px'
  },
  labelBold: { fontSize: '11px', fontWeight: '800', color: '#0f172a' },
  
  // Inputs
  inputFull: { width: '98%', border: 'none', borderBottom: '1px solid #94a3b8', backgroundColor:'transparent', fontSize:'12px', padding:'4px', outline:'none', fontWeight:'600' },
  dateInput: { border: '1px solid #ccc', borderRadius:'3px', padding:'3px', fontSize:'11px', width:'110px' },
  selectInput: { border: '1px solid #ccc', borderRadius:'3px', padding:'3px', fontSize:'11px', width:'100%' },

  // Asistencia
  labelSection: { fontSize: '11px', fontWeight: 'bold', color: '#333' },
  counterBadge: { fontSize: '10px', backgroundColor: '#004a99', color:'white', padding:'2px 8px', borderRadius:'10px' },
  attendanceBox: {
    height: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px',
    backgroundColor: '#fff'
  },
  attendanceRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 10px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: '0.1s'
  },
  checkActive: { width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#22c55e', border: '2px solid #16a34a' },
  checkInactive: { width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: '2px solid #cbd5e1' },

  // Evidencia
  evidenceSection: { border: '1px dashed #cbd5e1', padding: '10px', borderRadius: '4px', backgroundColor: '#fdfdfd' },

  // Firma
  signatureBox: { 
    width: '100%', height: '120px', border: '1px dashed #94a3b8', 
    display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' 
  },
  sigLine: { width: '60%', height: '1px', backgroundColor: '#000', margin: '5px auto 2px' },
  sigLabel: { fontSize: '10px', fontWeight: 'bold', color: '#444' },
  linkBtn: { background: 'none', border: 'none', color: '#2563eb', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' },

  // Footer
  modalFooter: {
    padding: '15px 25px', borderTop: '1px solid #e2e8f0',
    display: 'flex', justifyContent: 'center', gap: '15px', backgroundColor: '#fff'
  },
  cancelBtn: { padding: '8px 25px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  saveBtn: { padding: '8px 25px', borderRadius: '4px', border: 'none', backgroundColor: '#004a99', color: 'white', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }
};