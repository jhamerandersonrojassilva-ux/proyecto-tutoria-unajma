import { useState, useRef, useEffect } from 'react';
import SignaturePad from 'react-signature-pad-wrapper';

export default function ModalDerivacion({ estudiante, onGuardar, onClose, user, sesionAEditar }) { 
  
  // --- FUNCIÓN AUXILIAR FECHA (CORREGIDA PARA NO RESTAR DÍAS) ---
  const formatearFechaParaInput = (fechaISO) => {
    if (!fechaISO) return '';
    // Tomamos la parte de la fecha antes de la 'T' para evitar problemas de zona horaria
    if (fechaISO.includes('T')) {
        return fechaISO.split('T')[0];
    }
    return fechaISO; // Si ya viene como YYYY-MM-DD
  };

  // --- FUNCIÓN HELPER PARA FECHA LOCAL (ACTUAL) ---
  const obtenerFechaLocal = () => {
    const ahora = new Date();
    const fechaLocal = new Date(ahora.getTime() - (ahora.getTimezoneOffset() * 60000));
    return fechaLocal.toISOString().slice(0, 16);
  };

  // --- ESTADOS DE LOS CAMPOS ---
  const [nombreTutor, setNombreTutor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [oficinasSeleccionadas, setOficinasSeleccionadas] = useState(['Psicología']);
  
  // Fecha manual (con hora)
  const [fechaManual, setFechaManual] = useState(obtenerFechaLocal());
  
  // Datos del estudiante
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [celular, setCelular] = useState('');
  const [escuela, setEscuela] = useState(''); 
  const [edad, setEdad] = useState('');
  const [dni, setDni] = useState('');
  const [semestre, setSemestre] = useState('');

  // --- ESTADO VISUAL (FIRMA) ---
  const [editarFirma, setEditarFirma] = useState(true);

  const firmaRef = useRef(null);
  const oficinas = ["Medicina", "Nutrición", "Odontología", "Psicología", "Psicopedagogía", "Servicio Social"];

  // --- 1. EFECTO INICIAL (CARGAR DATOS DEL ESTUDIANTE) ---
  useEffect(() => {
    if (!estudiante) return;

    // A. Cargar datos base del estudiante (SIEMPRE)
    setCelular(estudiante.telefono || estudiante.celular || '');
    setEscuela(estudiante.escuela_profesional || 'Ingeniería de Sistemas');
    setDni(estudiante.dni || '');
    setEdad(estudiante.edad || '');
    
    // CORRECCIÓN: Carga robusta de SEMESTRE y FECHA NACIMIENTO
    setSemestre(estudiante.ciclo_actual || estudiante.semestre || estudiante.ciclo || '');
    setFechaNacimiento(formatearFechaParaInput(estudiante.fecha_nacimiento));

    // B. Si es NUEVO registro
    if (!sesionAEditar) {
        // Cargar nombre del tutor
        if (user?.nombre) {
            setNombreTutor(user.nombre);
        } else {
            const sesionLocal = localStorage.getItem('user');
            if (sesionLocal) {
                try {
                    const parsed = JSON.parse(sesionLocal);
                    setNombreTutor(parsed.nombre || parsed.username || '');
                } catch (e) {}
            }
        }
        
        // Intentar autocompletar desde la Ficha Integral (F01) si existe
        const fichaF01 = estudiante.sesiones?.find(s => s.tipo_formato === 'F01');
        if (fichaF01 && fichaF01.desarrollo_entrevista) {
            try {
              const datosF01 = typeof fichaF01.desarrollo_entrevista === 'string' 
                ? JSON.parse(fichaF01.desarrollo_entrevista) 
                : fichaF01.desarrollo_entrevista;

              if (datosF01.fecha_nacimiento) setFechaNacimiento(formatearFechaParaInput(datosF01.fecha_nacimiento));
              if (datosF01.edad) setEdad(datosF01.edad);
              if (datosF01.celular) setCelular(datosF01.celular);
            } catch (e) { console.error("Error leyendo F01", e); }
        }
    }
  }, [estudiante, user, sesionAEditar]); // Dependencias corregidas

  // --- 2. EFECTO DE EDICIÓN (SOBRESCRIBIR SI EDITAMOS) ---
  useEffect(() => {
    if (sesionAEditar) {
        // A. MOTIVO
        setMotivo(sesionAEditar.motivo_derivacion || sesionAEditar.motivo_consulta || sesionAEditar.motivo || '');

        // B. NOMBRE TUTOR
        if (sesionAEditar.nombre_tutor_deriva || sesionAEditar.nombre_tutor) {
            setNombreTutor(sesionAEditar.nombre_tutor_deriva || sesionAEditar.nombre_tutor);
        }
        
        // C. FECHA DE DERIVACIÓN
        const fechaRaw = sesionAEditar.fecha_manual || sesionAEditar.fecha || sesionAEditar.fecha_solicitud;
        if (fechaRaw) {
            const fechaGuardada = new Date(fechaRaw);
            // Ajuste manual simple para input datetime-local
            const year = fechaGuardada.getFullYear();
            const month = String(fechaGuardada.getMonth() + 1).padStart(2, '0');
            const day = String(fechaGuardada.getDate()).padStart(2, '0');
            const hours = String(fechaGuardada.getHours()).padStart(2, '0');
            const minutes = String(fechaGuardada.getMinutes()).padStart(2, '0');
            setFechaManual(`${year}-${month}-${day}T${hours}:${minutes}`);
        }
        
        // D. OFICINAS
        if (sesionAEditar.area_destino) {
            const areasLimpias = sesionAEditar.area_destino.split(',').map(item => item.trim());
            setOficinasSeleccionadas(areasLimpias);
        } else {
            setOficinasSeleccionadas([]); 
        }

        // E. DATOS GUARDADOS ESPECÍFICOS DE ESTA FICHA (SOBRESCRIBEN AL ESTUDIANTE)
        if (sesionAEditar.celular) setCelular(sesionAEditar.celular);
        if (sesionAEditar.edad) setEdad(sesionAEditar.edad);
        if (sesionAEditar.semestre) setSemestre(sesionAEditar.semestre); // RECUPERAR SEMESTRE
        if (sesionAEditar.fecha_nacimiento) setFechaNacimiento(formatearFechaParaInput(sesionAEditar.fecha_nacimiento)); // RECUPERAR FECHA NAC
        
        // F. FIRMA
        const firmaExistente = sesionAEditar.firma_tutor_url || sesionAEditar.firma_tutor;
        if (firmaExistente && firmaExistente.length > 50) {
            setEditarFirma(false); // Hay firma -> Mostrar imagen
        } else {
            setEditarFirma(true);  // No hay firma -> Mostrar canvas
        }

    } else {
        // MODO NUEVO
        setEditarFirma(true);
        setMotivo('');
        setOficinasSeleccionadas(['Psicología']);
        setFechaManual(obtenerFechaLocal());
    }
  }, [sesionAEditar]);

  const handleCheckboxChange = (oficina) => {
    setOficinasSeleccionadas(prev => 
      prev.includes(oficina) ? prev.filter(item => item !== oficina) : [...prev, oficina]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const areasSeleccionadas = oficinasSeleccionadas.join(', ');
    
    // --- LÓGICA DE GUARDADO DE FIRMA ---
    let firmaFinal = null;
    
    if (editarFirma) {
        if (firmaRef.current && !firmaRef.current.instance.isEmpty()) {
            firmaFinal = firmaRef.current.instance.toDataURL();
        } else {
            firmaFinal = null;
        }
    } else {
        firmaFinal = sesionAEditar?.firma_tutor_url || sesionAEditar?.firma_tutor;
    }

    if (!firmaFinal) return alert("⚠️ La firma es obligatoria. Por favor firme antes de guardar.");
    if (oficinasSeleccionadas.length === 0) return alert("⚠️ Seleccione al menos una oficina de destino.");

    onGuardar({ 
      id: sesionAEditar?.id, 
      estudiante_id: estudiante.id,
      tutor_id: user?.tutor_id || estudiante.tutor_asignado_id,
      
      motivo_consulta: motivo, 
      motivo_derivacion: motivo, 
      
      area_destino: areasSeleccionadas, 
      fecha_manual: fechaManual, 
      
      nombre_tutor: nombreTutor,
      nombre_tutor_deriva: nombreTutor,
      
      firma_tutor_url: firmaFinal,
      tipo_formato: 'F05',
      
      // GUARDAR DATOS DEL FORMULARIO
      fecha_nacimiento: fechaNacimiento,
      edad: parseInt(edad || 0),
      semestre: semestre,
      celular: celular,
      escuela_profesional: escuela
    });
  };

  const getFirmaSrc = () => {
      const src = sesionAEditar?.firma_tutor_url || sesionAEditar?.firma_tutor;
      if (!src) return null;
      return src.startsWith('http') ? `${src}?t=${Date.now()}` : src;
  };

  // Función para limpiar la firma
  const limpiarFirma = () => {
      if (firmaRef.current && firmaRef.current.instance) {
          firmaRef.current.instance.clear();
      }
  };

  return (
    // CAMBIO IMPORTANTE: zIndex elevado a 3500 para superar al Historial (2000)
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3500 }}>
      <div className="modal-content" style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', width: '800px', maxHeight: '95vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
        
        {/* ENCABEZADO */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #000', paddingBottom: '10px' }}>
          <img src="/logo_unajma.png" alt="Logo UNAJMA" style={{ width: '60px', height: 'auto', marginRight: '15px' }} />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '14px', margin: 0, fontWeight: 'bold' }}>UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS</h1>
            <h2 style={{ fontSize: '12px', margin: 0 }}>Dirección de Bienestar Universitario / Área de Tutoría</h2>
          </div>
          <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#d9534f' }}>FICHA TIPO 2 (F05)</div>
        </div>

        <h3 style={{ textAlign: 'center', fontSize: '16px', margin: '20px 0', fontWeight: 'bold', textDecoration: 'underline' }}>
          FICHA DE DERIVACIÓN DE TUTORÍA INDIVIDUAL (formato 05)
        </h3>

        <form onSubmit={handleSubmit}>
          {/* DATOS DEL ESTUDIANTE */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: '15px', marginBottom: '15px' }}>
            <div style={{ gridColumn: 'span 3' }}>
              <label><strong>Nombre y Apellidos del Tutorado:</strong></label>
              <input type="text" value={estudiante?.nombres_apellidos || ''} readOnly style={{ width: '100%', border: 'none', borderBottom: '1px solid #ccc', outline: 'none', backgroundColor: '#fdfdfd', padding: '5px 0' }} />
            </div>
            
            <div>
              <label><strong>Fecha de Nacimiento:</strong></label>
              <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} style={{ width: '100%', border: 'none', borderBottom: '1px solid #000', outline: 'none' }} required />
            </div>
            <div>
              <label><strong>Edad:</strong></label>
              <input type="number" value={edad} onChange={(e) => setEdad(e.target.value)} style={{ width: '100%', border: 'none', borderBottom: '1px solid #000', outline: 'none' }} required />
            </div>
            <div>
              <label><strong>DNI:</strong></label>
              <div style={{ borderBottom: '1px solid #ccc', padding: '4px 0', color: '#666' }}>{dni || estudiante?.dni}</div>
            </div>

            <div style={{ gridColumn: 'span 3' }}>
              <label><strong>Escuela Profesional:</strong></label>
              <input type="text" value={escuela} onChange={(e) => setEscuela(e.target.value)} style={{ width: '100%', border: 'none', borderBottom: '1px solid #000', outline: 'none' }} required />
            </div>

            <div>
              <label><strong>Código:</strong></label>
              <div style={{ borderBottom: '1px solid #ccc', padding: '4px 0', color: '#666' }}>{estudiante?.codigo_estudiante || ''}</div>
            </div>
            <div>
              <label><strong>Semestre:</strong></label>
              <input type="text" value={semestre} onChange={(e) => setSemestre(e.target.value)} style={{ width: '100%', border: 'none', borderBottom: '1px solid #000', outline: 'none' }} required />
            </div>
            <div>
              <label><strong>N° de Celular:</strong></label>
              <input type="text" value={celular} onChange={(e) => setCelular(e.target.value)} style={{ width: '100%', border: 'none', borderBottom: '1px solid #000', outline: 'none' }} required />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Nombre y Apellidos de tutor que deriva:</label>
            <input 
              type="text" 
              value={nombreTutor} 
              onChange={e => setNombreTutor(e.target.value)} 
              style={{ width: '100%', border: 'none', borderBottom: '2px solid #004a99', outline: 'none', fontWeight: 'bold', color: '#004a99', padding: '5px 0' }} 
              required 
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label><strong>Fecha de derivación:</strong></label>
            <input 
                type="datetime-local" 
                value={fechaManual} 
                onChange={(e) => setFechaManual(e.target.value)} 
                style={{ border: 'none', borderBottom: '1px solid #000', marginLeft: '10px', outline: 'none' }} 
                required 
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label><strong>Motivo de Derivación:</strong></label>
            <textarea 
              style={{ width: '100%', marginTop: '10px', border: 'none', borderBottom: '1px solid #000', lineHeight: '25px', resize: 'none', outline: 'none', backgroundImage: 'linear-gradient(transparent, transparent 24px, #eee 24px)', backgroundSize: '100% 25px' }} 
              rows="4" 
              value={motivo} 
              onChange={e => setMotivo(e.target.value)} 
              required 
            />
          </div>

          {/* CHECKBOXES DE OFICINAS */}
          <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#fdf2f2', borderRadius: '8px', border: '1px solid #ffa39e' }}>
            <p style={{ color: '#cf1322', fontWeight: 'bold', marginTop: 0 }}>Marque la(s) Oficina(s) de destino:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              {oficinas.map(of => (
                <label key={of} style={{ cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={oficinasSeleccionadas.includes(of)} onChange={() => handleCheckboxChange(of)} />
                  <span style={{ color: oficinasSeleccionadas.includes(of) ? '#cf1322' : '#333', fontWeight: oficinasSeleccionadas.includes(of) ? 'bold' : 'normal' }}>
                    {of} {oficinasSeleccionadas.includes(of) && '(X)'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* SECCIÓN DE FIRMA */}
          <div style={{ textAlign: 'center', marginTop: '30px' }}>
            <div style={{ width: '300px', margin: '0 auto', borderBottom: '2px solid #000', position: 'relative', backgroundColor: '#fff', minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              
              {!editarFirma && getFirmaSrc() ? (
                  // MODO VISUALIZACIÓN
                  <img 
                      src={getFirmaSrc()} 
                      alt="Firma" 
                      style={{ maxWidth: '100%', maxHeight: '100px', objectFit: 'contain' }}
                      onError={() => setEditarFirma(true)} 
                  />
              ) : (
                  // MODO EDICIÓN
                  <SignaturePad ref={firmaRef} canvasProps={{ width: 300, height: 100, className: 'sigCanvas' }} />
              )}

              <div style={{ position: 'absolute', top: '-30px', right: 0, display: 'flex', gap: '5px' }}>
                  {!editarFirma && getFirmaSrc() ? (
                      <button type="button" onClick={() => setEditarFirma(true)} style={{ fontSize: '10px', backgroundColor: '#004a99', color: 'white', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}>Cambiar Firma</button>
                  ) : (
                      <>
                        <button type="button" onClick={limpiarFirma} style={{ fontSize: '10px', backgroundColor: '#eee', border: '1px solid #ccc', cursor: 'pointer', padding: '2px 5px' }}>Limpiar</button>
                        {getFirmaSrc() && (
                             <button type="button" onClick={() => setEditarFirma(false)} style={{ fontSize: '10px', backgroundColor: '#eee', border: '1px solid #ccc', cursor: 'pointer', padding: '2px 5px' }}>Cancelar</button>
                        )}
                      </>
                  )}
              </div>

            </div>
            <p style={{ marginTop: '5px', fontSize: '12px', fontWeight: 'bold' }}>Firma del Tutor(a) que deriva</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 40px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cerrar</button>
            <button type="submit" style={{ padding: '10px 40px', backgroundColor: '#d9534f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(217, 83, 79, 0.3)' }}>Guardar Derivación</button>
          </div>
        </form>
      </div>
    </div>
  );
}