import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generarF01 = (datosRaw, estudiante, retornarDoc = false) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 0;

  const validar = (val) => (val === undefined || val === null || val === 'null' || val === '') ? "" : String(val).trim();

  // --- 1. NORMALIZACIÓN DE DATOS ---
  let datosJSON = {};
  if (datosRaw.desarrollo_entrevista) {
    try {
      datosJSON = typeof datosRaw.desarrollo_entrevista === 'string'
        ? JSON.parse(datosRaw.desarrollo_entrevista)
        : datosRaw.desarrollo_entrevista;
    } catch (e) { console.error("Error parseando JSON", e); }
  }
  // Fusionamos todo (datosRaw tiene prioridad si son los del formulario actual)
  const datos = { ...datosJSON, ...datosRaw };

  // --- 2. FUNCIONES DE DIBUJO ---
  const dibujarEncabezado = (paginaDoc) => {
    try { paginaDoc.addImage('/logo_unajma.png', 'PNG', 15, 8, 20, 20); } catch (e) { }
    paginaDoc.setFontSize(10).setFont("helvetica", "bold");
    paginaDoc.text("UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS", 40, 14);
    paginaDoc.setFontSize(8).setFont("helvetica", "normal").text("Dirección de Bienestar Universitario / Área de Tutoría", 40, 19);
    paginaDoc.setFontSize(10).setFont("helvetica", "bold").text("ÁREA DE TUTORÍA", pageWidth - margin - 35, 19);
    paginaDoc.setLineWidth(0.5).setDrawColor(0);
    paginaDoc.line(margin, 28, pageWidth - margin, 28);
  };

  const verificarYSalto = (alturaElemento) => {
    if (yPos + alturaElemento > pageHeight - 35) {
      doc.addPage();
      dibujarEncabezado(doc);
      yPos = 38; 
      return true;
    }
    return false;
  };

  const dibujarPreguntaFisica = (pregunta, respuesta, xStart, xEnd) => {
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(pregunta, xStart, yPos);
    const labelWidth = doc.getTextWidth(pregunta);
    
    // Dibujar respuesta
    const lineStart = xStart + labelWidth + 1;
    doc.setFont("helvetica", "bold");
    doc.text(validar(respuesta), lineStart + 1, yPos - 0.5);
    
    // Dibujar línea
    doc.setLineWidth(0.1).setDrawColor(150);
    doc.line(lineStart, yPos + 0.5, xEnd, yPos + 0.5);
  };

  const dibujarPreguntaSubrayada = (pregunta, respuesta) => {
    doc.setFont("helvetica", "normal").setFontSize(9);
    const splitPregunta = doc.splitTextToSize(pregunta, pageWidth - margin * 2);
    verificarYSalto((splitPregunta.length * 5) + 7);
    
    doc.text(splitPregunta, margin, yPos);
    yPos += (splitPregunta.length * 4.5);
    doc.setFont("helvetica", "bold");
    doc.text(validar(respuesta), margin + 1, yPos - 0.5);
    doc.setLineWidth(0.1).setDrawColor(150);
    doc.line(margin, yPos + 0.5, pageWidth - margin, yPos + 0.5);
    yPos += 7; 
  };

  // --- INICIO DOCUMENTO ---
  dibujarEncabezado(doc);
  yPos = 38;
  doc.setFontSize(11).setFont("helvetica", "bold").text("FICHA INTEGRAL DEL TUTORADO (Formato 1)", pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  // ==============================
  // I. DATOS PERSONALES
  // ==============================
  doc.setFontSize(10).setFont("helvetica", "bold").text("I. DATOS PERSONALES", margin, yPos);
  yPos += 7;
  
  dibujarPreguntaFisica("Apellidos y Nombres: ", estudiante.nombres_apellidos, margin, pageWidth - margin);
  yPos += 8;

  const fNac = validar(datos.fecha_nacimiento);
  const [anio, mes, dia] = fNac.includes('-') ? fNac.split('-') : ["", "", ""];
  
  doc.setFont("helvetica", "normal").text("Fecha de Nacimiento: ", margin, yPos);
  let curX = margin + doc.getTextWidth("Fecha de Nacimiento: ");
  
  // Dibujo manual de la fecha para formato dd/mm/yyyy
  doc.setFont("helvetica", "bold");
  doc.text(dia, curX + 1, yPos - 0.5); doc.line(curX, yPos + 0.5, curX + 8, yPos + 0.5); curX += 9;
  doc.text("/", curX, yPos); curX += 3;
  doc.text(mes, curX + 1, yPos - 0.5); doc.line(curX, yPos + 0.5, curX + 8, yPos + 0.5); curX += 9;
  doc.text("/", curX, yPos); curX += 3;
  doc.text(anio, curX + 1, yPos - 0.5); doc.line(curX, yPos + 0.5, curX + 15, yPos + 0.5); curX += 20;
  
  dibujarPreguntaFisica("Edad: ", datos.edad, curX, curX + 15); curX += 22;
  dibujarPreguntaFisica("N° DNI: ", estudiante.dni || datos.dni, curX, pageWidth - margin);
  yPos += 8;

  dibujarPreguntaFisica("Lugar de Nacimiento: ", datos.lugar_nacimiento, margin, pageWidth - margin);
  yPos += 8;
  dibujarPreguntaFisica("Dirección Actual: ", datos.direccion_actual, margin, pageWidth - 55);
  dibujarPreguntaFisica("Teléfono: ", datos.telefono || estudiante.telefono, pageWidth - 53, pageWidth - margin);
  yPos += 8;
  dibujarPreguntaFisica("Correo electrónico institucional: ", datos.correo_institucional, margin, pageWidth - margin);
  yPos += 8;

  const ec = (validar(datos.estado_civil)).toLowerCase();
  doc.setFont("helvetica", "normal").text("Estado civil:", margin, yPos);
  doc.text(`soltero ( ${ec==='soltero'?'X':' '} )`, margin + 30, yPos);
  doc.text(`casado ( ${ec==='casado'?'X':' '} )`, margin + 65, yPos);
  doc.text(`conviviente ( ${ec==='conviviente'?'X':' '} )`, margin + 100, yPos);
  yPos += 8;

  dibujarPreguntaFisica("Escuela Profesional: ", estudiante.escuela_profesional, margin, pageWidth - margin);
  yPos += 8;
  dibujarPreguntaFisica("Año de ingreso: ", datos.año_ingreso, margin, margin + 45);
  dibujarPreguntaFisica(" Código: ", estudiante.codigo_estudiante, margin + 45, margin + 105);
  dibujarPreguntaFisica(" Ciclo actual: ", datos.ciclo_actual, margin + 105, pageWidth - margin);
  yPos += 8;

  // --- AQUÍ ESTÁ LO QUE PEDISTE: EMERGENCIA Y TUTOR AL FINAL DE LA SECCIÓN I ---
  
  // 1. Datos de Emergencia
  dibujarPreguntaFisica("Teléfonos en caso de emergencia: ", datos.tel_emergencia, margin, pageWidth - 90);
  dibujarPreguntaFisica("Referencia: ", datos.referencia_emergencia, pageWidth - 85, pageWidth - margin);
  yPos += 8;

  // 2. Nombre del Tutor (Última línea de la sección)
  dibujarPreguntaFisica("Nombre del Docente Tutor: ", datos.nombre_tutor, margin, pageWidth - margin);
  
  yPos += 12; // Espacio antes de Sección II

  // ==============================
  // II. CONDICIONES DE SALUD
  // ==============================
  verificarYSalto(35);
  doc.setFont("helvetica", "bold").text("II. CONDICIONES DE SALUD", margin, yPos);
  yPos += 7;
  const sEnf = datos.salud_enfermedad === 'Si';
  doc.setFont("helvetica", "normal").text(`Padece de alguna enfermedad o discapacidad: Si ( ${sEnf?'X':' '} )  No ( ${!sEnf?'X':' '} )`, margin, yPos);
  dibujarPreguntaFisica(" ¿Cuál?", datos.salud_enfermedad_cual, margin + 100, pageWidth - margin);
  yPos += 8;

  const sCir = datos.salud_cirugia === 'Si';
  doc.text(`Ha tenido intervención quirúrgica: Si ( ${sCir?'X':' '} )  No ( ${!sCir?'X':' '} )`, margin, yPos);
  dibujarPreguntaFisica(" ¿Cuál?", datos.salud_cirugia_cual, margin + 85, pageWidth - margin);
  yPos += 8;

  const sMed = datos.salud_medicamentos === 'Si';
  doc.text(`Toma medicamentos: Si ( ${sMed?'X':' '} )  No ( ${!sMed?'X':' '} )`, margin, yPos);
  dibujarPreguntaFisica(" ¿Cuáles?", datos.salud_medicamentos_cuales, margin + 65, pageWidth - margin);
  yPos += 12;

  // ==============================
  // III. COMPOSICIÓN FAMILIAR
  // ==============================
  verificarYSalto(30);
  doc.setFont("helvetica", "bold").text("III. COMPOSICIÓN FAMILIAR", margin, yPos);
  autoTable(doc, {
    startY: yPos + 3,
    head: [['Nombres y Apellidos', 'Parentesco', 'Edad', 'Grado Inst.', 'Ocupación', '¿Viven?']],
    body: (datos.familiares || []).map(f => [validar(f.nombres), validar(f.parentesco), validar(f.edad), validar(f.instruccion), validar(f.ocupacion), validar(f.vive_contigo)]),
    theme: 'grid', styles: { fontSize: 7.5, cellPadding: 1.5 }
  });
  yPos = doc.lastAutoTable.finalY + 12;

  // ==============================
  // IV. CONDICIÓN LABORAL
  // ==============================
  verificarYSalto(35);
  doc.setFont("helvetica", "bold").text("IV. CONDICIÓN LABORAL", margin, yPos);
  yPos += 7;
  const trabAct = datos.trabaja_actualmente === 'Si';
  doc.setFont("helvetica", "normal").text(`¿Trabajas actualmente? Si ( ${trabAct?'X':' '} )  No ( ${!trabAct?'X':' '} )`, margin, yPos);
  yPos += 7;
  dibujarPreguntaSubrayada("¿Donde?", datos.lugar_trabajo);
  
  doc.setFont("helvetica", "normal").text("¿Cargo?", margin, yPos);
  const wCar = doc.getTextWidth("¿Cargo? ");
  doc.setFont("helvetica", "bold").text(validar(datos.cargo_trabajo), margin + wCar + 2, yPos - 0.5);
  doc.line(margin + wCar, yPos + 0.5, margin + 95, yPos + 0.5);
  doc.setFont("helvetica", "normal").text("Horario:", margin + 100, yPos);
  const wHor = doc.getTextWidth("Horario: ");
  doc.setFont("helvetica", "bold").text(validar(datos.horario_trabajo), margin + 100 + wHor + 2, yPos - 0.5);
  doc.line(margin + 100 + wHor, yPos + 0.5, pageWidth - margin, yPos + 0.5);
  yPos += 12;

  // ==============================
  // V. ÁREA PERSONAL
  // ==============================
  verificarYSalto(15);
  doc.setFont("helvetica", "bold").text("V. ÁREA PERSONAL", margin, yPos);
  yPos += 7;
  dibujarPreguntaSubrayada("¿Qué haces en tu tiempo libre?", datos.tiempo_libre);

  const sCo = datos.siente_consigo;
  doc.setFont("helvetica", "normal").text(`¿Cómo te sientes contigo mismo? Mal (${sCo==='Mal'?'X':' '}) Reg. (${sCo==='Regular'?'X':' '}) Bien (${sCo==='Bien'?'X':' '}) Muy bien (${sCo==='Muy bien'?'X':' '})`, margin, yPos);
  yPos += 6;
  dibujarPreguntaSubrayada("¿Por qué?", datos.siente_porque);

  const rFa = datos.relacion_familia;
  doc.text(`¿Cómo es la relación entre tu familia y tú? Mala (${rFa==='Mala'?'X':' '}) Reg. (${rFa==='Regular'?'X':' '}) Buena (${rFa==='Buena'?'X':' '})`, margin, yPos);
  yPos += 6;
  dibujarPreguntaSubrayada("¿Por qué?", datos.relacion_porque);

  const cFa = datos.conflictos_familia === 'Si';
  doc.text(`¿Tienes dificultades o conflictos familiares? Si ( ${cFa?'X':' '} )  No ( ${!cFa?'X':' '} )`, margin, yPos);
  yPos += 6;
  dibujarPreguntaSubrayada("¿Por qué?", datos.conflictos_porque);
  dibujarPreguntaSubrayada("¿La relación familiar afecta tu desempeño académico?", datos.afecta_desempeño);
  dibujarPreguntaSubrayada("¿Cómo reaccionas ante un problema?", datos.reaccion_problema);
  dibujarPreguntaSubrayada("¿Cuándo tienes un problema a quién recurres?", datos.recurre_a);

  // ==============================
  // VI. ÁREA ACADÉMICA
  // ==============================
  verificarYSalto(15);
  doc.setFont("helvetica", "bold").text("VI. ÁREA ACADÉMICA", margin, yPos);
  yPos += 7;
  dibujarPreguntaSubrayada("¿Cómo fue su rendimiento académico en el anterior semestre?", datos.rend_semestre_ant);
  dibujarPreguntaSubrayada("¿Tu promedio ponderado es mayor que 14?", datos.promedio_mayor_14);
  dibujarPreguntaSubrayada("¿Cuándo estudias logras concentrarte sin problemas?", datos.concentra);
  dibujarPreguntaSubrayada("¿Has tenido alguna dificultad con algún docente?", datos.dif_docente);
  dibujarPreguntaSubrayada("¿Qué dificultades has tenido en trabajos personales y grupales?", datos.dif_trabajos);
  dibujarPreguntaSubrayada("¿Tienes asignaturas desaprobadas?", datos.asignaturas_desaprobadas);

  verificarYSalto(35);
  doc.setFont("helvetica", "bold").text("¿En qué te dificultas cuando estudias?", margin, yPos);
  yPos += 6;
  const dE = Array.isArray(datos.dificultades_estudio) ? datos.dificultades_estudio : [];
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  doc.text(`En comprender los temas ( ${dE.includes('En comprender los temas') ? 'X' : ' '} )`, margin + 5, yPos);
  doc.text(`En analizar los temas ( ${dE.includes('En analizar los temas') ? 'X' : ' '} )`, margin + 100, yPos);
  yPos += 6;
  doc.text(`Expresar en forma escrita ( ${dE.includes('Expresar en forma escrita') ? 'X' : ' '} )`, margin + 5, yPos);
  doc.text(`En expresar en forma oral ( ${dE.includes('En expresar en forma oral lo aprendido') ? 'X' : ' '} )`, margin + 100, yPos);
  yPos += 6;
  doc.text(`En cómo aplicar lo aprendido ( ${dE.includes('En cómo aplicar lo aprendido') ? 'X' : ' '} )`, margin + 5, yPos);
  doc.text(`Al memorizar los temas ( ${dE.includes('Al memorizar los temas') ? 'X' : ' '} )`, margin + 100, yPos);
  yPos += 10;

  verificarYSalto(25);
  doc.setFont("helvetica", "bold").text("¿Cómo aprendes mejor?", margin, yPos);
  yPos += 6;
  const mA = Array.isArray(datos.metodos_aprendizaje) ? datos.metodos_aprendizaje : [];
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(`Solo (${mA.includes('Solo')?'X':' '})  Grupo (${mA.includes('En grupo')?'X':' '})  Música (${mA.includes('Con música')?'X':' '})  Caminando (${mA.includes('Caminando cuando repaso')?'X':' '})`, margin+5, yPos);
  yPos += 6;
  doc.text(`Escuchando (${mA.includes('Escuchando')?'X':' '}) Actuando (${mA.includes('Actuando')?'X':' '}) Imágenes (${mA.includes('Viendo imágenes')?'X':' '}) Ayuda (${mA.includes('Con ayuda de alguien')?'X':' '})`, margin+5, yPos);
  yPos += 10;

  doc.setFont("helvetica", "bold").text("¿Cómo consideras que es tu Rendimiento Académico?", margin, yPos);
  yPos += 6;
  const rAc = datos.rend_auto;
  doc.setFont("helvetica", "normal").text(`Defic. (${rAc==='Deficiente'?'X':' '}) Reg. (${rAc==='Regular'?'X':' '}) Acept. (${rAc==='Aceptable'?'X':' '}) Bueno (${rAc==='Bueno'?'X':' '}) Excel. (${rAc==='Excelente'?'X':' '})`, margin+5, yPos);
  yPos += 10;

  const tEs = datos.tecnicas_estudio === 'Si';
  doc.text(`¿Consideras que utilizas técnicas de estudio? Si ( ${tEs?'X':' '} )  No ( ${!tEs?'X':' '} )`, margin, yPos);
  yPos += 6;
  dibujarPreguntaSubrayada("Menciónalas:", datos.mencion_tecnicas);

  // ==============================
  // VII. ÁREA PROFESIONAL
  // ==============================
  verificarYSalto(15);
  doc.setFont("helvetica", "bold").text("VII. ÁREA PROFESIONAL", margin, yPos);
  yPos += 7;
  const sat = datos.satisfecho_carrera === 'Si';
  doc.setFont("helvetica", "normal").text(`¿Te sientes satisfecho con tu carrera? Si ( ${sat?'X':' '} )  No ( ${!sat?'X':' '} )`, margin, yPos);
  yPos += 6;
  dibujarPreguntaSubrayada("¿Por qué?", datos.porque_satisfecho);
  dibujarPreguntaSubrayada("¿La formación cumple con tus expectativas?", datos.expectativas_escuela);
  dibujarPreguntaSubrayada("¿Tienes las competencias exigidas? Menciónalas:", datos.competencias_carrera);
  dibujarPreguntaSubrayada("¿Te sientes identificado con tu Escuela?", datos.identificado_escuela);
  dibujarPreguntaSubrayada("¿En qué desearías que mejore tu Escuela?", datos.mejoras_escuela);

  // ==============================
  // FIRMAS
  // ==============================
  const alturaBloqueFirmas = 45; 
  if (yPos > pageHeight - alturaBloqueFirmas - 25) {
      doc.addPage();
      dibujarEncabezado(doc);
      yPos = 70; 
  } else {
      yPos += 25; 
  }

  // Compatibilidad de nombres de propiedades
  const fTutor = datos.firma_tutor_url || datos.firma_tutor;
  const fEst = datos.firma_estudiante_url || datos.firma_estudiante;

  doc.setLineWidth(0.5).setDrawColor(0);

  // Firma Tutor (Izquierda)
  if (fTutor && fTutor.length > 20) {
    try { doc.addImage(fTutor, 'PNG', margin + 10, yPos - 22, 45, 18); } catch (e) { }
  }
  doc.line(margin + 5, yPos, margin + 75, yPos);
  doc.setFontSize(8).setFont("helvetica", "bold").text("Firma del Docente Tutor(a)", margin + 40, yPos + 5, { align: 'center' });

  // Firma Estudiante (Derecha)
  if (fEst && fEst.length > 20) {
    try { doc.addImage(fEst, 'PNG', pageWidth - margin - 65, yPos - 22, 45, 18); } catch (e) { }
  }
  doc.line(pageWidth - margin - 75, yPos, pageWidth - margin - 5, yPos);
  doc.text("Firma del Estudiante Tutorado(a)", pageWidth - margin - 40, yPos + 5, { align: 'center' });

  if (retornarDoc) {
      return doc; // Retorna el objeto PDF para que el ZIP lo use
  } else {
      doc.save(`F01_INTEGRAL_${estudiante.codigo_estudiante}.pdf`); // Comportamiento normal
  }
};