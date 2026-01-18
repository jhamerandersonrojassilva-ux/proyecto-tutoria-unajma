import React, { useState, useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import 'jspdf-autotable';
import { generarF01 } from '../utils/generadorF01';

// --- FUNCIÓN DE VALIDACIÓN SEGURA ---
const validar = (valor) => {
  if (valor === null || valor === undefined || valor === 'null') return '';
  return valor;
};

// --- HELPER PARA OBTENER NOMBRE DEL TUTOR SEGURO ---
const getNombreTutor = (usuario) => {
  if (!usuario) return '';
  // Intenta buscar en varias propiedades comunes por si acaso
  return usuario.nombres_apellidos || usuario.nombre || usuario.nombres || usuario.username || '';
};

export default function ModalFichaIntegral({ estudiante, user, onClose, onGuardar, sesionAEditar }) {
  const [paso, setPaso] = useState(1);
  const sigCanvasTutor = useRef(null);
  const sigCanvasEstudiante = useRef(null);

  // Estados para controlar si el usuario desea sobreescribir la firma existente
  const [cambiarFirmaTutor, setCambiarFirmaTutor] = useState(false);
  const [cambiarFirmaEstudiante, setCambiarFirmaEstudiante] = useState(false);

  // 1. ESTADO INICIAL
  const [datos, setDatos] = useState({
    fecha_nacimiento: '', edad: 0, lugar_nacimiento: '', direccion_actual: '', telefono: '',
    correo_institucional: '', estado_civil: 'soltero', año_ingreso: '', ciclo_actual: '',
    
    nombre_tutor: '', // Se llenará en el useEffect
    
    tel_emergencia: '', referencia_emergencia: '',
    escuela_profesional: 'Ingeniería de Sistemas',
    salud_enfermedad: 'No', salud_enfermedad_cual: '',
    salud_cirugia: 'No', salud_cirugia_cual: '',
    salud_medicamentos: 'No', salud_medicamentos_cuales: '',
    familiares: [{ nombres: '', parentesco: '', edad: '', instruccion: '', ocupacion: '', vive_contigo: 'Si' }],
    trabaja_actualmente: 'No', lugar_trabajo: '', cargo_trabajo: '', horario_trabajo: '',
    tiempo_libre: '', siente_consigo: 'Bien', siente_porque: '', relacion_familia: 'Buena',
    relacion_porque: '', conflictos_familia: 'No', conflictos_porque: '', afecta_desempeño: '',
    reaccion_problema: '', recurre_a: '',
    rend_semestre_ant: '', promedio_mayor_14: 'No', concentra: 'Si',
    dif_docente: '', dif_trabajos: '', asignaturas_desaprobadas: '',
    dificultades_estudio: [], metodos_aprendizaje: [], rend_auto: 'Aceptable',
    tecnicas_estudio: 'No', mencion_tecnicas: '',
    satisfecho_carrera: 'Si', porque_satisfecho: '', expectativas_escuela: '',
    competencias_carrera: '', identificado_escuela: '', mejoras_escuela: '',
    firma_tutor: null, firma_estudiante: null
  });

  // 2. EFECTO DE CARGA UNIFICADO (SOLUCIÓN DEFINITIVA)
  useEffect(() => {
    // Diagnóstico en consola para verificar qué llega
    console.log("👤 USUARIO RECIBIDO EN MODAL:", user);

    const nombreTutorActual = getNombreTutor(user);

    if (sesionAEditar) {
      // --- MODO EDICIÓN ---
      let infoCuestionario = {};
      if (sesionAEditar.desarrollo_entrevista) {
        try {
          infoCuestionario = typeof sesionAEditar.desarrollo_entrevista === 'string'
            ? JSON.parse(sesionAEditar.desarrollo_entrevista)
            : sesionAEditar.desarrollo_entrevista;
        } catch (e) { console.error("Error JSON:", e); }
      }

      const base = { ...sesionAEditar, ...infoCuestionario };

      // LÓGICA DE PRIORIDAD PARA EL NOMBRE:
      // 1. Si el usuario actual tiene nombre, USARLO (para corregir registros viejos vacíos).
      // 2. Si no, usar el guardado en la base de datos.
      const nombreFinal = nombreTutorActual || base.nombre_tutor || '';

      setDatos(prev => ({
        ...prev,
        ...base,
        id: sesionAEditar.id,
        nombre_tutor: nombreFinal, // Asignación forzada
        
        correo_institucional: base.correo_institucional || estudiante?.correo_institucional || '',
        direccion_actual: base.direccion_actual || estudiante?.direccion_actual || '',
        ciclo_actual: base.ciclo_actual || estudiante?.ciclo_actual || '',
        fecha_nacimiento: base.fecha_nacimiento ? base.fecha_nacimiento.split('T')[0] : '',
        telefono: validar(base.telefono || base.celular || estudiante?.telefono),
        
        firma_tutor: sesionAEditar.firma_tutor_url || infoCuestionario.firma_tutor || null,
        firma_estudiante: sesionAEditar.firma_estudiante_url || infoCuestionario.firma_estudiante || null,
        familiares: Array.isArray(base.familiares) ? base.familiares : prev.familiares
      }));

      setCambiarFirmaTutor(false);
      setCambiarFirmaEstudiante(false);

    } else if (estudiante) {
      // --- MODO CREACIÓN (NUEVO) ---
      setDatos(prev => ({
        ...prev,
        escuela_profesional: estudiante.escuela_profesional || 'Ingeniería de Sistemas',
        fecha_nacimiento: estudiante.fecha_nacimiento ? estudiante.fecha_nacimiento.split('T')[0] : '',
        edad: calcularEdad(estudiante.fecha_nacimiento),
        telefono: estudiante.telefono || estudiante.celular || '',
        correo_institucional: estudiante.correo_institucional || '',
        direccion_actual: estudiante.direccion_actual || '',
        año_ingreso: estudiante.anio_ingreso || new Date().getFullYear().toString(),
        ciclo_actual: estudiante.ciclo_actual || '',
        firma_tutor: null, firma_estudiante: null,
        
        // Asignación directa del usuario logueado
        nombre_tutor: nombreTutorActual 
      }));
    }
  }, [sesionAEditar, estudiante, user]); // Se ejecuta cada vez que 'user' cambia

  const calcularEdad = (f) => {
    if (!f) return 0;
    const hoy = new Date();
    const cumple = new Date(f + "T00:00:00");
    let edad = hoy.getFullYear() - cumple.getFullYear();
    if (hoy.getMonth() < cumple.getMonth() || (hoy.getMonth() === cumple.getMonth() && hoy.getDate() < cumple.getDate())) edad--;
    return edad < 0 ? 0 : edad;
  };

  const manejarCambio = (e) => {
    const { name, value } = e.target;
    if (name === "fecha_nacimiento") {
      setDatos(prev => ({ ...prev, [name]: value, edad: calcularEdad(value) }));
    } else {
      setDatos(prev => ({ ...prev, [name]: value }));
    }
  };

  const manejarCheckbox = (lista, valor) => {
    setDatos(prev => {
      const actual = prev[lista] || [];
      const nuevaLista = actual.includes(valor) ? actual.filter(item => item !== valor) : [...actual, valor];
      return { ...prev, [lista]: nuevaLista };
    });
  };

  const manejarFamiliar = (index, e) => {
    const { name, value } = e.target;
    const nuevosFamiliares = [...datos.familiares];
    nuevosFamiliares[index][name] = value;
    setDatos(prev => ({ ...prev, familiares: nuevosFamiliares }));
  };

  const agregarFamiliar = () => {
    setDatos(prev => ({
      ...prev,
      familiares: [...prev.familiares, { nombres: '', parentesco: '', edad: '', instruccion: '', ocupacion: '', vive_contigo: 'Si' }]
    }));
  };

  const finalizarFicha = async (e) => {
    if (e) e.preventDefault(); 
    console.log("🚀 INICIANDO GUARDADO DE FICHA F01...");

    try {
      let fTutor = datos.firma_tutor;
      let fEst = datos.firma_estudiante;

      if (sigCanvasTutor.current && !sigCanvasTutor.current.isEmpty()) {
           fTutor = sigCanvasTutor.current.getCanvas().toDataURL('image/png');
      }
      if (sigCanvasEstudiante.current && !sigCanvasEstudiante.current.isEmpty()) {
           fEst = sigCanvasEstudiante.current.getCanvas().toDataURL('image/png');
      }

      const datosLimpios = { ...datos };
      delete datosLimpios.firma_tutor;
      delete datosLimpios.firma_estudiante;
      delete datosLimpios.firma_tutor_url;
      delete datosLimpios.firma_estudiante_url;

      const payload = {
        ...datosLimpios,
        id: sesionAEditar?.id || null,
        estudiante_id: estudiante.id,
        tutor_id: parseInt(user?.tutor_id || user?.id),
        tipo_formato: 'F01',
        motivo_consulta: 'Ficha Integral',
        
        firma_tutor_url: fTutor,
        firma_estudiante_url: fEst,
        
        // IMPORTANTE: Enviamos el nombre explícito
        nombre_tutor: datos.nombre_tutor, 

        desarrollo_entrevista: JSON.stringify({
            ...datosLimpios,
            nombre_tutor: datos.nombre_tutor 
        }),
        fecha: sesionAEditar ? sesionAEditar.fecha : new Date().toISOString()
      };

      console.log("📦 PAYLOAD FINAL:", payload);

      await onGuardar(payload);

      const datosParaPDF = {
        ...datosLimpios,
        firma_tutor: fTutor,
        firma_estudiante: fEst,
        firma_tutor_url: fTutor,
        firma_estudiante_url: fEst,
        nombre_tutor: datos.nombre_tutor
      };
      
      generarF01(datosParaPDF, estudiante);
      onClose();

    } catch (error) {
      console.error("❌ ERROR CRÍTICO:", error);
      alert("Error al guardar. Verifica la consola.");
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src="/logo_unajma.png" alt="UNAJMA" style={{ width: '40px' }} onError={(e) => e.target.style.display = 'none'} />
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', color: '#1e293b', fontWeight: '800' }}>FICHA INTEGRAL (F01)</h2>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Paso {paso} de 7</p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </header>

        <div style={stepperContainer}>
          {[1, 2, 3, 4, 5, 6, 7].map(i => (<div key={i} style={stepCircle(i === paso, i < paso)}>{i}</div>))}
        </div>

        <div style={contentStyle}>
          {/* PASO 1: DATOS PERSONALES */}
          {paso === 1 && ( 
            <div style={sectionFadeIn}>
              <h3 style={sectionTitleStyle}>I. DATOS PERSONALES</h3>
              <div style={gridStyle}>
                
                {/* CAMPO NOMBRE TUTOR */}
                <div style={{ gridColumn: 'span 3', marginBottom: '10px' }}>
                    <label style={labelStyle}>DOCENTE TUTOR ASIGNADO</label>
                    <input 
                        type="text" 
                        name="nombre_tutor"
                        value={datos.nombre_tutor} 
                        onChange={manejarCambio} 
                        placeholder="Escriba su nombre aquí si no aparece..."
                        style={{ ...inputStyle, backgroundColor: '#fff', border: '2px solid #3b82f6', fontWeight: 'bold' }} 
                    />
                </div>

                <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Apellidos y Nombres</label><div style={readOnlyInput}>{estudiante?.nombres_apellidos}</div></div>
                <div><label style={labelStyle}>N° DNI</label><div style={readOnlyInput}>{estudiante?.dni}</div></div>
                <div><label style={labelStyle}>Fecha Nacimiento</label><input type="date" name="fecha_nacimiento" style={inputStyle} value={datos.fecha_nacimiento || ''} onChange={manejarCambio} /></div>
                <div><label style={labelStyle}>Edad</label><div style={readOnlyInput}>{datos.edad > 0 ? `${datos.edad} años` : '---'}</div></div>
                <div style={{ gridColumn: 'span 1' }}><label style={labelStyle}>Lugar de Nacimiento</label><input type="text" name="lugar_nacimiento" style={inputStyle} value={datos.lugar_nacimiento || ''} onChange={manejarCambio} /></div>
                <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Dirección Actual</label><input type="text" name="direccion_actual" style={inputStyle} value={datos.direccion_actual || ''} onChange={manejarCambio} /></div>
                <div><label style={labelStyle}>Teléfono</label><input type="text" name="telefono" style={inputStyle} value={datos.telefono || ''} onChange={manejarCambio} /></div>
                <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Correo Institucional</label><input type="email" name="correo_institucional" style={inputStyle} value={datos.correo_institucional || ''} onChange={manejarCambio} /></div>
                <div><label style={labelStyle}>Estado Civil</label><select name="estado_civil" style={inputStyle} value={datos.estado_civil || 'soltero'} onChange={manejarCambio}><option value="soltero">soltero</option><option value="casado">casado</option><option value="conviviente">conviviente</option></select></div>
                <div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>Escuela Profesional</label><div style={readOnlyInput}>{datos.escuela_profesional}</div></div>
                <div><label style={labelStyle}>Año de Ingreso</label><input type="text" name="año_ingreso" style={inputStyle} value={datos.año_ingreso || ''} onChange={manejarCambio} /></div>
                <div><label style={labelStyle}>Código</label><div style={readOnlyInput}>{estudiante?.codigo_estudiante}</div></div>
                <div><label style={labelStyle}>Ciclo Actual</label><input type="text" name="ciclo_actual" style={inputStyle} value={datos.ciclo_actual || ''} onChange={manejarCambio} /></div>
                
                {/* CAMPOS EMERGENCIA */}
                <div style={{ gridColumn: 'span 3', borderTop: '1px solid #e2e8f0', marginTop: '10px', paddingTop: '10px' }}>
                    <h4 style={{ fontSize: '12px', color: '#ef4444', margin: '0 0 10px 0' }}>🚨 CONTACTO DE EMERGENCIA</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div><label style={labelStyle}>Nombre/Referencia</label><input type="text" name="referencia_emergencia" style={inputStyle} value={datos.referencia_emergencia || ''} onChange={manejarCambio} placeholder="Ej: Madre, Tío Juan..." /></div>
                        <div><label style={labelStyle}>Teléfono Emergencia</label><input type="text" name="tel_emergencia" style={inputStyle} value={datos.tel_emergencia || ''} onChange={manejarCambio} placeholder="999..." /></div>
                    </div>
                </div>
              </div>
            </div> 
          )}

          {/* RESTO DE PASOS (Sin cambios estructurales, solo formato) */}
          {paso === 2 && ( <div style={sectionFadeIn}><h3 style={sectionTitleStyle}>II. CONDICIONES DE SALUD</h3><div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}><HealthField label="Padece enfermedad o discapacidad" nameRadio="salud_enfermedad" nameText="salud_enfermedad_cual" valueRadio={datos.salud_enfermedad} valueText={datos.salud_enfermedad_cual} onChange={manejarCambio} /><HealthField label="Ha tenido intervención quirúrgica" nameRadio="salud_cirugia" nameText="salud_cirugia_cual" valueRadio={datos.salud_cirugia} valueText={datos.salud_cirugia_cual} onChange={manejarCambio} /><HealthField label="Toma medicamentos" nameRadio="salud_medicamentos" nameText="salud_medicamentos_cuales" valueRadio={datos.salud_medicamentos} valueText={datos.salud_medicamentos_cuales} onChange={manejarCambio} /></div></div> )}
          {paso === 3 && ( <div style={sectionFadeIn}><h3 style={sectionTitleStyle}>III. COMPOSICIÓN FAMILIAR</h3><div style={{ overflowX: 'auto', border: '1.5px solid #004a99', borderRadius: '10px' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ backgroundColor: '#004a99', color: 'white' }}><th style={thStyle}>Nombres</th><th style={thStyle}>Parentesco</th><th style={thStyle}>Edad</th><th style={thStyle}>Ocupación</th><th style={thStyle}>¿Vive contigo?</th></tr></thead><tbody>{datos.familiares.map((f, i) => (<tr key={i} style={{ borderBottom: '1px solid #cbd5e1' }}><td style={tdStyle}><input type="text" name="nombres" style={tableInput} value={f.nombres || ''} onChange={(e) => manejarFamiliar(i, e)} /></td><td style={tdStyle}><input type="text" name="parentesco" style={tableInput} value={f.parentesco || ''} onChange={(e) => manejarFamiliar(i, e)} /></td><td style={tdStyle}><input type="number" name="edad" style={tableInput} value={f.edad || ''} onChange={(e) => manejarFamiliar(i, e)} /></td><td style={tdStyle}><input type="text" name="ocupacion" style={tableInput} value={f.ocupacion || ''} onChange={(e) => manejarFamiliar(i, e)} /></td><td style={tdStyle}><select name="vive_contigo" style={tableInput} value={f.vive_contigo || 'Si'} onChange={(e) => manejarFamiliar(i, e)}><option value="Si">Si</option><option value="No">No</option></select></td></tr>))}</tbody></table></div><button type="button" onClick={agregarFamiliar} style={{ ...clearBtn, marginTop: '10px' }}>+ Agregar Familiar</button></div> )}
          {paso === 4 && ( <div style={sectionFadeIn}><h3 style={sectionTitleStyle}>IV. CONDICIÓN LABORAL</h3><div style={gridStyle}><div><label style={labelStyle}>¿Trabajas actualmente?</label><select name="trabaja_actualmente" style={inputStyle} value={datos.trabaja_actualmente} onChange={manejarCambio}><option value="Si">Si</option><option value="No">No</option></select></div><div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>¿Donde?</label><input type="text" name="lugar_trabajo" style={inputStyle} value={datos.lugar_trabajo || ''} onChange={manejarCambio} disabled={datos.trabaja_actualmente === 'No'} /></div><div><label style={labelStyle}>¿Cargo?</label><input type="text" name="cargo_trabajo" style={inputStyle} value={datos.cargo_trabajo || ''} onChange={manejarCambio} disabled={datos.trabaja_actualmente === 'No'} /></div><div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Horario</label><input type="text" name="horario_trabajo" style={inputStyle} value={datos.horario_trabajo || ''} onChange={manejarCambio} disabled={datos.trabaja_actualmente === 'No'} /></div></div></div> )}
          {paso === 5 && ( <div style={sectionFadeIn}><h3 style={sectionTitleStyle}>V. ÁREA PERSONAL</h3><div style={gridStyle}><div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>¿Qué haces en tu tiempo libre?</label><textarea name="tiempo_libre" style={{ ...inputStyle, height: '45px' }} value={datos.tiempo_libre || ''} onChange={manejarCambio} /></div><div><label style={labelStyle}>¿Cómo te sientes contigo mismo?</label><select name="siente_consigo" style={inputStyle} value={datos.siente_consigo} onChange={manejarCambio}><option value="Mal">Mal</option><option value="Regular">Regular</option><option value="Bien">Bien</option><option value="Muy bien">Muy bien</option></select></div><div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>¿Por qué?</label><input type="text" name="siente_porque" style={inputStyle} value={datos.siente_porque || ''} onChange={manejarCambio} /></div><div><label style={labelStyle}>Relación familiar</label><select name="relacion_familia" style={inputStyle} value={datos.relacion_familia} onChange={manejarCambio}><option value="Mala">Mala</option><option value="Regular">Regular</option><option value="Buena">Buena</option></select></div><div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>¿Por qué?</label><input type="text" name="relacion_porque" style={inputStyle} value={datos.relacion_porque || ''} onChange={manejarCambio} /></div><div><label style={labelStyle}>Conflictos familiares</label><select name="conflictos_familia" style={inputStyle} value={datos.conflictos_familia} onChange={manejarCambio}><option value="Si">Si</option><option value="No">No</option></select></div><div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>¿Por qué?</label><input type="text" name="conflictos_porque" style={inputStyle} value={datos.conflictos_porque || ''} onChange={manejarCambio} /></div><div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>¿Afecta tu desempeño?</label><input type="text" name="afecta_desempeño" style={inputStyle} value={datos.afecta_desempeño || ''} onChange={manejarCambio} /></div><div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>¿Cómo reaccionas ante problemas?</label><textarea name="reaccion_problema" style={{ ...inputStyle, height: '45px' }} value={datos.reaccion_problema || ''} onChange={manejarCambio} /></div><div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>¿A quién recurres?</label><input type="text" name="recurre_a" style={inputStyle} value={datos.recurre_a || ''} onChange={manejarCambio} /></div></div></div> )}
          {paso === 6 && ( <div style={sectionFadeIn}><h3 style={sectionTitleStyle}>VI. ÁREA ACADÉMICA</h3><div style={gridStyle}><div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>1. ¿Rendimiento académico anterior semestre?</label><input type="text" name="rend_semestre_ant" style={inputStyle} value={datos.rend_semestre_ant || ''} onChange={manejarCambio} /></div><div><label style={labelStyle}>2. ¿Promedio mayor a 14?</label><select name="promedio_mayor_14" style={inputStyle} value={datos.promedio_mayor_14} onChange={manejarCambio}><option value="Si">Si</option><option value="No">No</option></select></div><div><label style={labelStyle}>3. ¿Logras concentrarte sin problemas?</label><select name="concentra" style={inputStyle} value={datos.concentra} onChange={manejarCambio}><option value="Si">Si</option><option value="No">No</option></select></div><div><label style={labelStyle}>4. ¿Dificultad con algún docente?</label><input type="text" name="dif_docente" style={inputStyle} value={datos.dif_docente || ''} onChange={manejarCambio} /></div><div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>5. ¿Dificultades en trabajos personales/grupales?</label><textarea name="dif_trabajos" style={{ ...inputStyle, height: '45px' }} value={datos.dif_trabajos || ''} onChange={manejarCambio} /></div><div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>6. ¿En qué te dificultas cuando estudias?</label><div style={checkGrid}>{['En comprender los temas', 'En analizar los temas', 'Expresar en forma escrita', 'En expresar en forma oral lo aprendido', 'En cómo aplicar lo aprendido', 'Al memorizar los temas'].map(d => (<label key={d} style={radioLabel}><input type="checkbox" checked={datos.dificultades_estudio?.includes(d)} onChange={() => manejarCheckbox('dificultades_estudio', d)} /> {d}</label>))}</div></div><div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>7. ¿Cómo aprendes mejor?</label><div style={checkGrid}>{['Solo', 'En grupo', 'Con música', 'Caminando cuando repaso', 'Escuchando', 'Actuando', 'Viendo imágenes', 'Con ayuda de alguien'].map(m => (<label key={m} style={radioLabel}><input type="checkbox" checked={datos.metodos_aprendizaje?.includes(m)} onChange={() => manejarCheckbox('metodos_aprendizaje', m)} /> {m}</label>))}</div></div><div><label style={labelStyle}>8. Autocalificación de rendimiento</label><select name="rend_auto" style={inputStyle} value={datos.rend_auto} onChange={manejarCambio}><option value="Deficiente">Deficiente</option><option value="Regular">Regular</option><option value="Aceptable">Aceptable</option><option value="Bueno">Bueno</option><option value="Excelente">Excelente</option></select></div><div><label style={labelStyle}>9. ¿Utilizas técnicas de estudio?</label><select name="tecnicas_estudio" style={inputStyle} value={datos.tecnicas_estudio} onChange={manejarCambio}><option value="Si">Si</option><option value="No">No</option></select></div><div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>Menciónalas:</label><input type="text" name="mencion_tecnicas" style={inputStyle} value={datos.mencion_tecnicas || ''} onChange={manejarCambio} disabled={datos.tecnicas_estudio === 'No'} /></div></div></div> )}

          {paso === 7 && (
            <div style={sectionFadeIn}>
              <h3 style={sectionTitleStyle}>VII. ÁREA PROFESIONAL Y FIRMAS</h3>
              <div style={gridStyle}>
                <div><label style={labelStyle}>1. ¿Satisfecho con tu carrera?</label><select name="satisfecho_carrera" style={inputStyle} value={datos.satisfecho_carrera} onChange={manejarCambio}><option value="Si">Si</option><option value="No">No</option></select></div>
                <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>¿Por qué?</label><input type="text" name="porque_satisfecho" style={inputStyle} value={datos.porque_satisfecho || ''} onChange={manejarCambio} /></div>
                <div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>2. ¿La formación cumple tus expectativas?</label><textarea name="expectativas_escuela" style={{ ...inputStyle, height: '45px' }} value={datos.expectativas_escuela || ''} onChange={manejarCambio} /></div>
                <div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>3. ¿Tienes las competencias exigidas?</label><textarea name="competencias_carrera" style={{ ...inputStyle, height: '45px' }} value={datos.competencias_carrera || ''} onChange={manejarCambio} /></div>
                <div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>4. ¿Te sientes identificado con tu escuela?</label><textarea name="identificado_escuela" style={{ ...inputStyle, height: '45px' }} value={datos.identificado_escuela || ''} onChange={manejarCambio} /></div>
                <div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>5. ¿Qué desearías que mejore en tu escuela?</label><textarea name="mejoras_escuela" style={{ ...inputStyle, height: '45px' }} value={datos.mejoras_escuela || ''} onChange={manejarCambio} /></div>
              </div>

              {/* SECCIÓN DE FIRMAS */}
              <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                <div style={{ textAlign: 'center' }}>
                  <label style={labelStyle}>Firma Tutor</label>
                  <div style={canvasWrapper}>
                    {datos.firma_tutor && !cambiarFirmaTutor ? (
                      <div style={{ padding: '10px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={datos.firma_tutor} style={{ maxHeight: '100%', objectFit: 'contain' }} alt="Firma Tutor" />
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <SignatureCanvas ref={sigCanvasTutor} penColor='black' canvasProps={{ style: { width: '100%', height: '120px' } }} />
                        <button type="button" onClick={() => sigCanvasTutor.current?.clear()} style={{...clearBtn, position: 'absolute', bottom: '5px', right: '5px'}}>Borrar</button>
                      </div>
                    )}
                  </div>
                  {sesionAEditar && (
                    <button type="button" onClick={() => setCambiarFirmaTutor(!cambiarFirmaTutor)} style={btnActualizarFirmaStyle}>
                      {cambiarFirmaTutor ? "MANTENER ORIGINAL" : "🔄 ACTUALIZAR FIRMA"}
                    </button>
                  )}
                </div>

                <div style={{ textAlign: 'center' }}>
                  <label style={labelStyle}>Firma Estudiante</label>
                  <div style={canvasWrapper}>
                    {datos.firma_estudiante && !cambiarFirmaEstudiante ? (
                      <div style={{ padding: '10px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={datos.firma_estudiante} style={{ maxHeight: '100%', objectFit: 'contain' }} alt="Firma Estudiante" />
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <SignatureCanvas ref={sigCanvasEstudiante} penColor='blue' canvasProps={{ style: { width: '100%', height: '120px' } }} />
                        <button type="button" onClick={() => sigCanvasEstudiante.current?.clear()} style={{...clearBtn, position: 'absolute', bottom: '5px', right: '5px'}}>Borrar</button>
                      </div>
                    )}
                  </div>
                  {sesionAEditar && (
                    <button type="button" onClick={() => setCambiarFirmaEstudiante(!cambiarFirmaEstudiante)} style={btnActualizarFirmaStyle}>
                      {cambiarFirmaEstudiante ? "MANTENER ORIGINAL" : "🔄 ACTUALIZAR FIRMA"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <footer style={footerStyle}>
          <button onClick={() => setPaso(p => Math.max(1, p - 1))} disabled={paso === 1} style={btnBack}>Regresar</button>
          {paso < 7 ? (
            <button onClick={() => setPaso(p => Math.min(7, p + 1))} style={btnNext}>Siguiente</button>
          ) : (
            <button type="button" onClick={finalizarFicha} style={{ ...btnNext, backgroundColor: '#10b981' }}>
              {sesionAEditar ? '💾 Guardar y Descargar' : '💾 Guardar Ficha'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// --- SUBCOMPONENTES ---
const HealthField = ({ label, nameRadio, nameText, valueRadio, valueText, onChange }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9', marginBottom: '10px' }}>
    <div>
      <label style={{ ...labelStyle, fontSize: '11px' }}>{label}</label>
      <div style={{ display: 'flex', gap: '12px', marginTop: '5px' }}>
        <label style={radioLabel}><input type="radio" name={nameRadio} value="Si" checked={valueRadio === 'Si'} onChange={onChange} /> Si</label>
        <label style={radioLabel}><input type="radio" name={nameRadio} value="No" checked={valueRadio === 'No'} onChange={onChange} /> No</label>
      </div>
    </div>
    <div><label style={labelStyle}>Especifique</label><input type="text" name={nameText} style={inputStyle} disabled={valueRadio === 'No'} value={valueText || ''} onChange={onChange} /></div>
  </div>
);

// --- ESTILOS ---
const overlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 5000 };
const containerStyle = { width: '880px', backgroundColor: 'white', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '90vh', overflow: 'hidden' };
const headerStyle = { padding: '15px 30px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const stepperContainer = { display: 'flex', justifyContent: 'center', gap: '12px', padding: '12px', backgroundColor: '#f8fafc' };
const stepCircle = (active, completed) => ({ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '12px', fontWeight: '800', backgroundColor: active ? '#004a99' : (completed ? '#10b981' : '#e2e8f0'), color: 'white' });
const contentStyle = { padding: '25px 40px', flex: 1, overflowY: 'auto' };
const sectionFadeIn = { animation: 'fadeIn 0.3s ease-in-out' };
const sectionTitleStyle = { fontSize: '14px', fontWeight: '900', color: '#004a99', marginBottom: '20px', borderLeft: '5px solid #004a99', paddingLeft: '12px', textTransform: 'uppercase' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#475569', marginBottom: '6px', display: 'block', textTransform: 'uppercase' };
const inputStyle = { width: '100%', padding: '9px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', outline: 'none' };
const readOnlyInput = { ...inputStyle, backgroundColor: '#f1f5f9', color: '#1e293b', fontWeight: '700' };
const footerStyle = { padding: '20px 35px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', backgroundColor: '#f8fafc' };
const btnNext = { backgroundColor: '#004a99', color: 'white', border: 'none', padding: '11px 30px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' };
const btnBack = { backgroundColor: 'white', color: '#64748b', border: '1.5px solid #e2e8f0', padding: '11px 30px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' };
const closeBtnStyle = { background: '#f1f5f9', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', color: '#64748b' };
const canvasWrapper = { border: '2px dashed #cbd5e1', borderRadius: '8px', backgroundColor: '#fff', marginBottom: '8px', overflow: 'hidden' };
const clearBtn = { fontSize: '9px', color: '#ef4444', background: 'none', border: '1px solid #ef4444', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const thStyle = { padding: '12px 10px', textAlign: 'left', fontSize: '10px', fontWeight: '900', color: 'white', textTransform: 'uppercase', borderRight: '1px solid rgba(255,255,255,0.2)' };
const tdStyle = { padding: '8px' };
const tableInput = { width: '100%', padding: '8px', border: 'none', fontSize: '12px', outline: 'none', backgroundColor: 'transparent' };
const btnCambiarFirma = { marginTop: '10px', padding: '6px 12px', backgroundColor: '#004a99', color: 'white', border: 'none', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' };
const checkGrid = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px' };
const radioLabel = { fontSize: '11px', color: '#1e293b', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };
const btnActualizarFirmaStyle = { marginTop: '10px', padding: '8px 16px', backgroundColor: '#004a99', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', textTransform: 'uppercase' };