import { useState, useRef, useEffect } from 'react';
import SignaturePad from 'react-signature-pad-wrapper';
import { toast } from 'sonner';

export default function ModalEditarSesion({ sesion, estudiante, onGuardar, onClose }) {
  // --- ESTADOS ---
  const [datos, setDatos] = useState({ ...sesion });
  
  // Control de modo edición para firmas
  const [editandoFirmaTutor, setEditandoFirmaTutor] = useState(false);
  const [editandoFirmaEst, setEditandoFirmaEst] = useState(false);

  // Referencias a los componentes de firma
  const firmaTutorRef = useRef(null);
  const firmaEstRef = useRef(null);

  // Detectar si es F05 (Derivación)
  const esF05 = datos.tipo_formato === 'F05' || datos.tipo_formato === 'Derivación';
  const tituloDocumento = esF05 
    ? 'FICHA DE DERIVACIÓN DE ESTUDIANTES (F05)' 
    : 'FICHA DE SEGUIMIENTO DE TUTORÍA INDIVIDUAL (F04)';
  const colorBorde = esF05 ? '#ef4444' : '#f59e0b';

  // Ajuste de fecha al abrir
  useEffect(() => {
    if (sesion?.fecha || sesion?.fecha_solicitud) {
      const rawDate = sesion.fecha || sesion.fecha_solicitud;
      try {
        const dateObj = new Date(rawDate);
        // Ajuste manual de zona horaria para el input
        const tzOffset = dateObj.getTimezoneOffset() * 60000; 
        const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
        setDatos(prev => ({ ...prev, fecha: localISOTime }));
      } catch (e) { console.error("Error fecha", e); }
    }
  }, [sesion]);

  // --- GUARDAR ---
  const handleSubmit = (e) => {
    e.preventDefault();

    try {
        // 1. Procesar Firma Tutor
        let nuevaFirmaTutor = datos.firma_tutor_url; 
        
        if (editandoFirmaTutor && firmaTutorRef.current?.instance) {
            // Si el pad NO está vacío, usamos la nueva firma
            if (!firmaTutorRef.current.instance.isEmpty()) {
                nuevaFirmaTutor = firmaTutorRef.current.instance.toDataURL();
            }
        }

        // 2. Procesar Firma Estudiante
        let nuevaFirmaEst = datos.firma_estudiante_url;
        
        if (!esF05 && editandoFirmaEst && firmaEstRef.current?.instance) {
            if (!firmaEstRef.current.instance.isEmpty()) {
                nuevaFirmaEst = firmaEstRef.current.instance.toDataURL();
            }
        }

        // 3. Convertir fecha a ISO
        const fechaISO = new Date(datos.fecha).toISOString();

        onGuardar({
          ...datos,
          id: sesion.id,
          fecha: fechaISO,
          tema: datos.motivo_consulta || datos.tema,
          motivo_consulta: datos.motivo_consulta,
          acuerdos_compromisos: datos.acuerdos_compromisos,
          observaciones: datos.observaciones,
          firma_tutor_url: nuevaFirmaTutor,
          firma_estudiante_url: nuevaFirmaEst
        });
        
    } catch (error) {
        console.error("Error al preparar datos:", error);
        toast.error("Error al guardar. Verifica los campos.");
    }
  };

  return (
    <div className="modal-overlay" style={styles.overlay}>
      <div className="modal-content" style={styles.modalContent}>
        
        {/* --- ENCABEZADO INSTITUCIONAL --- */}
        <div style={styles.header}>
            <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                <img 
                    src="/logo_unajma.png" 
                    alt="Logo" 
                    style={{height:'50px', width:'auto'}} 
                    onError={(e) => e.target.style.display = 'none'}
                />
                <div>
                    <h3 style={styles.uniName}>UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS</h3>
                    <p style={styles.officeName}>ÁREA DE TUTORÍA Y APOYO PEDAGÓGICO</p>
                </div>
            </div>
            <div style={{textAlign:'right'}}>
                <span style={{...styles.badge, backgroundColor: colorBorde + '20', color: colorBorde}}>
                    {esF05 ? 'F05' : 'F04'}
                </span>
                <button onClick={onClose} style={styles.closeBtn}>✕</button>
            </div>
        </div>

        {/* BARRA DE COLOR */}
        <div style={{height:'4px', backgroundColor: colorBorde, width:'100%'}}></div>

        <div style={styles.body}>
            <h2 style={styles.docTitle}>{tituloDocumento}</h2>

            <form onSubmit={handleSubmit}>
                {/* DATOS GENERALES */}
                <div style={styles.rowInfo}>
                    <div><strong>Nombre y Apellidos del Tutorado:</strong> <span style={{textTransform:'uppercase'}}>{estudiante?.nombres_apellidos}</span></div>
                    <div><strong>Escuela Profesional:</strong> <span style={{textTransform:'uppercase'}}>{estudiante?.escuela_profesional}</span></div>
                </div>

                <div style={styles.fieldGroup}>
                    <label style={styles.label}>Fecha:</label>
                    <input 
                        type="datetime-local" 
                        value={datos.fecha || ''}
                        onChange={(e) => setDatos({...datos, fecha: e.target.value})}
                        style={{...styles.input, width:'auto', display:'inline-block'}}
                        required
                    />
                </div>

                {/* --- ÁREA DE CONTENIDO --- */}
                
                {/* 1. ASPECTOS / MOTIVO */}
                <div style={styles.section}>
                    <label style={styles.label}>{esF05 ? 'Motivo de la Derivación:' : 'Aspectos Abordados:'}</label>
                    <textarea 
                        rows="4"
                        style={styles.textAreaLine}
                        value={datos.motivo_consulta || datos.tema || ''}
                        onChange={(e) => setDatos({...datos, motivo_consulta: e.target.value})}
                    />
                </div>

                {/* 2. ACUERDOS (Solo F04) */}
                {!esF05 && (
                    <div style={styles.section}>
                        <label style={styles.label}>Acuerdos:</label>
                        <textarea 
                            rows="4"
                            style={styles.textAreaLine}
                            value={datos.acuerdos_compromisos || ''}
                            onChange={(e) => setDatos({...datos, acuerdos_compromisos: e.target.value})}
                        />
                    </div>
                )}

                {/* 3. OBSERVACIONES */}
                <div style={styles.section}>
                    <label style={styles.label}>Observaciones del Tutor:</label>
                    <textarea 
                        rows="3"
                        style={styles.textAreaLine}
                        value={datos.observaciones || ''}
                        onChange={(e) => setDatos({...datos, observaciones: e.target.value})}
                    />
                </div>

                {/* --- ZONA DE FIRMAS --- */}
                <div style={styles.signaturesRow}>
                    
                    {/* FIRMA TUTOR */}
                    <div style={styles.sigColumn}>
                        <div style={styles.sigLine}></div>
                        <label style={styles.sigLabel}>Firma del Tutor(a)</label>
                        
                        <div style={styles.sigContainer}>
                            {editandoFirmaTutor ? (
                                // MODO EDICIÓN: PAD
                                <div style={styles.padWrapper}>
                                    <SignaturePad 
                                        ref={firmaTutorRef} 
                                        options={{penColor:'black', backgroundColor:'white'}} 
                                    />
                                    <button type="button" onClick={() => firmaTutorRef.current?.instance?.clear()} style={styles.btnClear}>Limpiar</button>
                                </div>
                            ) : (
                                // MODO VISTA: IMAGEN
                                <div style={styles.imgWrapper}>
                                    {datos.firma_tutor_url ? (
                                        <img src={datos.firma_tutor_url} alt="Firma" style={{maxHeight:'60px'}} />
                                    ) : (
                                        <span style={{color:'#999', fontSize:'12px'}}>Sin firma</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* BOTÓN TOGGLE */}
                        <button 
                            type="button" 
                            onClick={() => setEditandoFirmaTutor(!editandoFirmaTutor)}
                            style={editandoFirmaTutor ? styles.btnCancelSig : styles.btnChangeSig}
                        >
                            {editandoFirmaTutor ? 'Cancelar Edición' : 'Cambiar Firma'}
                        </button>
                    </div>

                    {/* FIRMA ESTUDIANTE (Si no es F05) */}
                    {!esF05 && (
                        <div style={styles.sigColumn}>
                            <div style={styles.sigLine}></div>
                            <label style={styles.sigLabel}>Firma del Estudiante</label>
                            
                            <div style={styles.sigContainer}>
                                {editandoFirmaEst ? (
                                    <div style={styles.padWrapper}>
                                        <SignaturePad 
                                            ref={firmaEstRef} 
                                            options={{penColor:'black', backgroundColor:'white'}} 
                                        />
                                        <button type="button" onClick={() => firmaEstRef.current?.instance?.clear()} style={styles.btnClear}>Limpiar</button>
                                    </div>
                                ) : (
                                    <div style={styles.imgWrapper}>
                                        {datos.firma_estudiante_url ? (
                                            <img src={datos.firma_estudiante_url} alt="Firma" style={{maxHeight:'60px'}} />
                                        ) : (
                                            <span style={{color:'#999', fontSize:'12px'}}>Sin firma</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button 
                                type="button" 
                                onClick={() => setEditandoFirmaEst(!editandoFirmaEst)}
                                style={editandoFirmaEst ? styles.btnCancelSig : styles.btnChangeSig}
                            >
                                {editandoFirmaEst ? 'Cancelar Edición' : 'Cambiar Firma'}
                            </button>
                        </div>
                    )}
                </div>

                {/* BOTONES ACCIÓN */}
                <div style={styles.footer}>
                    <button type="button" onClick={onClose} style={styles.btnSecondary}>Cancelar</button>
                    <button type="submit" style={styles.btnPrimary}>Guardar Sesión</button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
}

// --- ESTILOS (TIPO DOCUMENTO FORMAL) ---
const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, backdropFilter: 'blur(3px)' },
    modalContent: { backgroundColor: 'white', width: '800px', maxHeight: '95vh', overflowY: 'auto', borderRadius: '4px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' },
    
    header: { padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    uniName: { margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#333', textTransform: 'uppercase' },
    officeName: { margin: 0, fontSize: '11px', color: '#666' },
    closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999', lineHeight: '1' },
    badge: { fontSize:'14px', fontWeight:'bold', padding:'4px 8px', borderRadius:'6px', marginRight:'10px' },

    body: { padding: '0 40px 40px 40px' },
    docTitle: { textAlign: 'center', fontSize: '16px', fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase', marginBottom: '30px', color: '#000' },

    rowInfo: { marginBottom: '20px', fontSize: '13px', lineHeight: '1.6', color: '#333' },
    
    fieldGroup: { marginBottom: '20px' },
    section: { marginBottom: '25px' },
    label: { display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#333', marginBottom: '5px' },
    input: { padding: '5px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px' },
    
    // AQUÍ ESTÁ LA CORRECCIÓN: Un solo border
    textAreaLine: { 
        width: '100%', 
        padding: '10px', 
        fontSize: '14px', 
        lineHeight: '1.5',
        backgroundColor: '#fdfdfd', 
        resize: 'vertical', 
        minHeight: '80px',
        border: '1px solid #e0e0e0', // Borde sutil
        borderRadius: '4px'
    },

    // Firmas
    signaturesRow: { display: 'flex', justifyContent: 'space-between', marginTop: '40px', gap: '40px' },
    sigColumn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' },
    sigLine: { width: '100%', height: '1px', backgroundColor: '#000', marginBottom: '5px' }, 
    sigLabel: { fontSize: '12px', color: '#444' }, 
    
    sigContainer: { width: '100%', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '10px', order: -1 }, 
    
    imgWrapper: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' },
    padWrapper: { width: '100%', height: '100%', border: '1px dashed #ccc', backgroundColor: '#fff', position: 'relative' },
    
    btnChangeSig: { fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginTop: '5px' },
    btnCancelSig: { fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginTop: '5px' },
    btnClear: { position: 'absolute', bottom: '2px', right: '2px', fontSize: '9px', background: '#eee', border: 'none', padding: '2px 5px', cursor: 'pointer' },

    footer: { display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '40px' },
    btnPrimary: { backgroundColor: '#0f4c81', color: 'white', padding: '10px 25px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
    btnSecondary: { backgroundColor: '#6c757d', color: 'white', padding: '10px 25px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }
};