import { useState, useRef, useEffect } from 'react';
import SignaturePad from 'react-signature-pad-wrapper';

export default function ModalSesion({ estudiante, onGuardar, onClose }) {
  if (!estudiante) return null;

  const ahora = new Date();
  const fechaLocal = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16);

  const [motivo, setMotivo] = useState('');
  const [acuerdos, setAcuerdos] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fechaManual, setFechaManual] = useState(fechaLocal);

  const firmaTutorRef = useRef(null);
  const firmaEstudianteRef = useRef(null);

  // --- 1. LÓGICA PARA RECUPERAR FIRMA DE F01 ---
  // Buscamos la ficha F01 dentro de las sesiones del estudiante
  const fichaF01 = estudiante?.sesiones?.find(s => s.tipo_formato === 'F01');
  let firmaGuardadaUrl = null;

  if (fichaF01) {
    // A. Intentamos leer la firma directa de la base de datos
    firmaGuardadaUrl = fichaF01.firma_estudiante_url;
    
    // B. Si no hay, buscamos dentro del JSON 'desarrollo_entrevista' (backup)
    if (!firmaGuardadaUrl && fichaF01.desarrollo_entrevista) {
      try {
        const datosJson = typeof fichaF01.desarrollo_entrevista === 'string'
          ? JSON.parse(fichaF01.desarrollo_entrevista)
          : fichaF01.desarrollo_entrevista;
        firmaGuardadaUrl = datosJson.firma_estudiante_url || datosJson.firma_estudiante;
      } catch (e) { 
        console.error("Error recuperando firma F01:", e); 
      }
    }
  }

  // Función para pintar la imagen en el canvas del estudiante
  const cargarFirmaGuardada = () => {
    if (!firmaGuardadaUrl) {
      alert("⚠️ El estudiante no tiene una firma registrada en su Ficha Integral (F01).");
      return;
    }
    
    const instance = firmaEstudianteRef.current?.instance;
    if (instance) {
      const canvas = instance._canvas;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      // Agregamos timestamp para evitar caché
      img.src = firmaGuardadaUrl.startsWith('http') ? `${firmaGuardadaUrl}?t=${Date.now()}` : firmaGuardadaUrl;
      
      img.onload = () => {
        instance.clear(); // Limpiamos antes de dibujar
        // Dibujamos la imagen ajustada al tamaño del canvas (250x120)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.onerror = () => alert("❌ Error al cargar la imagen de la firma.");
    }
  };

  // --- 2. RECALIBRACIÓN DEL CANVAS (Evita trazos desplazados) ---
  useEffect(() => {
    const timer = setTimeout(() => {
      const recalibrar = (ref) => {
        if (ref.current && ref.current.instance && ref.current.instance._canvas) {
          const canvas = ref.current.instance._canvas;
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          canvas.width = canvas.offsetWidth * ratio;
          canvas.height = canvas.offsetHeight * ratio;
          canvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
          ref.current.instance.clear(); 
        }
      };
      recalibrar(firmaTutorRef);
      recalibrar(firmaEstudianteRef);
    }, 400); 
    return () => clearTimeout(timer);
  }, []);

  const limpiarTutor = () => firmaTutorRef.current?.instance.clear();
  const limpiarEstudiante = () => firmaEstudianteRef.current?.instance.clear();

  const handleSubmit = (e) => {
    e.preventDefault();

    const session = JSON.parse(localStorage.getItem('user') || '{}');
    const tutorIdFinal = session.tutor_id || session.id;

    if (!tutorIdFinal) {
      alert("❌ Error: No se detectó ID del tutor. Reinicie sesión.");
      return;
    }

    const imgTutor = firmaTutorRef.current?.instance.isEmpty() 
      ? null 
      : firmaTutorRef.current.instance.toDataURL('image/png');

    const imgEst = firmaEstudianteRef.current?.instance.isEmpty() 
      ? null 
      : firmaEstudianteRef.current.instance.toDataURL('image/png');

    onGuardar({
      estudiante_id: estudiante.id,
      tutor_id: tutorIdFinal,
      motivo_consulta: motivo, 
      acuerdos_compromisos: acuerdos, 
      observaciones: observaciones,
      fecha: fechaManual,
      firma_tutor_url: imgTutor,
      firma_estudiante_url: imgEst,
      tipo_formato: 'F04'
    });
  };

  // Estilo para los textareas (renglones)
  const estiloRenglones = {
    width: '100%',
    border: 'none',
    outline: 'none',
    minHeight: '72px',
    resize: 'none',
    lineHeight: '24px',
    fontSize: '14px',
    backgroundColor: 'transparent',
    backgroundImage: 'linear-gradient(transparent, transparent 23px, #333 23px)',
    backgroundSize: '100% 24px',
    overflow: 'hidden'
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div className="modal-content" style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '600px', maxHeight: '95vh', overflowY: 'auto' }}>
        
        <h2 style={{ textAlign: 'center', fontSize: '18px', textDecoration: 'underline', marginBottom: '20px' }}>
          FICHA DE SEGUIMIENTO DE TUTORÍA INDIVIDUAL (formato 04)
        </h2>

        <div style={{ marginBottom: '15px', fontSize: '14px' }}>
          <p><strong>Nombre y Apellidos del Tutorado:</strong> {estudiante.nombres_apellidos}</p>
          <p><strong>Escuela Profesional:</strong> {estudiante.escuela_profesional || estudiante.escuela || 'EPIS'}</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontWeight: 'bold' }}>Fecha: </label>
            <input type="datetime-local" value={fechaManual} onChange={(e) => setFechaManual(e.target.value)} required />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontWeight: 'bold', display: 'block' }}>Aspectos abordados:</label>
            <textarea style={estiloRenglones} value={motivo} onChange={e => setMotivo(e.target.value)} required />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontWeight: 'bold', display: 'block' }}>Acuerdos:</label>
            <textarea style={estiloRenglones} value={acuerdos} onChange={e => setAcuerdos(e.target.value)} required />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ fontWeight: 'bold', display: 'block' }}>Observaciones del tutor:</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} style={{ width: '100%', border: 'none', borderBottom: '1px solid #000', outline: 'none', backgroundColor: '#f9f9f9' }} rows="2" placeholder="Notas adicionales del tutor..." />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', textAlign: 'center' }}>
            {/* --- FIRMA DEL TUTOR --- */}
            <div style={{ width: '250px' }}>
              <div style={{ border: '1px solid #eee', marginBottom: '5px', backgroundColor: '#fcfcfc' }}>
                <SignaturePad ref={firmaTutorRef} canvasProps={{ width: 250, height: 120, className: 'sigCanvas' }} />
              </div>
              <div style={{ borderTop: '1px solid black', paddingTop: '5px' }}>
                <p style={{ margin: 0, fontSize: '12px' }}>Firma del Tutor(a)</p>
                <button type="button" onClick={limpiarTutor} style={{ fontSize: '9px', color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>Borrar</button>
              </div>
            </div>

            {/* --- FIRMA DEL ESTUDIANTE (CON BOTÓN DE CARGA) --- */}
            <div style={{ width: '250px' }}>
              <div style={{ border: '1px solid #eee', marginBottom: '5px', backgroundColor: '#fcfcfc' }}>
                <SignaturePad ref={firmaEstudianteRef} canvasProps={{ width: 250, height: 120, className: 'sigCanvas' }} />
              </div>
              <div style={{ borderTop: '1px solid black', paddingTop: '5px' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '12px' }}>Firma del estudiante tutorado</p>
                
                {/* BOTONES DE ACCIÓN */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 5px' }}>
                  <button 
                    type="button" 
                    onClick={cargarFirmaGuardada}
                    title="Cargar firma registrada en Ficha Integral F01"
                    style={{ 
                      fontSize: '10px', 
                      color: '#004a99', 
                      border: '1px solid #004a99', 
                      borderRadius: '4px', 
                      background: 'white',
                      cursor: 'pointer',
                      padding: '3px 8px',
                      fontWeight: 'bold'
                    }}
                  >
                    📂 Cargar Firma F01
                  </button>

                  <button 
                    type="button" 
                    onClick={limpiarEstudiante} 
                    style={{ fontSize: '10px', color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '40px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 30px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}>Cancelar</button>
            <button type="submit" style={{ padding: '10px 30px', backgroundColor: '#004a99', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Guardar Sesión</button>
          </div>
        </form>
      </div>
    </div>
  );
}