import { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';

export default function ModalRegistro({ estudiante, onGuardar, onClose, sesionAEditar }) {
  
  // --- FUNCIÓN HELPER PARA OBTENER FECHA LOCAL ---
  const obtenerFechaLocal = () => {
    const ahora = new Date();
    // Restamos el offset para obtener hora local en formato ISO correcto
    const fechaLocal = new Date(ahora.getTime() - (ahora.getTimezoneOffset() * 60000));
    return fechaLocal.toISOString().slice(0, 16);
  };

  // --- ESTADOS DE DATOS ---
  const [fecha, setFecha] = useState(obtenerFechaLocal());
  const [motivo, setMotivo] = useState('');
  const [acuerdos, setAcuerdos] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // --- ESTADOS VISUALES (CONTROL DE FIRMAS) ---
  // true = Muestra el Canvas (para firmar)
  // false = Muestra la Imagen (firma guardada)
  const [editarFirmaTutor, setEditarFirmaTutor] = useState(true);
  const [editarFirmaEst, setEditarFirmaEst] = useState(true);
  
  // Bandera para saber si pegamos una imagen desde F01 (bypass de isEmpty)
  const [firmaF01Cargada, setFirmaF01Cargada] = useState(false);
  
  const firmaTutorRef = useRef(null);
  const firmaEstudianteRef = useRef(null);

  // --- 1. EFECTO DE CARGA DE DATOS ---
  useEffect(() => {
    if (sesionAEditar) {
      // 1. CARGA DE TEXTOS
      setMotivo(sesionAEditar.motivo_consulta || '');
      setAcuerdos(sesionAEditar.acuerdos_compromisos || '');
      setObservaciones(sesionAEditar.observaciones || '');
      
      // 2. AJUSTE DE ZONA HORARIA (FECHA)
      if (sesionAEditar.fecha) {
        const fechaGuardada = new Date(sesionAEditar.fecha);
        const fechaAjustada = new Date(fechaGuardada.getTime() - (fechaGuardada.getTimezoneOffset() * 60000));
        setFecha(fechaAjustada.toISOString().slice(0, 16));
      }
      
      // 3. LÓGICA DE FIRMAS (CORREGIDO)
      // Si hay URL, ocultamos el canvas (false) para ver la imagen.
      // Si no hay URL, mostramos el canvas (true) para dibujar.
      if (sesionAEditar.firma_tutor_url) {
          setEditarFirmaTutor(false); 
      } else {
          setEditarFirmaTutor(true);
      }

      if (sesionAEditar.firma_estudiante_url) {
          setEditarFirmaEst(false);
      } else {
          setEditarFirmaEst(true);
      }

      setFirmaF01Cargada(false); // Reseteamos bandera F01

    } else {
      // --- MODO NUEVO ---
      setMotivo('');
      setAcuerdos('');
      setObservaciones('');
      
      setEditarFirmaTutor(true); // Mostrar canvas limpio
      setEditarFirmaEst(true);   // Mostrar canvas limpio
      setFirmaF01Cargada(false);
      
      setFecha(obtenerFechaLocal());
    }
  }, [sesionAEditar]);
  // --- 2. LÓGICA IMPORTAR FIRMA DESDE F01 ---
  const fichaF01 = estudiante?.sesiones?.find(s => s.tipo_formato === 'F01');
  let firmaF01Url = null;
  if (fichaF01) {
    firmaF01Url = fichaF01.firma_estudiante_url;
    // Soporte para versiones antiguas que guardaban JSON en desarrollo_entrevista
    if (!firmaF01Url && fichaF01.desarrollo_entrevista) {
      try {
        const d = typeof fichaF01.desarrollo_entrevista === 'string' 
          ? JSON.parse(fichaF01.desarrollo_entrevista) 
          : fichaF01.desarrollo_entrevista;
        firmaF01Url = d.firma_estudiante_url || d.firma_estudiante;
      } catch (e) {}
    }
  }

  const cargarFirmaDesdeF01 = () => {
    if (!firmaF01Url) return alert("⚠️ No hay firma en la Ficha Integral (F01).");
    
    setEditarFirmaEst(true);
    
    setTimeout(() => {
      const sigCanvas = firmaEstudianteRef.current;
      if (sigCanvas) {
        const canvas = sigCanvas.getCanvas(); 
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.src = (firmaF01Url && firmaF01Url.startsWith('http')) 
          ? `${firmaF01Url}?t=${Date.now()}` 
          : firmaF01Url;
        
        img.crossOrigin = "Anonymous";

        img.onload = () => {
          sigCanvas.clear();
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // IMPORTANTE: Marcamos que ya hay firma, aunque el pad diga isEmpty()
          setFirmaF01Cargada(true); 
        };
      }
    }, 100); 
  };

  // --- 3. RECALIBRACIÓN CANVAS (Responsive) ---
  useEffect(() => {
    if (editarFirmaTutor || editarFirmaEst) {
      const timer = setTimeout(() => {
        const recalibrar = (ref) => {
          if (ref.current) {
            const canvas = ref.current.getCanvas();
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext("2d").scale(ratio, ratio);
          }
        };
        if (editarFirmaTutor) recalibrar(firmaTutorRef);
        if (editarFirmaEst) recalibrar(firmaEstudianteRef);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [editarFirmaTutor, editarFirmaEst]);

  // --- 4. HANDLE SUBMIT (GUARDAR) ---
  // Reemplaza la función handleSubmit dentro de ModalRegistro.jsx con esta:
const handleSubmit = (e) => {
  e.preventDefault();
  
  let fTutorFinal = null;
  if (editarFirmaTutor) {
    fTutorFinal = (firmaTutorRef.current && !firmaTutorRef.current.isEmpty()) 
      ? firmaTutorRef.current.getCanvas().toDataURL('image/png') 
      : null;
  } else {
    fTutorFinal = sesionAEditar?.firma_tutor_url || sesionAEditar?.firma_tutor;
  }

  let fEstFinal = null;
  if (editarFirmaEst) {
    const ref = firmaEstudianteRef.current;
    if (ref && (!ref.isEmpty() || firmaF01Cargada)) {
       fEstFinal = ref.getCanvas().toDataURL('image/png');
    } else { fEstFinal = null; }
  } else {
    fEstFinal = sesionAEditar?.firma_estudiante_url || sesionAEditar?.firma_estudiante;
  }

  // --- EMPAQUETADO PARA EL BACKEND ---
  onGuardar({ 
    id: sesionAEditar?.id,
    fecha: fecha, 
    motivo_consulta: motivo, 
    acuerdos_compromisos: acuerdos,
    observaciones: observaciones || "", 
    firma_tutor_url: fTutorFinal,
    firma_estudiante_url: fEstFinal,
    tipo_formato: 'F04',
    estudiante_id: estudiante?.id // Aseguramos que viaje el ID
  });
};

  const btnStyle = { fontSize: '10px', cursor: 'pointer', border: '1px solid', borderRadius: '4px', padding: '2px 8px', background: 'white' };
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', padding: '15px 40px', borderRadius: '8px', width: '750px', maxHeight: '98vh', overflowY: 'auto' }}>
        
        {/* ENCABEZADO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <img src="/logo_unajma.png" alt="Logo" style={{ width: '45px', height: 'auto' }} />
             <div style={{ lineHeight: '1.2' }}>
               <div style={{ fontWeight: 'bold', fontSize: '11px' }}>UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS</div>
               <div style={{ fontSize: '10px' }}>Área de Tutoría</div>
             </div>
           </div>
           <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#004a99' }}>ÁREA DE TUTORÍA</div>
        </div>

        <h2 style={{ textAlign: 'center', fontSize: '18px', textDecoration: 'underline', marginBottom: '20px', fontWeight: 'bold' }}>
          FICHA DE SEGUIMIENTO DE TUTORÍA INDIVIDUAL (formato 04)
        </h2>

        <form onSubmit={handleSubmit}>
          {/* IDENTIFICACIÓN */}
          <div style={{ marginBottom: '15px', lineHeight: '2' }}>
            <p><strong>Nombre y Apellidos del Tutorado:</strong> {estudiante?.nombres_apellidos}</p>
            <p><strong>Escuela Profesional:</strong> {estudiante?.escuela_profesional || 'EPIS'}</p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <strong>Fecha:</strong>
              <input 
                type="datetime-local" 
                style={{ padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }} 
                value={fecha} 
                onChange={(e) => setFecha(e.target.value)} 
                required 
              />
            </div>
          </div>

          {/* CAMPOS DE TEXTO */}
          {[
            { label: 'Aspectos abordados:', value: motivo, setter: setMotivo },
            { label: 'Acuerdos:', value: acuerdos, setter: setAcuerdos },
            { label: 'Observaciones del tutor:', value: observaciones, setter: setObservaciones }
          ].map((campo, idx) => (
            <div key={idx} style={{ marginBottom: '15px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>{campo.label}</label>
              <textarea 
                style={{ 
                  width: '100%', border: 'none', outline: 'none', minHeight: '72px', resize: 'none', 
                  lineHeight: '24px', fontSize: '14px', backgroundColor: 'transparent',
                  backgroundImage: 'linear-gradient(transparent, transparent 23px, #333 23px)', 
                  backgroundSize: '100% 24px', overflow: 'hidden'
                }} 
                value={campo.value} 
                onChange={e => campo.setter(e.target.value)}
                required={idx < 2}
              />
            </div>
          ))}

          {/* --- SECCIÓN DE FIRMAS --- */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
            
            {/* 1. FIRMA TUTOR */}
            <div style={{ textAlign: 'center', width: '48%' }}>
              <div style={{ borderBottom: '1px solid #000', marginBottom: '5px', height: '105px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!editarFirmaTutor && (sesionAEditar?.firma_tutor_url || sesionAEditar?.firma_tutor) ? (
                  <img 
                    src={
                      (sesionAEditar.firma_tutor_url || sesionAEditar.firma_tutor)?.startsWith('http')
                        ? `${sesionAEditar.firma_tutor_url || sesionAEditar.firma_tutor}?t=${Date.now()}`
                        : (sesionAEditar.firma_tutor_url || sesionAEditar.firma_tutor)
                    }
                    alt="Firma Tutor" 
                    style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }}
                    onError={() => setEditarFirmaTutor(true)} 
                  />
                ) : (
                  <SignatureCanvas ref={firmaTutorRef} penColor='black' canvasProps={{ className: 'sigCanvas', style: {width: '100%', height: '100px'} }} />
                )}
              </div>
              
              <p style={{ fontSize: '12px', margin: 0 }}>Firma del Tutor(a)</p>
              
              <div style={{ marginTop: '5px' }}>
                {!editarFirmaTutor && (sesionAEditar?.firma_tutor_url || sesionAEditar?.firma_tutor) ? (
                  <button type="button" onClick={() => setEditarFirmaTutor(true)} style={{...btnStyle, color: '#004a99', borderColor: '#004a99'}}>🔄 Cambiar Firma</button>
                ) : (
                  <>
                    <button type="button" onClick={() => firmaTutorRef.current?.clear()} style={{...btnStyle, color: 'red', borderColor: 'red'}}>Borrar</button>
                    {(sesionAEditar?.firma_tutor_url || sesionAEditar?.firma_tutor) && (
                      <button type="button" onClick={() => setEditarFirmaTutor(false)} style={{...btnStyle, marginLeft: '5px'}}>Cancelar</button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 2. FIRMA ESTUDIANTE */}
            <div style={{ textAlign: 'center', width: '48%' }}>
              <div style={{ borderBottom: '1px solid #000', marginBottom: '5px', height: '105px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!editarFirmaEst && (sesionAEditar?.firma_estudiante_url || sesionAEditar?.firma_estudiante) ? (
                  <img 
                    src={
                      (sesionAEditar.firma_estudiante_url || sesionAEditar.firma_estudiante)?.startsWith('http')
                        ? `${sesionAEditar.firma_estudiante_url || sesionAEditar.firma_estudiante}?t=${Date.now()}`
                        : (sesionAEditar.firma_estudiante_url || sesionAEditar.firma_estudiante)
                    }
                    alt="Firma Estudiante" 
                    style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }}
                    onError={() => setEditarFirmaEst(true)}
                  />
                ) : (
                  <SignatureCanvas ref={firmaEstudianteRef} penColor='black' canvasProps={{ className: 'sigCanvas', style: {width: '100%', height: '100px'} }} />
                )}
              </div>

              <p style={{ fontSize: '12px', margin: 0 }}>Firma del estudiante tutorado</p>
              
              <div style={{ marginTop: '5px', display: 'flex', justifyContent: 'center', gap: '5px' }}>
                {!editarFirmaEst && (sesionAEditar?.firma_estudiante_url || sesionAEditar?.firma_estudiante) ? (
                  <button type="button" onClick={() => setEditarFirmaEst(true)} style={{...btnStyle, color: '#004a99', borderColor: '#004a99'}}>🔄 Cambiar Firma</button>
                ) : (
                  <>
                    <button type="button" onClick={cargarFirmaDesdeF01} style={{...btnStyle, color: '#004a99', borderColor: '#004a99'}}>📂 Cargar F01</button>
                    <button 
                      type="button" 
                      onClick={() => {
                        firmaEstudianteRef.current?.clear();
                        setFirmaF01Cargada(false); 
                      }} 
                      style={{...btnStyle, color: 'red', borderColor: 'red'}}
                    >
                      Borrar
                    </button>
                    {(sesionAEditar?.firma_estudiante_url || sesionAEditar?.firma_estudiante) && (
                      <button type="button" onClick={() => setEditarFirmaEst(false)} style={{...btnStyle, marginLeft: '5px'}}>Cancelar</button>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 30px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}>Cancelar</button>
            <button type="submit" style={{ padding: '10px 30px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Guardar Sesión</button>
          </div>
        </form>
      </div>
    </div>
  );
}