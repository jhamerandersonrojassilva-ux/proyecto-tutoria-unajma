import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';

export default function ModalFichaEntrevista({ estudiante, user, onClose, onGuardar, sesionAEditar }) {

  // --- 1. FUNCIÓN HELPER PARA FECHA LOCAL ---
  const obtenerFechaHoy = () => {
    const ahora = new Date();
    const fechaLocal = new Date(ahora.getTime() - (ahora.getTimezoneOffset() * 60000));
    return fechaLocal.toISOString().split('T')[0];
  };

  // --- 2. ESTADOS ---
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [motivo, setMotivo] = useState('');
  const [desarrollo, setDesarrollo] = useState('');
  const [acuerdos, setAcuerdos] = useState('');
  const [area, setArea] = useState('Académica');
  const [proximaCita, setProximaCita] = useState('');
  const [enviando, setEnviando] = useState(false);

  // --- ESTADOS DE FIRMAS (AGREGADOS PARA CORREGIR EL ERROR) ---
  const [firmaTutor, setFirmaTutor] = useState(null);
  const [firmaEstudiante, setFirmaEstudiante] = useState(null);

  // Referencias para el canvas
  const sigCanvasTutor = useRef(null);
  const sigCanvasEst = useRef(null);

  // Control de edición (true = mostrando canvas, false = mostrando imagen)
  const [editandoFirmaTutor, setEditandoFirmaTutor] = useState(true);
  const [editandoFirmaEst, setEditandoFirmaEst] = useState(true);

  // --- 3. CARGA DE DATOS (USE EFFECT) ---
  useEffect(() => {
    if (sesionAEditar) {

      // A. FECHA
      if (sesionAEditar.fecha) {
        const fechaGuardada = new Date(sesionAEditar.fecha);
        const fechaAjustada = new Date(fechaGuardada.getTime() - (fechaGuardada.getTimezoneOffset() * 60000));
        setFecha(fechaAjustada.toISOString().split('T')[0]);
      } else {
        setFecha(obtenerFechaHoy());
      }

      // B. TEXTOS
      setMotivo(sesionAEditar.motivo_consulta || '');
      setDesarrollo(sesionAEditar.desarrollo_entrevista || '');
      setAcuerdos(sesionAEditar.acuerdos_compromisos || '');

      // C. OBSERVACIONES (JSON)
      if (sesionAEditar.observaciones && sesionAEditar.observaciones.startsWith('{')) {
        try {
          const extra = JSON.parse(sesionAEditar.observaciones);
          setArea(extra.area || 'Académica');
          setProximaCita(extra.proxima_cita || '');
        } catch (e) { }
      }

      // D. FIRMAS (CARGA AL ESTADO)
      if (sesionAEditar.firma_tutor_url) {
        setFirmaTutor(sesionAEditar.firma_tutor_url);
        setEditandoFirmaTutor(false); // Mostrar imagen
      } else {
        setFirmaTutor(null);
        setEditandoFirmaTutor(true); // Mostrar canvas
      }

      if (sesionAEditar.firma_estudiante_url) {
        setFirmaEstudiante(sesionAEditar.firma_estudiante_url);
        setEditandoFirmaEst(false); // Mostrar imagen
      } else {
        setFirmaEstudiante(null);
        setEditandoFirmaEst(true); // Mostrar canvas
      }

    } else {
      // --- MODO NUEVO REGISTRO ---
      setFecha(obtenerFechaHoy());
      setMotivo(''); setDesarrollo(''); setAcuerdos('');
      setArea('Académica'); setProximaCita('');

      // Limpiar firmas
      setFirmaTutor(null); setFirmaEstudiante(null);
      setEditandoFirmaTutor(true);
      setEditandoFirmaEst(true);
    }
  }, [sesionAEditar]);

  // --- 4. GUARDADO ---
  // --- PEGAR EN ModalFichaEntrevista.jsx (Reemplaza la función handleSubmit) ---

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);

    // Lógica para obtener la firma final (Imagen guardada o Nuevo dibujo)
    let firmaTutorFinal = firmaTutor;

    // CORRECCIÓN: Usamos .getCanvas() en lugar de .getTrimmedCanvas() para evitar el error
    if (editandoFirmaTutor && sigCanvasTutor.current && !sigCanvasTutor.current.isEmpty()) {
      firmaTutorFinal = sigCanvasTutor.current.getCanvas().toDataURL('image/png');
    }

    let firmaEstFinal = firmaEstudiante;

    // CORRECCIÓN: Usamos .getCanvas() aquí también
    if (editandoFirmaEst && sigCanvasEst.current && !sigCanvasEst.current.isEmpty()) {
      firmaEstFinal = sigCanvasEst.current.getCanvas().toDataURL('image/png');
    }

    const datosExtra = JSON.stringify({ area, proxima_cita: proximaCita });

    const datosGuardar = {
      id: sesionAEditar?.id,
      estudiante_id: estudiante.id,
      tutor_id: user.tutor_id || user.id,
      fecha,
      motivo_consulta: motivo,
      desarrollo_entrevista: desarrollo,
      acuerdos_compromisos: acuerdos,
      observaciones: datosExtra,
      firma_tutor_url: firmaTutorFinal,
      firma_estudiante_url: firmaEstFinal,
      tipo_formato: 'F03'
    };

    const exito = await onGuardar(datosGuardar);
    if (exito) onClose();
    setEnviando(false);
  };

  // --- 5. RENDERIZADO ---
  return (
    <div style={styles.overlay}>
      <div style={styles.modalContainer}>

        {/* ENCABEZADO */}
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo_unajma.png" alt="UNAJMA" style={{ width: '40px', height: '40px' }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#0f172a' }}>UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS</div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>OFICINA DE TUTORÍA Y APOYO PEDAGÓGICO</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#004a99' }}>F03</div>
            <button onClick={onClose} style={styles.closeBtn}>Cerrar ✕</button>
          </div>
        </div>

        <h2 style={styles.documentTitle}>FICHA DE ENTREVISTA INDIVIDUAL</h2>

        {/* CONTENIDO */}
        <div style={styles.modalContent}>
          <form onSubmit={handleSubmit} id="f03Form">

            {/* DATOS ESTÁTICOS */}
            <div style={styles.infoBox}>
              <div style={{ marginBottom: '4px' }}>
                <span style={styles.labelBold}>ESTUDIANTE: </span>
                <span style={styles.textValue}>{estudiante?.nombres_apellidos}</span>
              </div>
              <div>
                <span style={styles.labelBold}>ESCUELA PROFESIONAL: </span>
                <span style={styles.textValue}>{estudiante?.escuela_profesional}</span>
              </div>
            </div>

            {/* FECHA Y ÁREA */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <label style={styles.labelBold}>FECHA: </label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={styles.dateInput} required />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                <label style={styles.labelBold}>ÁREA: </label>
                <select value={area} onChange={e => setArea(e.target.value)} style={styles.selectInput}>
                  <option>Académica</option>
                  <option>Personal</option>
                  <option>Profesional</option>
                  <option>Familiar</option>
                  <option>Socioemocional</option>
                </select>
              </div>
            </div>

            {/* CAMPOS DE TEXTO */}
            <div style={styles.formGroup}>
              <div style={styles.labelSection}>MOTIVO DE LA ENTREVISTA:</div>
              <textarea rows="2" value={motivo} onChange={e => setMotivo(e.target.value)} style={styles.linedTextarea} />
            </div>

            <div style={styles.formGroup}>
              <div style={styles.labelSection}>DESARROLLO DE LA ENTREVISTA:</div>
              <textarea rows="8" value={desarrollo} onChange={e => setDesarrollo(e.target.value)} style={styles.linedTextarea} />
            </div>

            <div style={styles.formGroup}>
              <div style={styles.labelSection}>ACUERDOS / COMPROMISOS:</div>
              <textarea rows="3" value={acuerdos} onChange={e => setAcuerdos(e.target.value)} style={styles.linedTextarea} />
            </div>

            <div style={styles.formGroup}>
              <div style={styles.labelSection}>PRÓXIMA CITA:</div>
              <input type="text" value={proximaCita} onChange={e => setProximaCita(e.target.value)} style={styles.simpleInput} placeholder="Ej: 20/10/2026" />
            </div>

            {/* FIRMAS */}
            <div style={styles.signatureRow}>
              {/* TUTOR */}
              <div style={styles.signatureCol}>
                <div style={styles.signatureBox}>
                  {!editandoFirmaTutor && firmaTutor ? (
                    <img src={firmaTutor} alt="Firma Tutor" style={{ height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <SignatureCanvas
                      ref={sigCanvasTutor}
                      penColor='black'
                      canvasProps={{ style: { width: '100%', height: '100%' } }}
                    />
                  )}
                </div>
                <div style={styles.sigLine}></div>
                <div style={styles.sigLabel}>FIRMA DEL TUTOR(A)</div>
                <button type="button" onClick={() => {
                  if (!editandoFirmaTutor) {
                    setEditandoFirmaTutor(true); // Pasar a modo edición
                  } else {
                    sigCanvasTutor.current.clear(); // Limpiar canvas
                  }
                }}
                  style={styles.linkBtn}>
                  {!editandoFirmaTutor ? 'Cambiar / Firmar de nuevo' : 'Borrar'}
                </button>
              </div>

              {/* ESTUDIANTE */}
              <div style={styles.signatureCol}>
                <div style={styles.signatureBox}>
                  {!editandoFirmaEst && firmaEstudiante ? (
                    <img src={firmaEstudiante} alt="Firma Estudiante" style={{ height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <SignatureCanvas
                      ref={sigCanvasEst}
                      penColor='black'
                      canvasProps={{ style: { width: '100%', height: '100%' } }}
                    />
                  )}
                </div>
                <div style={styles.sigLine}></div>
                <div style={styles.sigLabel}>FIRMA DEL ESTUDIANTE</div>
                <button type="button" onClick={() => {
                  if (!editandoFirmaEst) {
                    setEditandoFirmaEst(true);
                  } else {
                    sigCanvasEst.current.clear();
                  }
                }}
                  style={styles.linkBtn}>
                  {!editandoFirmaEst ? 'Cambiar / Firmar de nuevo' : 'Borrar'}
                </button>
              </div>
            </div>

          </form>
        </div>

        {/* FOOTER */}
        <div style={styles.modalFooter}>
          <button type="button" onClick={onClose} style={styles.cancelBtn} disabled={enviando}>Cancelar</button>
          <button type="submit" form="f03Form" style={styles.submitBtn} disabled={enviando}>
            {enviando ? 'GUARDANDO...' : 'GUARDAR FICHA'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ESTILOS ---
const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 2000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: '20px',
    paddingBottom: '20px',
    backdropFilter: 'blur(3px)'
  },
  modalContainer: {
    backgroundColor: '#fff',
    height: '95vh',
    width: '750px',
    maxWidth: '95%',
    borderRadius: '4px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  modalHeader: {
    padding: '15px 25px',
    borderBottom: '2px solid #004a99',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '11px',
    color: '#64748b',
    cursor: 'pointer',
    fontWeight: 'bold',
    marginLeft: '10px'
  },
  documentTitle: {
    textAlign: 'center',
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#000',
    marginTop: '15px',
    marginBottom: '10px',
    textDecoration: 'underline'
  },
  modalContent: {
    padding: '10px 30px',
    overflowY: 'auto',
    flex: 1
  },
  infoBox: {
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    padding: '10px',
    marginBottom: '15px'
  },
  labelBold: { fontSize: '11px', fontWeight: '800', color: '#0f172a' },
  textValue: { fontSize: '12px', color: '#334155', fontWeight: '600', marginLeft: '5px' },
  dateInput: { border: '1px solid #ccc', borderRadius: '3px', padding: '3px', fontSize: '12px' },
  selectInput: { border: '1px solid #ccc', borderRadius: '3px', padding: '3px', fontSize: '12px', width: '100%' },
  formGroup: { marginBottom: '12px' },
  labelSection: { fontSize: '11px', fontWeight: 'bold', marginBottom: '2px', color: '#333' },
  linedTextarea: {
    width: '100%',
    padding: '8px',
    border: '1px solid #e2e8f0',
    borderBottom: '1px solid #64748b',
    backgroundColor: '#fff',
    fontSize: '13px',
    lineHeight: '1.5',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'Arial, sans-serif'
  },
  simpleInput: {
    width: '100%', border: 'none', borderBottom: '1px solid #000',
    padding: '5px', fontSize: '13px', outline: 'none'
  },
  signatureRow: { display: 'flex', justifyContent: 'space-around', marginTop: '20px', gap: '30px' },
  signatureCol: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  signatureBox: {
    width: '100%',
    height: '120px',
    border: '1px dashed #ccc',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  sigLine: { width: '80%', height: '1px', backgroundColor: '#000', marginTop: '2px' },
  sigLabel: { fontSize: '10px', fontWeight: 'bold', marginTop: '2px' },
  linkBtn: { background: 'none', border: 'none', color: '#2563eb', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline', marginTop: '4px' },
  modalFooter: {
    padding: '15px 25px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'center',
    gap: '15px',
    backgroundColor: '#fff'
  },
  cancelBtn: { padding: '8px 25px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  submitBtn: { padding: '8px 25px', borderRadius: '4px', border: 'none', backgroundColor: '#004a99', color: 'white', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }
};