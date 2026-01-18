import { jsPDF } from 'jspdf'; 

export const generarF05 = (sesion, estudiante, retornarDoc = false) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. ENCABEZADO INSTITUCIONAL
  const logoUrl = '/logo_unajma.png'; 
  try { 
    doc.addImage(logoUrl, 'PNG', 15, 8, 22, 22); 
  } catch (e) { 
    console.error("Logo no encontrado"); 
  }
  
  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text("UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS", 42, 15);
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text("Dirección de Bienestar Universitario", 42, 20);
  doc.text("Área de Tutoría", 42, 25);
  doc.setFontSize(10).setFont("helvetica", "bold");
  doc.text("ÁREA DE TUTORÍA", pageWidth - 50, 15);
  doc.line(15, 32, pageWidth - 15, 32); 

  // 2. TÍTULO DEL FORMATO
  doc.setFontSize(12).setFont("helvetica", "bold");
  doc.text("FICHA DE DERIVACIÓN DE TUTORÍA INDIVIDUAL (formato 05)", pageWidth / 2, 42, { align: 'center' });

  // 3. DATOS DEL TUTORADO
  doc.setFontSize(10).setFont("helvetica", "normal");
  
  // Nombre
  doc.text(`Nombre y Apellidos del Tutorado: ${estudiante.nombres_apellidos}`, 20, 55);
  doc.line(73, 56, pageWidth - 20, 56);

  // --- LÓGICA DE EXTRACCIÓN DE DATOS ---
  // Fecha Nacimiento: Manejo UTC para evitar restar 1 día
  const fechaNacRaw = sesion.fecha_nacimiento || estudiante.fecha_nacimiento;
  let fechaNac = '___/___/___';
  if (fechaNacRaw) {
      const d = new Date(fechaNacRaw);
      // Ajuste simple UTC
      fechaNac = new Date(d.getTime() + d.getTimezoneOffset() * 60000).toLocaleDateString('es-ES');
  }

  doc.text(`Fecha de Nacimiento: ${fechaNac}`, 20, 65);
  doc.text(`Edad: ${sesion.edad || ''} años`, 95, 65);
  doc.text(`DNI: ${sesion.dni || estudiante.dni || ''}`, 125, 65);
  doc.line(133, 66, pageWidth - 20, 66);

  // Escuela Profesional
  doc.text(`Escuela Profesional: ${sesion.escuela_profesional || estudiante.escuela_profesional || 'Ingeniería de Sistemas'}`, 20, 75);
  doc.line(53, 76, pageWidth - 20, 76);

  // Código, Semestre y Celular
  doc.text(`Código: ${estudiante.codigo_estudiante || sesion.codigo || ''}`, 20, 85);
  doc.text(`Semestre: ${sesion.semestre || ''}`, 75, 85);
  doc.text(`N° de Celular: ${sesion.celular || estudiante.celular || ''}`, 125, 85);
  doc.line(148, 86, pageWidth - 20, 86);

  // 4. DATOS DEL TUTOR Y FECHA
  const nombreTutor = sesion.nombre_tutor_deriva || sesion.nombre_tutor || '______________________________________';
  doc.text("Nombre y Apellidos de tutor que deriva:", 20, 95);
  doc.setFont("helvetica", "bold");
  doc.text(`${nombreTutor}`, 85, 95);
  doc.setFont("helvetica", "normal");
  doc.line(83, 96, pageWidth - 20, 96);

  // Fecha de la derivación
  const fechaOriginal = sesion.fecha_manual || sesion.fecha || sesion.fecha_solicitud;
  let fechaDeriv = new Date().toLocaleDateString('es-ES');
  if (fechaOriginal) {
      const d = new Date(fechaOriginal);
      fechaDeriv = new Date(d.getTime() + d.getTimezoneOffset() * 60000).toLocaleDateString('es-ES');
  }
    
  doc.text(`Fecha de derivación: ${fechaDeriv}`, 20, 105);
  doc.line(55, 106, 110, 106);

  // 5. MOTIVO DE DERIVACIÓN (DISEÑO REFORZADO CON ALTA INTENSIDAD)
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Motivo de Derivación:", 20, 115);
  
  doc.setFont("helvetica", "normal").setFontSize(10);
  const textoMotivo = sesion.motivo_derivacion || sesion.motivo_consulta || sesion.texto_motivo || '';
  
  // Ajuste de texto para márgenes internos
  const lineasMotivo = doc.splitTextToSize(textoMotivo, 160); 

  // --- MARCO EXTERIOR (MÁXIMA INTENSIDAD) ---
  doc.setDrawColor(0); // Negro puro (0)
  doc.setLineWidth(0.5); // Grosor aumentado
  doc.rect(20, 120, pageWidth - 40, 50); // Caja principal cerrada

  // --- LÍNEAS INTERNAS (INTENSIDAD AUMENTADA) ---
  doc.setDrawColor(80); // Gris grafito oscuro
  doc.setLineWidth(0.2); // Líneas internas

  for (let i = 1; i < 5; i++) {
    const yLineaInterna = 120 + (i * 10);
    // Dibujamos la línea de extremo a extremo dentro de la caja
    doc.line(20, yLineaInterna, pageWidth - 20, yLineaInterna);
  }

  // --- RENDERIZADO DEL TEXTO ---
  doc.setTextColor(0); // Negro intenso
  for (let i = 0; i < lineasMotivo.length && i < 5; i++) {
    // x: 23 para sangría interna, y: 127 para flotar sobre la línea
    doc.text(lineasMotivo[i], 23, 127 + (i * 10));
  }

  // Restauramos valores estándar para el resto del documento
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);

  // 6. OFICINAS DE DESTINO (Marcación con X)
  doc.setFont("helvetica", "bold").text("Marque la Oficina a quien deriva el caso:", 20, 180);
  doc.setFont("helvetica", "normal");
  
  const area = (sesion.area_destino || '').toLowerCase();
  
  // Lógica para diferenciar Psicología de Psicopedagogía
  const esPsicopedagogia = area.includes('psicopedagogía');
  const esPsicologia = area.includes('psicología') || (area.includes('psico') && !esPsicopedagogia);

  doc.text(`Medicina (${area.includes('medicina') ? ' X ' : '   '})`, 20, 190);
  doc.text(`Nutrición (${area.includes('nutri') ? ' X ' : '   '})`, 80, 190);
  doc.text(`Odontología (${area.includes('odonto') ? ' X ' : '   '})`, 140, 190);
  
  doc.text(`Psicología (${esPsicologia ? ' X ' : '   '})`, 20, 200);
  doc.text(`Psicopedagogía (${esPsicopedagogia ? ' X ' : '   '})`, 80, 200);
  doc.text(`Servicio Social (${area.includes('social') ? ' X ' : '   '})`, 140, 200);

  // 7. FIRMA DEL TUTOR
  if (sesion.firma_tutor_url) {
    try {
      doc.addImage(sesion.firma_tutor_url, 'PNG', pageWidth/2 - 25, 230, 50, 20);
    } catch (e) { console.warn("Firma no pudo cargarse en PDF"); }
  }
  doc.line(pageWidth/2 - 35, 255, pageWidth/2 + 35, 255);
  doc.text("Firma del Tutor(a)", pageWidth/2, 260, { align: 'center' });

  // Guardar archivo
  const nombreArchivo = `F05_Derivacion_${(estudiante.nombres_apellidos || 'Estudiante').replace(/ /g, '_')}.pdf`;
  if (retornarDoc) {
      return doc;
  } else {
      doc.save(`F05_DERIVACION_${estudiante.codigo_estudiante}.pdf`);
  }
};